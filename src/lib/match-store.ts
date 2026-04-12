// Server-only module — only import in Next.js API routes, not client components.
import { supabase } from "@/lib/supabase";
import type { ResearcherMatchRow } from "@grant-researcher/db";

/** Input shape for upserting a match — id and created_at are DB-generated. */
export type MatchInput = Omit<ResearcherMatchRow, "id" | "created_at">;

/**
 * Upsert a single match score for a researcher.
 * Conflicts on (researcher_id, funder_slug, scheme_slug) update in place.
 */
export async function upsertMatch(match: MatchInput): Promise<void> {
  const { error } = await supabase
    .from("researcher_matches")
    .upsert(match, { onConflict: "researcher_id,funder_slug,scheme_slug" });
  if (error) throw new Error(error.message);
}

/**
 * Upsert multiple match scores in one round-trip.
 * Accepts a researcherId and an array of scores without researcher_id so the
 * caller (match route) doesn't have to map it onto every element.
 * No-ops if given an empty array.
 */
export async function upsertMatchBatch(
  researcherId: string,
  scores: Omit<MatchInput, "researcher_id">[]
): Promise<void> {
  if (scores.length === 0) return;
  const matches: MatchInput[] = scores.map((s) => ({ ...s, researcher_id: researcherId }));
  const { error } = await supabase
    .from("researcher_matches")
    .upsert(matches, { onConflict: "researcher_id,funder_slug,scheme_slug" });
  if (error) throw new Error(error.message);
}

/**
 * Fetch all match scores for a researcher.
 */
export async function getMatches(
  researcherId: string
): Promise<ResearcherMatchRow[]> {
  const { data, error } = await supabase
    .from("researcher_matches")
    .select("*")
    .eq("researcher_id", researcherId)
    .order("score_overall", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResearcherMatchRow[];
}

/**
 * Delete all match scores for a researcher (clean slate before re-matching).
 */
export async function deleteMatchesForResearcher(researcherId: string): Promise<void> {
  const { error } = await supabase
    .from("researcher_matches")
    .delete()
    .eq("researcher_id", researcherId);
  if (error) throw new Error(error.message);
}
