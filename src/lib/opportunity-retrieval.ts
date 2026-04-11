// src/lib/opportunity-retrieval.ts
// Server-only — only import in Next.js API routes.
import { supabase } from "@/lib/supabase";
import { getResearcherForMatching } from "@/lib/researcher-store";

export interface CandidateOpportunity {
  id: string;
  funder_id: string;
  name: string;
  slug: string;
  status: string | null;
  description: string | null;
  eligibility: string | null;
  scope: string | null;
  amount_raw: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string;
  deadline_raw: string | null;
  deadline_date: string | null;
  url: string | null;
  funding_type: string | null;
  source: string;
}

/**
 * Build a to_tsquery-compatible OR string from researcher terms.
 * Each multi-word term is split into individual words joined with |.
 * Example: ["climate change", "marine"] → "climate | change | marine"
 */
export function buildTsquery(themes: string[], keywords: string[]): string {
  const words = [...themes, ...keywords]
    .flatMap((t) => t.toLowerCase().split(/\s+/))
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2);
  const unique = [...new Set(words)];
  return unique.join(" | ");
}

/**
 * Trim a candidate for context-window efficiency: strip null fields and truncate
 * the three large text fields to 500 chars each. Reduces match-stage token usage
 * from ~50-100K → ~15-25K tokens per turn.
 */
function trimCandidate(c: CandidateOpportunity): Partial<CandidateOpportunity> {
  const truncate = (s: string | null, max = 500): string | null =>
    s ? s.slice(0, max) : null;

  const trimmed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (v === null) continue; // strip null fields
    trimmed[k] = v;
  }
  trimmed.description = truncate(c.description);
  if (trimmed.description === null) delete trimmed.description;
  trimmed.scope = truncate(c.scope);
  if (trimmed.scope === null) delete trimmed.scope;
  trimmed.eligibility = truncate(c.eligibility);
  if (trimmed.eligibility === null) delete trimmed.eligibility;

  return trimmed as Partial<CandidateOpportunity>;
}

/**
 * Retrieve up to `limit` candidate opportunities using hybrid retrieval:
 * 1. pgvector cosine similarity (if researcher has profile_embedding)
 * 2. tsvector full-text search (always, as belt-and-braces)
 * Results are unioned, deduplicated by id, and trimmed for token efficiency.
 */
export async function retrieveCandidates(
  researcherSlug: string,
  limit = 75
): Promise<Partial<CandidateOpportunity>[]> {
  const researcher = await getResearcherForMatching(researcherSlug);
  const seen = new Map<string, CandidateOpportunity>();

  // ── pgvector path ────────────────────────────────────────────────────────────
  if (researcher.profile_embedding) {
    const { data, error } = await supabase.rpc("match_opportunities", {
      query_embedding: researcher.profile_embedding,
      match_threshold: 0.2,
      match_count: 100,
    });
    if (error) console.warn("[retrieval] pgvector error:", error.message);
    if (data) {
      for (const row of data as CandidateOpportunity[]) {
        if (!seen.has(row.id)) seen.set(row.id, row);
      }
    }
  }

  // ── tsvector path ────────────────────────────────────────────────────────────
  const searchQuery = buildTsquery(
    researcher.research_themes,
    researcher.research_keywords
  );
  if (searchQuery) {
    const { data, error } = await supabase.rpc("search_opportunities_fts", {
      search_query: searchQuery,
      match_count: 100,
    });
    if (error) console.warn("[retrieval] tsvector error:", error.message);
    if (data) {
      for (const row of data as CandidateOpportunity[]) {
        if (!seen.has(row.id)) seen.set(row.id, row);
      }
    }
  }

  return [...seen.values()].slice(0, limit).map(trimCandidate);
}
