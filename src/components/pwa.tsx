"use client";

import { useEffect, useSyncExternalStore } from "react";

/*
 * Installing and offline (Build Phase 13).
 * - Registers the service worker in production builds (not in `npm run dev`, where it would
 *   cache files that change on every save).
 * - Keeps the browser's "install this app" offer, so Settings can show an Install button.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let installEvent: InstallPromptEvent | null = null;
let offlineReady = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our own button
    installEvent = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    notify();
  });
}

/** Mounted once in the app shell. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        offlineReady = true;
        notify();
      })
      .catch(() => {
        // No offline support in this browser: the app still works online.
      });
  }, []);
  return null;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", l);
  return () => {
    listeners.delete(l);
    media.removeEventListener("change", l);
  };
};

export interface InstallState {
  /** The browser offered to install (Chrome, Edge, Android). */
  canPrompt: boolean;
  /** Running as the installed app. */
  installed: boolean;
  /** iPhone/iPad: no install button, only "Add to Home Screen". */
  ios: boolean;
  offlineReady: boolean;
}

const SERVER: InstallState = {
  canPrompt: false,
  installed: false,
  ios: false,
  offlineReady: false,
};
let last: InstallState = SERVER;

function snapshot(): InstallState {
  const next: InstallState = {
    canPrompt: installEvent !== null,
    installed:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    offlineReady,
  };
  // Same values → same object, as useSyncExternalStore expects.
  if (
    next.canPrompt === last.canPrompt &&
    next.installed === last.installed &&
    next.ios === last.ios &&
    next.offlineReady === last.offlineReady
  )
    return last;
  return (last = next);
}

export function useInstall() {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  return {
    ...state,
    /** Shows the browser's install dialog. */
    prompt: async () => {
      const event = installEvent;
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      installEvent = null;
      notify();
    },
  };
}
