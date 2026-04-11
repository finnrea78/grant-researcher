import type {
  EligibilityConstraints,
  ResearcherProfile,
} from "../../src/lib/types";

/** Shape of a funder row for upsert. */
export interface FunderRow {
  slug: string;
  name: string;
  website: string | null;
  type: string | null;
  disciplines: string[];
  source_metadata: Record<string, unknown>;
  // Discovery tracking (added in migration 006)
  source_url?: string | null;
  discovered_by?: 'manual' | 'pipeline' | 'agentic_scan';
  discovery_context?: Record<string, unknown>;
  last_harvested_at?: string | null;
  last_harvest_status?: string | null;
  harvest_count?: number;
}

/** Shape of a researcher_proposals row. */
export interface ResearcherProposalRow {
  id: string;
  researcher_id: string;
  funder_slug: string;
  scheme_slug: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** Shape of a researcher row for upsert. */
export interface ResearcherRow {
  slug: string;
  user_id?: string;
  name: string;
  email?: string;
  orcid?: string;
  google_scholar_url?: string;
  researcher_id?: string;
  scopus_author_id?: string;
  institutional_profile_url?: string;
  institution?: string;
  department?: string;
  institution_country?: string;
  career_stage?: string;
  research_themes?: string[];
  research_keywords?: string[];
  eligibility?: EligibilityConstraints;
  cv_text?: string;
  orcid_data?: Record<string, unknown>;
  orcid_fetched_at?: string;
  enriched_profile?: ResearcherProfile;
  enriched_at?: string;
  intake_source?: string;
  intake_completed_at?: string;
}
