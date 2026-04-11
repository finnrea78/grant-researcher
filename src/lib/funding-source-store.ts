// Server-only module — only import in Next.js API routes, not client components.
import { supabase } from "@/lib/supabase";
import type { FundingSourceRow } from "@grant-researcher/db";

/** Input shape for upserting a funding source — id and timestamps are DB-generated. */
export type FundingSourceInput = Omit<FundingSourceRow, "id" | "created_at" | "updated_at">;

/**
 * Upsert a funding source by slug. Returns the row id.
 */
export async function upsertFundingSource(source: FundingSourceInput): Promise<void> {
  const { error } = await supabase
    .from("funding_sources")
    .upsert(source, { onConflict: "slug" });
  if (error) throw new Error(error.message);
}

/**
 * List all funding sources ordered by name.
 */
export async function listFundingSources(): Promise<FundingSourceRow[]> {
  const { data, error } = await supabase
    .from("funding_sources")
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as FundingSourceRow[];
}

/**
 * Fetch a single funding source by slug. Returns null if not found.
 */
export async function getFundingSource(slug: string): Promise<FundingSourceRow | null> {
  const { data, error } = await supabase
    .from("funding_sources")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw new Error(error.message);
  return (data as FundingSourceRow) ?? null;
}
