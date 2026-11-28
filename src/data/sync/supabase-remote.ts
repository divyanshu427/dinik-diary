import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_BUCKET } from "@/lib/supabase";
import type { PushRecord, RemoteRecord, SyncRemote } from "./remote";

const COLUMNS = "tbl,id,data,updated_at,deleted,synced_at";

/** Throws with the clearest reason Supabase gave (some refusals come without a message). */
function fail(
  error: { message?: string; code?: string; hint?: string | null } | null,
  status?: number,
): asserts error is null {
  if (!error) return;
  const reason =
    error.message ||
    error.hint ||
    (status === 401 || status === 403
      ? "the database refused access (run supabase/schema.sql again)"
      : `the server answered ${status ?? "with an error"}`);
  throw new Error(error.code ? `${reason} (${error.code})` : reason);
}

async function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file."));
    reader.readAsDataURL(blob);
  });
}

/** The cloud side of sync: the `records` table and the report-files bucket (supabase/schema.sql). */
export function createSupabaseRemote(client: SupabaseClient, userId: string): SyncRemote {
  const path = (id: string) => `${userId}/${id}`;
  const files = () => client.storage.from(SUPABASE_BUCKET);

  return {
    async pull(since, limit) {
      let query = client.from("records").select(COLUMNS).order("synced_at").limit(limit);
      if (since) query = query.gte("synced_at", since);
      const { data, error, status } = await query;
      fail(error, status);
      return (data ?? []) as RemoteRecord[];
    },

    async push(records: PushRecord[]) {
      const { data, error, status } = await client
        .from("records")
        .upsert(
          records.map((r) => ({ ...r, user_id: userId })),
          { onConflict: "user_id,tbl,id" },
        )
        .select(COLUMNS);
      fail(error, status);
      return (data ?? []) as RemoteRecord[];
    },

    async countLive() {
      // A normal read (not a "head" request), so a refusal comes back with its reason.
      const { data, count, error, status } = await client
        .from("records")
        .select("id", { count: "exact" })
        .eq("deleted", false)
        .limit(1);
      fail(error, status);
      return count ?? data?.length ?? 0;
    },

    async putFile(id, dataUrl, mime) {
      const blob = await (await fetch(dataUrl)).blob();
      const { error } = await files().upload(path(id), blob, { upsert: true, contentType: mime });
      fail(error);
    },

    async getFile(id) {
      const { data, error } = await files().download(path(id));
      fail(error);
      return toDataUrl(data!);
    },

    async removeFile(id) {
      const { error } = await files().remove([path(id)]);
      fail(error);
    },
  };
}
