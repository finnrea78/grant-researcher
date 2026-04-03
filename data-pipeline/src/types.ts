/** Shape written to the schemes table. All source connectors produce this. */
export interface NormalisedScheme {
  funder_slug: string;
  name: string;
  slug: string;
  status: string | null;
  deadline_raw: string | null;
  deadline_date: string | null; // ISO date string or null
  amount_raw: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string;
  duration: string | null;
  career_stage: string | null;
  institutional_eligibility: string | null;
  thematic_priorities: string | null;
  application_process: string | null;
  url: string | null;
  grant_reference: string | null;
  source: "gtr" | "ukri_funding_finder" | "web_scrape";
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
