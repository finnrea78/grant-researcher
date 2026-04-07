// Server-only module — only import in Next.js API routes, not client components.
import { supabase } from "@/lib/supabase";
import { embedText } from "@/lib/embedder";
import type { IntakeData, ResearcherProfile } from "@/lib/types";

/**
 * Upsert a researcher from intake form data. Returns the researcher's UUID.
 * Uses slug as the conflict key (matches session naming convention).
 */
export async function upsertResearcher(
  intake: IntakeData,
  slug: string
): Promise<string> {
  const row = {
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

  const { data, error } = await supabase
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
  const { error } = await supabase
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
  const { error } = await supabase
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
  const { error } = await supabase
    .from("researchers")
    .update({ profile_embedding })
    .eq("slug", slug);
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * List all researchers that have a completed enriched_profile (reusable for hydration).
 */
export async function listResearchersWithProfiles(): Promise<{ slug: string; name: string }[]> {
  const { data, error } = await supabase
    .from("researchers")
    .select("slug, name")
    .not("enriched_profile", "is", null)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { slug: string; name: string }) => ({ slug: r.slug, name: r.name }));
}

/**
 * Fetch a researcher by slug for filesystem hydration.
 * Returns null if not found or if enriched_profile is missing.
 */
export async function getResearcherBySlug(slug: string): Promise<{
  slug: string;
  name: string;
  enriched_profile: ResearcherProfile;
  cv_text?: string | null;
  institution?: string | null;
  department?: string | null;
  career_stage?: string | null;
  research_themes?: string[];
  research_keywords?: string[];
  disciplinary_fields?: string[];
  geographic_focus?: string[];
  future_research?: string | null;
  research_trajectory?: string | null;
  funding_goals?: Record<string, unknown>;
  collaboration?: Record<string, unknown>;
  eligibility?: Record<string, unknown>;
} | null> {
  const { data, error } = await supabase
    .from("researchers")
    .select(
      "slug, name, enriched_profile, cv_text, institution, department, career_stage, research_themes, research_keywords, disciplinary_fields, geographic_focus, future_research, research_trajectory, funding_goals, collaboration, eligibility"
    )
    .eq("slug", slug)
    .single();
  if (error || !data?.enriched_profile) return null;
  return {
    slug: data.slug,
    name: data.name,
    enriched_profile: data.enriched_profile as ResearcherProfile,
    cv_text: data.cv_text ?? null,
    institution: data.institution ?? null,
    department: data.department ?? null,
    career_stage: data.career_stage ?? null,
    research_themes: data.research_themes ?? [],
    research_keywords: data.research_keywords ?? [],
    disciplinary_fields: data.disciplinary_fields ?? [],
    geographic_focus: data.geographic_focus ?? [],
    future_research: data.future_research ?? null,
    research_trajectory: data.research_trajectory ?? null,
    funding_goals: data.funding_goals ?? {},
    collaboration: data.collaboration ?? {},
    eligibility: data.eligibility ?? {},
  };
}

/**
 * Fetch intake fields for a researcher by slug (no enriched_profile requirement).
 * Used by the profile route to read DB intake before enrichment has run.
 * Returns null if the researcher row does not exist.
 */
export async function getResearcherIntake(slug: string): Promise<{
  slug: string;
  name: string;
  cv_text: string | null;
  institution: string | null;
  department: string | null;
  career_stage: string | null;
  research_themes: string[];
  research_keywords: string[];
  disciplinary_fields: string[];
  geographic_focus: string[];
  future_research: string | null;
  research_trajectory: string | null;
  funding_goals: Record<string, unknown>;
  collaboration: Record<string, unknown>;
  eligibility: Record<string, unknown>;
} | null> {
  const { data, error } = await supabase
    .from("researchers")
    .select(
      "slug, name, cv_text, institution, department, career_stage, research_themes, research_keywords, disciplinary_fields, geographic_focus, future_research, research_trajectory, funding_goals, collaboration, eligibility"
    )
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return {
    slug: data.slug,
    name: data.name,
    cv_text: data.cv_text ?? null,
    institution: data.institution ?? null,
    department: data.department ?? null,
    career_stage: data.career_stage ?? null,
    research_themes: data.research_themes ?? [],
    research_keywords: data.research_keywords ?? [],
    disciplinary_fields: data.disciplinary_fields ?? [],
    geographic_focus: data.geographic_focus ?? [],
    future_research: data.future_research ?? null,
    research_trajectory: data.research_trajectory ?? null,
    funding_goals: data.funding_goals ?? {},
    collaboration: data.collaboration ?? {},
    eligibility: data.eligibility ?? {},
  };
}

/**
 * Fetch only the fields needed for opportunity retrieval.
 */
export async function getResearcherForMatching(slug: string): Promise<{
  profile_embedding: number[] | null;
  research_themes: string[];
  research_keywords: string[];
}> {
  const { data, error } = await supabase
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

/**
 * Mark a pipeline stage as complete in the researchers.pipeline_state JSONB column.
 * Reads current state first (JS client has no jsonb_set), then merges.
 */
export async function updatePipelineState(
  slug: string,
  stage: "profile" | "enrich" | "scan" | "match"
): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("researchers")
    .select("pipeline_state")
    .eq("slug", slug)
    .single();
  if (readErr) throw new Error(readErr.message);
  const current = (data?.pipeline_state as Record<string, boolean>) ?? {};
  const { error } = await supabase
    .from("researchers")
    .update({ pipeline_state: { ...current, [stage]: true } })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

/**
 * Store the Markdown publications list produced by the enrichment agent.
 */
export async function updatePublications(slug: string, md: string): Promise<void> {
  const { error } = await supabase
    .from("researchers")
    .update({ publications_md: md })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

/**
 * Store the Markdown match results produced by the matcher agent.
 */
export async function updateMatchResults(slug: string, md: string): Promise<void> {
  const { error } = await supabase
    .from("researchers")
    .update({ match_results_md: md })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

/**
 * Persist the confirmed Google Scholar candidate (or null to clear it).
 */
export async function updateScholarCandidate(
  slug: string,
  candidate: Record<string, unknown> | null
): Promise<void> {
  const { error } = await supabase
    .from("researchers")
    .update({ scholar_candidate: candidate })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

/**
 * Fetch the pipeline state, scholar candidate, and match results for a researcher.
 * Returns null when the researcher row does not exist.
 */
export async function getResearcherPipelineState(slug: string): Promise<{
  pipeline_state: Record<string, boolean>;
  scholar_candidate: Record<string, unknown> | null;
  match_results_md: string | null;
} | null> {
  const { data, error } = await supabase
    .from("researchers")
    .select("pipeline_state, scholar_candidate, match_results_md")
    .eq("slug", slug)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // researcher not found
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    pipeline_state: (data.pipeline_state as Record<string, boolean>) ?? {},
    scholar_candidate: data.scholar_candidate ?? null,
    match_results_md: data.match_results_md ?? null,
  };
}
