import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * The Supabase connection (Build Phase 15). Both values are public by design (they only
 * identify the project; row level security protects the data) and come from the
 * environment: .env.local on the laptop, Environment Variables on Vercel.
 * Without them the app works exactly as before, on this device only.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_BUCKET = "report-files";

export function isSyncConfigured() {
  return URL.length > 0 && KEY.length > 0;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSyncConfigured()) throw new Error("Sync isn't set up (no Supabase URL or key).");
  client ??= createClient(URL, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // The email link signs in even if it opens in another browser than the one that
      // asked for it (e.g. Gmail's own browser on Android).
      flowType: "implicit",
    },
  });
  return client;
}
