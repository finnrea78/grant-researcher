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

/** Shape of a funder row for upsert. */
export interface FunderRow {
  slug: string;
  name: string;
  website: string | null;
  type: string | null;
  disciplines: string[];
  source_metadata: Record<string, unknown>;
}

/** Counters tracked during an ingestion run. */
export interface RunCounters {
  created: number;
  updated: number;
  skipped: number;
}

/** Raw GtR search API response shape (subset of fields we use). */
export interface GtrSearchResponse {
  searchResult: {
    results: {
      projectOverview?: GtrProjectOverview[];
    };
  };
}

export interface GtrProjectOverview {
  projectComposition: {
    project: {
      title: string;
      status: string;
      grantCategory: string;
      abstractText?: string;
      technicalSummary?: string;
      potentialImpactText?: string;
      fund: {
        funder: { name: string };
        valuePounds: number;
        start?: string;
        end?: string;
        type?: string;
      };
      researchSubjects?: GtrClassification;
      researchTopics?: GtrClassification;
      healthCategories?: GtrClassification;
      rcukProgrammes?: GtrClassification;
      identifiers?: { identifier: { value: string; type: string }[] };
    };
    leadResearchOrganisation?: { name: string };
    personRoles?: {
      personRole: {
        firstName?: string;
        surname?: string;
        roles?: { role: { name: string }[] };
      }[];
    };
  };
}

export interface GtrClassification {
  classification?: {
    text: string;
    percentage?: number;
  }[];
}
