"use client";

import { useSyncExternalStore } from "react";
import { logicalDate, type IsoDate } from "@/lib/core";
import { useSettings } from "./use-data";

/** A clock that ticks once a minute. null during server rendering. */
function subscribeMinute(onTick: () => void) {
  const timer = setInterval(onTick, 60_000);
  return () => clearInterval(timer);
}
const currentMinute = () => Math.floor(Date.now() / 60_000);
const noMinute = () => null;

/** The current time, updated once a minute. null during server rendering. */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribeMinute, currentMinute, noMinute);
  return minute === null ? null : new Date(minute * 60_000);
}

/**
 * Today's logical date (4 AM rule, in the time zone from settings).
 * null until settings have loaded. Re-checks every minute so it rolls over at the day start.
 */
export function useToday(): IsoDate | null {
  const { data: settings } = useSettings();
  const minute = useSyncExternalStore(subscribeMinute, currentMinute, noMinute);
  if (!settings || minute === null) return null;
  return logicalDate(new Date(minute * 60_000), {
    timeZone: settings.timezone,
    dayStartHour: settings.dayStartHour,
  });
}
