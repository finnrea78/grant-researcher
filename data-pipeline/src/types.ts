export type OpportunitySource =
  | "ukri_funding_finder"
  | "web_scrape"
  | "find_a_grant"
  | "wellcome"
  | "leverhulme"
  | "royal_society"
  | "nuffield"
  | "wolfson"
  | "heritage_fund"
  | "carnegie_trust"
  | "henry_moore"
  | "erc"
  | "msca"
  | "hias_hamburg"
  | "netias"
  | "innovate_uk"
  | "blood_cancer_uk"
  | "newton_fellowship"
  | "rse"
  | "action_medical"
  | "vivensa_foundation"
  | "embo"
  | "hfsp"
  | "biochemical_society"
  | "humboldt_foundation"
  | "geolsoc"
  | "acmedsci"
  | "rgs"
  | "bps"
  | "genetics_society"
  | "microbiology_society"
  | "royensoc"
  | "lms"
  | "physoc"
  | "ima"
  | "eseb"
  | "endocrinology"
  | "royal_historical_society"
  | "royal_commission_1851"
  | "asab";

/** Shape written to the opportunities table (open funding calls). */
export interface NormalisedOpportunity {
  funder_slug: string;
  funder_name?: string | null;
  name: string;
  slug: string;
  status: string | null;
  deadline_raw: string | null;
  deadline_date: string | null;
  amount_raw: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string;
  url: string | null;
  funding_type: string | null;
  description: string | null;
  eligibility: string | null;
  scope: string | null;
  source: OpportunitySource;
  source_metadata: Record<string, unknown>;
}

/** Shape written to the awarded_grants table (historical funded projects — GtR). */
export interface NormalisedGrant {
  funder_slug: string;
  name: string;
  slug: string;
  grant_reference: string | null;
  status: string | null;
  abstract: string | null;
  technical_summary: string | null;
  impact_text: string | null;
  grant_category: string | null;
  fund_start: string | null;   // ISO date string
  fund_end: string | null;     // ISO date string
  amount: number | null;       // in GBP pounds (GtR valuePounds)
  amount_currency: string;
  url: string | null;
  source: "gtr";
  source_metadata: Record<string, unknown>;
  classifications: Classification[];
}

export interface Classification {
  type: string;
  name: string;
  percentage: number | null;
}

/** Counters tracked during an ingestion run. */
export interface RunCounters {
  created: number;
  updated: number;
  skipped: number;
}

/** Paginated response from GET /gtr/api/projects (JSON via Accept: application/json). */
export interface GtrApiResponse {
  page: number;
  size: number;
  totalPages: number;
  totalSize: number;
  project: GtrProject | GtrProject[]; // single item comes back as object, not array
}

/** A project record from the GtR REST API list endpoint. */
export interface GtrProject {
  id: string;
  title: string;
  status?: string;
  grantCategory?: string;
  leadFunder?: string;
  abstractText?: string;
  technicalSummary?: string;
  potentialImpactText?: string;
  valuePounds?: number;
  /**
   * Fund start/end dates. These may be present in some API responses.
   * The field is optional — values may be null in practice.
   * A follow-up enrichment step can populate these from project detail endpoints.
   */
  fund?: {
    start?: string;
    end?: string;
  };
  identifiers?: {
    identifier: GtrIdentifier | GtrIdentifier[];
  };
  researchSubjects?: { researchSubject?: GtrClassificationItem | GtrClassificationItem[] };
  researchTopics?: { researchTopic?: GtrClassificationItem | GtrClassificationItem[] };
  healthCategories?: { healthCategory?: GtrClassificationItem | GtrClassificationItem[] };
}

export interface GtrIdentifier {
  value: string;
  type: string;
}

export interface GtrClassificationItem {
  text?: string;
  percentage?: number;
}
