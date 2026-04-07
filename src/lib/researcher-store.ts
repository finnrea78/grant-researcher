// Server-only module — only import in Next.js API routes, not client components.
import { supabase as serviceClient } from "@/lib/supabase";
import { embedText } from "@/lib/embedder";
import type { IntakeData, ResearcherProfile } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Upsert a researcher from intake form data. Returns the researcher's UUID.
 * Pass userId to associate with an authenticated user (sets user_id column).
 * Pass client to use a per-request RLS-scoped client instead of service-role.
 */
export async function upsertResearcher(
  intake: IntakeData,
  slug: string,
  userId?: string,
  client?: SupabaseClient
): Promise<string> {
  const db = client ?? serviceClient;
  const row: Record<string, unknown> = {
    slug,
    name: intake.name ?? slug,
    orcid: intake.identifiers?.orcid,
    google_scholar_url: intake.identifiers?.google_scholar_url,
    researcher_id: intake.identifiers?.researcher_id,
    scopus_author_id: intake.identifiers?.scopus_author_id,
    institutional_profile_url: intake.identifiers?.institutional_profile_url,
    institution: intake.institution,
    department: intake.department,
    institution_country: intake.institution_country,
    career_stage: intake.career_stage,
    research_themes: intake.research_themes ?? [],
    research_keywords: intake.research_keywords ?? [],
    disciplinary_fields: intake.disciplinary_fields ?? [],
    geographic_focus: intake.geographic_focus ?? [],
    future_research: intake.future_research,
    research_trajectory: intake.research_trajectory,
    funding_goals: intake.funding_goals ?? {},
    collaboration: intake.collaboration ?? {},
    eligibility: intake.eligibility ?? {},
    cv_text: intake.cv_text,
    intake_source: "web_form",
    intake_completed_at: new Date().toISOString(),
  };

  if (userId) {
    row.user_id = userId;
  }

  const { data, error } = await db
    .from("researchers")
    .upsert(row, { onConflict: "slug" })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to upsert researcher ${slug}: ${error.message}`);
  }
  return data.id;
}

/**
 * Update the enriched_profile column after the Claude enrichment agent completes.
 */
export async function updateResearcherProfile(
  slug: string,
  profile: ResearcherProfile
): Promise<void> {
  const { error } = await serviceClient
    .from("researchers")
    .update({
      enriched_profile: profile,
      enriched_at: new Date().toISOString(),
      research_themes: profile.research_themes ?? [],
      research_keywords: profile.research_keywords ?? [],
    })
    .eq("slug", slug);

  if (error) {
    throw new Error(`Failed to update profile for ${slug}: ${error.message}`);
  }
}

/**
 * Cache raw ORCID API response against a researcher slug.
 */
export async function updateOrcidData(
  slug: string,
  orcidData: Record<string, unknown>
): Promise<void> {
  const { error } = await serviceClient
    .from("researchers")
    .update({
      orcid_data: orcidData,
      orcid_fetched_at: new Date().toISOString(),
    })
    .eq("slug", slug);

  if (error) {
    throw new Error(`Failed to update ORCID data for ${slug}: ${error.message}`);
  }
}

/**
 * Compute a semantic embedding from the researcher's Claude-generated
 * retrieval_summary and store it in researchers.profile_embedding.
 */
export async function updateProfileEmbedding(
  slug: string,
  summaryText: string
): Promise<void> {
  const profile_embedding = await embedText(summaryText);
  const { error } = await serviceClient
    .from("researchers")
    .update({ profile_embedding })
    .eq("slug", slug);
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * List all researchers for the current user.
 * When called with an RLS-scoped client, automatically filters to the current user's researchers.
 */
export async function listResearchersWithProfiles(
  client?: SupabaseClient
): Promise<{ slug: string; name: string; hasProfile: boolean }[]> {
  const db = client ?? serviceClient;
  const { data, error } = await db
    .from("researchers")
    .select("slug, name, enriched_profile")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { slug: string; name: string; enriched_profile: unknown }) => ({
    slug: r.slug,
    name: r.name,
    hasProfile: r.enriched_profile !== null,
  }));
}

/**
 * Fetch a researcher by slug.
 * When called with an RLS-scoped client, returns null if the researcher belongs to a different user.
 */
export async function getResearcherBySlug(
  slug: string,
  client?: SupabaseClient
): Promise<{
  slug: string;
  name: string;
  enriched_profile: ResearcherProfile;
} | null> {
  const db = client ?? serviceClient;
  const { data, error } = await db
    .from("researchers")
    .select("slug, name, enriched_profile")
    .eq("slug", slug)
    .single();
  if (error || !data?.enriched_profile) return null;
  return { slug: data.slug, name: data.name, enriched_profile: data.enriched_profile as ResearcherProfile };
}

/**
 * Fetch only the fields needed for opportunity retrieval.
 */
export async function getResearcherForMatching(slug: string): Promise<{
  profile_embedding: number[] | null;
  research_themes: string[];
  research_keywords: string[];
}> {
  const { data, error } = await serviceClient
    .from("researchers")
    .select("profile_embedding, research_themes, research_keywords")
    .eq("slug", slug)
    .single();
  if (error) throw new Error(error.message);
  return {
    profile_embedding: data.profile_embedding ?? null,
    research_themes: data.research_themes ?? [],
    research_keywords: data.research_keywords ?? [],
  };
}
