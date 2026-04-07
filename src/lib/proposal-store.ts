// Server-only module — only import in Next.js API routes, not client components.
import { supabase } from "@/lib/supabase";

export async function upsertProposal(
  researcherSlug: string,
  funderSlug: string,
  schemeSlug: string,
  content: string
): Promise<void> {
  // Resolve researcher UUID
  const { data: researcher, error: lookupErr } = await supabase
    .from("researchers")
    .select("id")
    .eq("slug", researcherSlug)
    .single();
  if (lookupErr || !researcher) {
    throw new Error(`Researcher not found: ${researcherSlug}`);
  }
  const { error } = await supabase.from("researcher_proposals").upsert(
    {
      researcher_id: researcher.id,
      funder_slug: funderSlug,
      scheme_slug: schemeSlug,
      content,
    },
    { onConflict: "researcher_id,funder_slug,scheme_slug" }
  );
  if (error) throw new Error(error.message);
}

export async function getProposals(
  researcherSlug: string
): Promise<{ funder_slug: string; scheme_slug: string; content: string }[]> {
  // Resolve researcher UUID
  const { data: researcher } = await supabase
    .from("researchers")
    .select("id")
    .eq("slug", researcherSlug)
    .single();
  if (!researcher) return [];
  const { data, error } = await supabase
    .from("researcher_proposals")
    .select("funder_slug, scheme_slug, content")
    .eq("researcher_id", researcher.id);
  if (error) throw new Error(error.message);
  return (data ?? []) as { funder_slug: string; scheme_slug: string; content: string }[];
}
