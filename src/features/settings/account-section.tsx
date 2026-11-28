"use client";

import { Check, CloudOff, Download, LogOut, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import { readProfile } from "@/data/profile";
import { chooseData, sendSignInEmail, signOut, syncNow } from "@/features/sync/sync-service";
import { useSyncStore } from "@/stores/sync-store";
import { cn } from "@/lib/utils";
import { useDownloadBackup } from "./use-download-backup";

const t = copy.pages.account;

const errorText = (e: unknown) => t.failed(e instanceof Error ? e.message : String(e));

/** "just now", "5 minutes ago", or the time. Updates every 30 seconds. */
function useAgo(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return "";
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minutesAgo(minutes);
  return t.at(new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
}

/** Settings → Account and sync: sign in with email, see the sync status, sign out. */
export function AccountSection() {
  const { status, email } = useSyncStore();

  if (status === "off") {
    return (
      <p className="text-sm text-muted-foreground">
        {readProfile() === "demo" ? t.demoHint : t.offHint}
      </p>
    );
  }
  if (!email && (status === "signed-out" || status === "checking")) return <SignIn />;
  if (status === "choose") return <ChooseData />;
  return <SignedIn />;
}

function SignIn() {
  const [address, setAddress] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const value = address.trim();
    if (!value) return;
    void run(async () => {
      await sendSignInEmail(value);
      setSentTo(value);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1.5 text-sm">
        {t.why.map((line) => (
          <li key={line} className="flex gap-2">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {sentTo === null ? (
        <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            {t.emailLabel}
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder={t.emailPlaceholder}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-10"
            />
          </label>
          <Button type="submit" className="h-10" disabled={busy || !address.trim()}>
            {busy ? t.sending : t.send}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-sm">
            {t.sent(sentTo)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => sendSignInEmail(sentTo))}
            >
              {busy ? t.sending : t.resend}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
            >
              {t.otherEmail}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusLine() {
  const { status, lastSyncedAt, error, skipped } = useSyncStore();
  const ago = useAgo(lastSyncedAt);
  const tone = status === "error" ? "text-destructive" : status === "offline" ? "text-warning" : "";
  const Icon =
    status === "error"
      ? TriangleAlert
      : status === "offline"
        ? CloudOff
        : status === "synced"
          ? Check
          : RefreshCw;
  const text =
    status === "error"
      ? t.status.error(error ?? "")
      : status === "offline"
        ? t.status.offline
        : status === "synced"
          ? t.status.synced(ago)
          : status === "syncing"
            ? t.status.syncing
            : t.status.checking;

  return (
    <div className="flex flex-col gap-1">
      <p
        role="status"
        data-testid="sync-status"
        className={cn("flex items-start gap-2 text-sm font-medium", tone)}
      >
        <Icon
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0",
            status === "synced" && "text-success",
            (status === "syncing" || status === "checking") && "animate-spin",
          )}
        />
        <span>{text}</span>
      </p>
      {skipped > 0 && <p className="text-sm text-muted-foreground">{t.skipped(skipped)}</p>}
    </div>
  );
}

function SignedIn() {
  const { status, email } = useSyncStore();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async (mode: "keep" | "remove") => {
    setBusy(true);
    setError(null);
    try {
      await signOut(mode);
      setConfirm(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {email && <p className="text-sm text-muted-foreground">{t.signedInAs(email)}</p>}
      <StatusLine />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={syncNow}
          disabled={status === "syncing" || status === "checking"}
        >
          <RefreshCw aria-hidden />
          {status === "error" ? t.tryAgain : t.syncNow}
        </Button>
        <Button variant="ghost" onClick={() => setConfirm(true)}>
          <LogOut aria-hidden />
          {t.signOut}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.signOutTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.signOutBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-col sm:items-stretch">
            <AlertDialogAction onClick={() => leave("keep")} disabled={busy}>
              {t.signOutKeep}
            </AlertDialogAction>
            <AlertDialogAction
              variant="destructive"
              onClick={() => leave("remove")}
              disabled={busy}
            >
              {t.signOutRemove}
            </AlertDialogAction>
            <AlertDialogCancel>{copy.common.cancel}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChooseData() {
  const c = t.choose;
  const backup = useDownloadBackup();
  const [confirmKeep, setConfirmKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (mode: "take" | "keep-device") => {
    setBusy(true);
    setError(null);
    try {
      await chooseData(mode);
      setConfirmKeep(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const option = (label: string, hint: string, onClick: () => void, primary = false) => (
    <Button
      variant={primary ? "default" : "outline"}
      className="h-auto flex-col items-start gap-0.5 rounded-xl px-4 py-3 text-left whitespace-normal"
      disabled={busy}
      onClick={onClick}
    >
      <span className="text-base font-semibold">{label}</span>
      <span className={cn("text-xs font-normal", !primary && "text-muted-foreground")}>{hint}</span>
    </Button>
  );

  return (
    <div className="flex flex-col gap-3" data-testid="sync-choose">
      <p className="font-heading text-lg font-semibold">{c.title}</p>
      <p className="text-sm text-muted-foreground">{c.body}</p>
      <Button
        variant="link"
        size="sm"
        className="h-auto self-start px-0"
        disabled={backup.isPending}
        onClick={() => void backup.download().catch((e) => setError(errorText(e)))}
      >
        <Download aria-hidden />
        {c.backup}
      </Button>
      <div className="grid gap-2 sm:grid-cols-2">
        {option(c.take, c.takeHint, () => void pick("take"), true)}
        {option(c.keep, c.keepHint, () => setConfirmKeep(true))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <AlertDialog open={confirmKeep} onOpenChange={setConfirmKeep}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.confirmKeepTitle}</AlertDialogTitle>
            <AlertDialogDescription>{c.confirmKeepBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => void pick("keep-device")}
            >
              {c.confirmKeep}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
