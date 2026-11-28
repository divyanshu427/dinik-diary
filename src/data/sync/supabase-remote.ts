import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_BUCKET } from "@/lib/supabase";
import type { PushRecord, RemoteRecord, SyncRemote } from "./remote";

const COLUMNS = "tbl,id,data,updated_at,deleted,synced_at";

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
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
      const { data, error } = await query;
      fail(error);
      return (data ?? []) as RemoteRecord[];
    },

    async push(records: PushRecord[]) {
      const { data, error } = await client
        .from("records")
        .upsert(
          records.map((r) => ({ ...r, user_id: userId })),
          { onConflict: "user_id,tbl,id" },
        )
        .select(COLUMNS);
      fail(error);
      return (data ?? []) as RemoteRecord[];
    },

    async countLive() {
      const { count, error } = await client
        .from("records")
        .select("id", { count: "exact", head: true })
        .eq("deleted", false);
      fail(error);
      return count ?? 0;
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
