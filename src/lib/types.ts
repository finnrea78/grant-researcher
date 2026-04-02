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
}

export interface IntakeData {
  google_scholar_url?: string;
  future_research?: string;
}

export interface ScholarCandidate {
  candidate_url: string;
  candidate_confidence: "high" | "medium";
}

export interface HarvestTimestamps {
  [funder: string]: string; // ISO date string
}
