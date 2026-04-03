// Server-only module — only import in Next.js API routes, not client components.
import { supabase } from "@/lib/supabase";
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
