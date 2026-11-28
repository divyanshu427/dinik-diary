import type { Session } from "@supabase/supabase-js";
import Dexie from "dexie";
import { getDataStore, getLocalDb } from "@/data";
import { readProfile } from "@/data/profile";
import { createSyncEngine, type LinkMode, type SyncEngine } from "@/data/sync/engine";
import { createSupabaseRemote } from "@/data/sync/supabase-remote";
import { getSupabase, isSyncConfigured } from "@/lib/supabase";
import { useSyncStore } from "@/stores/sync-store";

/*
 * Runs sync in the background while the app is open: after every change (a moment later),
 * when another device changes something (live), when the app comes back online or to the
 * front, and once a minute.
 */

/** Wait after a change before syncing, so a burst of edits goes up together. */
const AFTER_CHANGE_MS = 1500;
const EVERY_MS = 60_000;
const LOCK = "dinik-diary-sync";

let engine: SyncEngine | null = null;
let userId: string | null = null;
let onChanged: () => void = () => undefined;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
/** The device is connected to the account (first sign-in finished). Syncs wait for this. */
let ready = false;
let connecting = false;
let again = false;
let stopLive: (() => void) | null = null;

const store = () => useSyncStore.getState();

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function offline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Only one tab syncs at a time. */
function withLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(LOCK, work) as Promise<T>;
  }
  return work();
}

function failed(e: unknown) {
  if (offline() || /fetch|network|load failed/i.test(message(e))) {
    store().set({ status: "offline", error: null });
  } else {
    store().set({ status: "error", error: message(e) });
  }
}

async function run() {
  if (!ready) {
    // Not connected yet: a first sign-in that failed (offline, or an error) tries again.
    if (!connecting && store().status !== "choose") void retryConnect();
    return;
  }
  if (!engine || !userId) return;
  if (running) {
    again = true;
    return;
  }
  if (offline()) {
    store().set({ status: "offline" });
    return;
  }
  running = true;
  store().set({ status: "syncing", error: null });
  try {
    const result = await withLock(() => engine!.sync());
    if (result.changed) onChanged();
    store().set({
      status: "synced",
      lastSyncedAt: new Date().toISOString(),
      skipped: result.skipped,
    });
  } catch (e) {
    failed(e);
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(0);
    }
  }
}

/** Sync soon (several calls in a row make one sync). */
export function schedule(delay = AFTER_CHANGE_MS) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void run();
  }, delay);
}

function listenLive(uid: string) {
  stopLive?.();
  const client = getSupabase();
  const channel = client
    .channel(`records-${uid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "records", filter: `user_id=eq.${uid}` },
      () => schedule(500),
    )
    .subscribe();
  stopLive = () => {
    void client.removeChannel(channel);
    stopLive = null;
  };
}

async function connect(session: Session | null) {
  if (!session) {
    stopLive?.();
    engine = null;
    userId = null;
    ready = false;
    store().set({ status: "signed-out", email: null, error: null });
    return;
  }
  if (session.user.id === userId && (ready || connecting)) return;
  userId = session.user.id;
  const uid = userId;
  ready = false;
  connecting = true;
  store().set({ status: "checking", email: session.user.email ?? null, error: null });
  engine = createSyncEngine({ db: getLocalDb(), remote: createSupabaseRemote(getSupabase(), uid) });
  try {
    const plan = await withLock(() => engine!.plan(uid));
    if (plan === "choose") {
      store().set({ status: "choose" });
      return;
    }
    if (plan !== "linked") {
      store().set({ status: "syncing" });
      const result = await withLock(() => engine!.link(uid, plan));
      if (result.changed) onChanged();
    }
    ready = true;
    store().set({ status: "synced", lastSyncedAt: new Date().toISOString() });
    listenLive(uid);
    schedule(0);
  } catch (e) {
    // Shows the real reason; the next sync (a minute, back online, "Try again") retries.
    failed(e);
  } finally {
    connecting = false;
  }
}

async function retryConnect() {
  const { data } = await getSupabase().auth.getSession();
  if (data.session && data.session.user.id === userId) userId = null; // force a fresh try
  await connect(data.session);
}

/** Starts sync for this page. Returns a function that stops it. */
export function startSync(changed: () => void): () => void {
  onChanged = changed;
  if (!isSyncConfigured() || readProfile() === "demo") {
    store().set({ status: "off" });
    return () => undefined;
  }
  const client = getSupabase();
  store().set({ status: "checking" });
  void client.auth.getSession().then(({ data }) => connect(data.session));
  const { data: auth } = client.auth.onAuthStateChange((_event, session) => {
    // Supabase asks not to await its own calls inside this callback.
    setTimeout(() => void connect(session), 0);
  });

  // A change on this device (sync's own bookkeeping doesn't count).
  const onMutated = (parts: Record<string, unknown>) => {
    const db = getLocalDb().name;
    const data = Object.keys(parts).some(
      (k) => k.startsWith(`idb://${db}/`) && !/\/sync(Meta|State)\//.test(k),
    );
    // During a sync this may be sync's own write; one more sync then finds nothing to do.
    if (data) {
      if (running) again = true;
      else schedule();
    }
  };
  Dexie.on("storagemutated", onMutated);
  // Back online: sync (or finish connecting, if that's what was waiting).
  const onOnline = () => schedule(0);
  const onOffline = () => {
    if (engine) store().set({ status: "offline" });
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") schedule(0);
  };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);
  const every = setInterval(() => schedule(0), EVERY_MS);

  return () => {
    auth.subscription.unsubscribe();
    Dexie.on("storagemutated").unsubscribe(onMutated);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(every);
    if (timer) clearTimeout(timer);
    stopLive?.();
    engine = null;
    userId = null;
    ready = false;
  };
}

// ---------- actions for the Settings card ----------

/** Sends the sign-in email (Supabase's own template, with a "Sign in" link). */
export async function sendSignInEmail(email: string) {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/settings`, shouldCreateUser: true },
  });
  if (error) throw new Error(error.message);
}

/** First sign-in when both this device and the account have data. */
export async function chooseData(mode: Extract<LinkMode, "take" | "keep-device">) {
  if (!engine || !userId) return;
  const uid = userId;
  store().set({ status: "syncing", error: null });
  try {
    const result = await withLock(() => engine!.link(uid, mode));
    if (result.changed) onChanged();
    ready = true;
    store().set({ status: "synced", lastSyncedAt: new Date().toISOString() });
    listenLive(uid);
  } catch (e) {
    failed(e);
    store().set({ status: "choose" });
    throw e;
  }
}

export function syncNow() {
  schedule(0);
}

/**
 * Signs out. "keep": the data stays on this device (signing in again carries on).
 * "remove": this device goes back to the starter data; the account keeps everything.
 */
export async function signOut(mode: "keep" | "remove") {
  const current = engine;
  // Stop syncing first, so removing the data here doesn't delete it in the account.
  engine = null;
  userId = null;
  ready = false;
  stopLive?.();
  if (timer) clearTimeout(timer);
  await getSupabase().auth.signOut({ scope: "local" });
  if (mode === "remove" && current) {
    await current.unlink();
    await getDataStore().resetToDefaults();
    onChanged();
  }
  store().set({ status: "signed-out", email: null, lastSyncedAt: null, error: null });
}
