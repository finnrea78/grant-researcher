// Server-only module — only import in Next.js API routes, not client components.
import { supabase as serviceClient } from "@/lib/supabase";

/**
 * Upsert a proposal into researcher_proposals.
 * Uses (researcher_id, funder_slug, scheme_slug) as the unique key.
 */
export async function upsertProposal(
  researcherId: string,
  funderSlug: string,
  schemeSlug: string,
  content: string
): Promise<void> {
  const { error } = await serviceClient
    .from("researcher_proposals")
    .upsert(
      { researcher_id: researcherId, funder_slug: funderSlug, scheme_slug: schemeSlug, content },
      { onConflict: "researcher_id,funder_slug,scheme_slug" }
    );

  if (error) {
    throw new Error(`Failed to upsert proposal for ${funderSlug}/${schemeSlug}: ${error.message}`);
  }
}

/**
 * Convenience wrapper: look up researcher by slug, then upsert the proposal.
 * Use this from API routes where you have the researcher slug, not their UUID.
 */
export async function upsertProposalBySlug(
  slug: string,
  funderSlug: string,
  schemeSlug: string,
  content: string
): Promise<void> {
  const { data: researcher, error } = await serviceClient
    .from("researchers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (error || !researcher) {
    throw new Error(`Researcher ${slug} not found: cannot save proposal`);
  }

  await upsertProposal(researcher.id, funderSlug, schemeSlug, content);
}

/**
 * Fetch all proposals for a researcher identified by slug.
 * Returns empty array if the researcher doesn't exist or has no proposals.
 */
export async function getProposalsByResearcherSlug(
  slug: string
): Promise<{ funder_slug: string; scheme_slug: string; content: string; updated_at: string }[]> {
  // Resolve slug → id
  const { data: researcher, error: rErr } = await serviceClient
    .from("researchers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (rErr || !researcher) return [];

  const { data, error } = await serviceClient
    .from("researcher_proposals")
    .select("funder_slug, scheme_slug, content, updated_at")
    .eq("researcher_id", researcher.id);

  if (error) {
    throw new Error(`Failed to fetch proposals for ${slug}: ${error.message}`);
  }

  return data ?? [];
}
