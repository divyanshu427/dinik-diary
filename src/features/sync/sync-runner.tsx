"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/hooks/query-keys";
import { startSync } from "./sync-service";

/** Keeps this device in sync with the account while the app is open. Renders nothing. */
export function SyncRunner() {
  const qc = useQueryClient();
  useEffect(
    // When sync changed data here, every screen reads it again.
    () => startSync(() => void qc.invalidateQueries({ queryKey: queryKeys.all })),
    [qc],
  );
  return null;
}
