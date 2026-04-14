// Server-only module — only import in Next.js API routes, not client components.
import { supabase as serviceClient } from "@/lib/supabase";
import { embedText } from "@/lib/embedder";
import type { IntakeData, ResearcherProfile, ProposalIntent } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Upsert a researcher from intake form data. Returns the researcher's UUID.
 * Pass userId to associate with an authenticated user (sets user_id column).
 * The unique constraint is (user_id, slug) so two users can each have a "jane-smith".
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
    institutional_profile_url: intake.identifiers?.institutional_profile_url,
    institution: intake.institution,
    department: intake.department,
    institution_country: intake.institution_country,
    career_stage: intake.career_stage,
    research_themes: intake.research_themes ?? [],
    research_keywords: intake.research_keywords ?? [],
    eligibility: intake.eligibility ?? {},
    cv_text: intake.cv_text,
    intake_source: "web_form",
    intake_completed_at: new Date().toISOString(),
    proposal_intent: intake.proposal_intent ?? null,
  };

  if (userId) {
    row.user_id = userId;
  }

  const { data, error } = await db
    .from("researchers")
    .upsert(row, { onConflict: "user_id,slug" })
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
  userId: string,
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
    .eq("slug", slug)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update profile for ${slug}: ${error.message}`);
  }
}

/**
 * Cache raw ORCID API response against a researcher slug.
 */
export async function updateOrcidData(
  slug: string,
  userId: string,
  orcidData: Record<string, unknown>
): Promise<void> {
  const { error } = await serviceClient
    .from("researchers")
    .update({
      orcid_data: orcidData,
      orcid_fetched_at: new Date().toISOString(),
    })
    .eq("slug", slug)
    .eq("user_id", userId);

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
  userId: string,
  summaryText: string
): Promise<void> {
  const profile_embedding = await embedText(summaryText);
  const { error } = await serviceClient
    .from("researchers")
    .update({ profile_embedding })
    .eq("slug", slug)
    .eq("user_id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * List all researchers for a specific user.
 */
export async function listResearchersWithProfiles(
  userId: string,
  client?: SupabaseClient
): Promise<{ slug: string; name: string; hasProfile: boolean }[]> {
  const db = client ?? serviceClient;
  const { data, error } = await db
    .from("researchers")
    .select("slug, name, enriched_profile")
    .eq("user_id", userId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { slug: string; name: string; enriched_profile: unknown }) => ({
    slug: r.slug,
    name: r.name,
    hasProfile: r.enriched_profile !== null,
  }));
}

/**
 * Fetch a researcher by slug, scoped to the given user.
 */
export async function getResearcherBySlug(
  slug: string,
  userId: string,
  client?: SupabaseClient
): Promise<{
  id: string;
  slug: string;
  name: string;
  enriched_profile: ResearcherProfile;
} | null> {
  const db = client ?? serviceClient;
  const { data, error } = await db
    .from("researchers")
    .select("id, slug, name, enriched_profile")
    .eq("slug", slug)
    .eq("user_id", userId)
    .single();
  if (error || !data?.enriched_profile) return null;
  return { id: data.id, slug: data.slug, name: data.name, enriched_profile: data.enriched_profile as ResearcherProfile };
}

/**
 * Merge a partial state patch into the researcher's pipeline_state JSONB.
 * Uses the Postgres || operator semantics — existing keys not in patch are preserved.
 * Implemented as a read-modify-write since Supabase JS doesn't expose raw SQL update.
 */
export async function updatePipelineState(
  slug: string,
  userId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const current = await getPipelineState(slug, userId).catch(() => ({}));
  const { error } = await serviceClient
    .from("researchers")
    .update({ pipeline_state: { ...current, ...patch } })
    .eq("slug", slug)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Read the pipeline_state JSONB for a researcher.
 */
export async function getPipelineState(
  slug: string,
  userId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await serviceClient
    .from("researchers")
    .select("pipeline_state")
    .eq("slug", slug)
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(error.message);
  return (data?.pipeline_state as Record<string, unknown>) ?? {};
}

/**
 * Set or clear the scholar_candidate JSONB column.
 * Pass null to clear after disambiguation is resolved.
 */
export async function updateScholarCandidate(
  slug: string,
  userId: string,
  candidate: Record<string, unknown> | null
): Promise<void> {
  const { error } = await serviceClient
    .from("researchers")
    .update({ scholar_candidate: candidate })
    .eq("slug", slug)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Write publications markdown (researcher context from the enrich agent).
 */
export async function updatePublicationsMd(
  slug: string,
  userId: string,
  md: string
): Promise<void> {
  const { error } = await serviceClient
    .from("researchers")
    .update({ publications_md: md })
    .eq("slug", slug)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Write the formatted match results markdown summary.
 */
export async function updateMatchResultsMd(
  slug: string,
  userId: string,
  markdown: string
): Promise<void> {
  const { error } = await serviceClient
    .from("researchers")
    .update({ match_results_md: markdown })
    .eq("slug", slug)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Fetch all columns needed by pipeline routes in a single query.
 * Returns null if the researcher is not found or belongs to a different user.
 */
export async function getResearcherFull(
  slug: string,
  userId: string,
  client?: SupabaseClient
): Promise<{
  id: string;
  slug: string;
  name: string;
  cv_text: string | null;
  enriched_profile: ResearcherProfile | null;
  pipeline_state: Record<string, unknown>;
  publications_md: string | null;
  match_results_md: string | null;
  scholar_candidate: Record<string, unknown> | null;
  proposal_intent: ProposalIntent | null;
} | null> {
  const db = client ?? serviceClient;
  const { data, error } = await db
    .from("researchers")
    .select(
      "id, slug, name, cv_text, enriched_profile, pipeline_state, publications_md, match_results_md, scholar_candidate, proposal_intent"
    )
    .eq("slug", slug)
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    cv_text: data.cv_text ?? null,
    enriched_profile: (data.enriched_profile as ResearcherProfile) ?? null,
    pipeline_state: (data.pipeline_state as Record<string, unknown>) ?? {},
    publications_md: data.publications_md ?? null,
    match_results_md: data.match_results_md ?? null,
    scholar_candidate: (data.scholar_candidate as Record<string, unknown>) ?? null,
    proposal_intent: (data.proposal_intent as ProposalIntent) ?? null,
  };
}

/**
 * Fetch only the fields needed for opportunity retrieval.
 */
export async function getResearcherForMatching(slug: string, userId: string): Promise<{
  profile_embedding: number[] | null;
  research_themes: string[];
  research_keywords: string[];
}> {
  const { data, error } = await serviceClient
    .from("researchers")
    .select("profile_embedding, research_themes, research_keywords")
    .eq("slug", slug)
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(error.message);
  return {
    profile_embedding: data.profile_embedding ?? null,
    research_themes: data.research_themes ?? [],
    research_keywords: data.research_keywords ?? [],
  };
}
