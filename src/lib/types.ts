// TypeScript interfaces for the researcher profile and related data shapes.

export interface Publication {
  title: string;
  year: number;
  type: "book" | "chapter" | "journal_article" | "review" | "catalogue" | "other";
  journal_or_publisher: string;
  themes: string[];
}

export interface PriorGrant {
  funder: string;
  scheme: string;
  amount_gbp: number;
  year: number;
  role: "PI" | "CoI" | "fellow" | "team_member";
  project_title: string;
}

export interface PhDSupervision {
  current: number;
  completed: number;
  topics: string[];
}

export interface CurrentProject {
  title: string;
  description: string;
}

export interface ResearcherProfile {
  name: string;
  title: string;
  career_stage: "early" | "mid" | "established" | "senior";
  institution: string;
  department: string;
  country: string;
  research_themes: string[];
  research_keywords: string[];
  geographic_focus: string[];
  disciplinary_fields: string[];
  current_projects: CurrentProject[];
  publications: Publication[];
  prior_grants: PriorGrant[];
  phd_supervision: PhDSupervision;
  external_roles: string[];
  exhibitions_curated: string[];
  conference_papers: string[];
  key_strengths: string[];
  potential_gaps: string[];
  // Enrichment fields — added by the Enrich stage, not the profile agent
  google_scholar_url?: string;
  future_research?: string;
  scholar_h_index?: number;
  scholar_citation_count?: number;
  retrieval_summary?: string; // Claude-generated prose for semantic embedding
  // New intake-derived fields
  orcid?: string;
  funding_goals?: FundingGoals;
  collaboration?: CollaborationProfile;
  eligibility?: EligibilityConstraints;
  research_trajectory?: string;
}

export interface ResearcherIdentifiers {
  orcid?: string;
  google_scholar_url?: string;
  researcher_id?: string;
  scopus_author_id?: string;
  institutional_profile_url?: string;
}

export interface EligibilityConstraints {
  employment_type?: 'permanent' | 'fixed_term' | 'independent' | 'postdoc' | 'phd_student';
  phd_year?: number;
  nationality?: string[];
  institution_country?: string;
  institution_type?: 'university' | 'research_institute' | 'hospital' | 'ngo' | 'industry';
}

export interface FundingGoals {
  intended_use?: (
    | 'phd_students'
    | 'postdocs'
    | 'equipment'
    | 'travel'
    | 'research_time'
    | 'collaboration'
    | 'public_engagement'
  )[];
  budget_range?: { min?: number; max?: number; currency?: string };
  preferred_duration_months?: number;
  open_to_consortium?: boolean;
}

export interface CollaborationProfile {
  open_to_collaboration?: boolean;
  collaboration_types?: ('industry' | 'academic' | 'international' | 'public_sector' | 'ngo')[];
  preferred_roles?: ('PI' | 'Co-I' | 'partner')[];
}

export interface ProposalIntent {
  project_title?: string;
  description?: string;
  target_discipline?: string;
  methodology?: string;
}

export interface IntakeData {
  // Core identity
  name?: string;
  identifiers?: ResearcherIdentifiers;

  // Career
  institution?: string;
  department?: string;
  institution_country?: string;
  career_stage?: 'phd_student' | 'postdoc' | 'early_career' | 'mid_career' | 'senior';

  // Research
  research_themes?: string[];
  research_keywords?: string[];
  disciplinary_fields?: string[];
  geographic_focus?: string[];
  future_research?: string;
  research_trajectory?: string;

  // Funding
  funding_goals?: FundingGoals;

  // Collaboration
  collaboration?: CollaborationProfile;

  // Eligibility (factual only)
  eligibility?: EligibilityConstraints;

  // Proposal intent (ephemeral — never synced to Supabase)
  proposal_intent?: ProposalIntent;

  // Optional CV text (extracted from uploaded file)
  cv_text?: string;
}

export interface ScholarCandidate {
  candidate_url: string;
  candidate_confidence: "high" | "medium";
}

export interface HarvestTimestamps {
  [funder: string]: string; // ISO date string
}

export interface DiscoveredFunder {
  slug: string;
  name: string;
  website: string | null;
  source_url: string;
  disciplines: string[];
  discovered_by: 'agentic_scan' | 'manual';
  discovery_context?: Record<string, unknown>;
}

export interface DiscoveredOpportunity {
  name: string;
  slug: string;
  status: string | null;
  deadline_raw: string | null;
  deadline_date: string | null;
  amount_raw: string | null;
  amount_min: number | null;
  amount_max: number | null;
  url: string | null;
  funding_type: string | null;
  description: string | null;
  eligibility: string | null;
  scope: string | null;
}
