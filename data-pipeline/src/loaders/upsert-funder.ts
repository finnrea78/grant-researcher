// data-pipeline/src/loaders/upsert-funder.ts
import { supabase } from "../db.js";
import type { FunderRow } from "../types.js";

/**
 * Upsert a funder by slug. Returns the funder's UUID.
 */
export async function upsertFunder(funder: FunderRow): Promise<string> {
  const { data, error } = await supabase
    .from("funders")
    .upsert(funder, { onConflict: "slug" })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to upsert funder ${funder.slug}: ${error.message}`);
  return data.id;
}
