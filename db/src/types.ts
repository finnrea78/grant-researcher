/** Shape of a funder row for upsert. */
export interface FunderRow {
  slug: string;
  name: string;
  website: string | null;
  type: string | null;
  disciplines: string[];
  source_metadata: Record<string, unknown>;
}

/** Shape of a researcher row for upsert. Populated fully in Phase 2. */
export interface ResearcherRow {
  slug: string;
  name: string;
  [key: string]: unknown;
}
