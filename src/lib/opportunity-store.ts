// Server-only module — only import in Next.js API routes, not client components.
import { supabase } from "@/lib/supabase";
import { embedText } from "@/lib/embedder";
import type { DiscoveredFunder, DiscoveredOpportunity } from "@/lib/types";

// ─── Reading ──────────────────────────────────────────────────────────────────

/** Return all funder slugs currently in the DB (for dedup before agentic scan). */
export async function getExistingFunderSlugs(): Promise<string[]> {
  const { data, error } = await supabase.from("funders").select("slug");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { slug: string }) => r.slug);
}

/** Return open opportunities, optionally filtered to a single funder slug. */
export async function getExistingOpportunities(
  funderSlug?: string
): Promise<unknown[]> {
  let query = supabase
    .from("opportunities")
    .select("*, funder:funders(slug, name)")
    .or("status.eq.open,status.is.null")
    .or("deadline_date.is.null,deadline_date.gt." + new Date().toISOString().slice(0, 10));

  if (funderSlug) {
    query = query.eq("funders.slug", funderSlug);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Return funders that have a source_url, split into two lists:
 * - `toHarvest`: not yet harvested, or last harvested more than `staleDays` ago
 * - `fresh`: harvested within `staleDays` — skip re-fetching, use for dedup only
 */
export async function getFunderSourceUrls(staleDays = 7): Promise<{
  toHarvest: Array<{ slug: string; url: string }>;
  fresh: Array<{ slug: string; url: string }>;
}> {
  const { data, error } = await supabase
    .from("funders")
    .select("slug, source_url, last_harvested_at")
    .not("source_url", "is", null);

  if (error) throw new Error(error.message);

  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const toHarvest: Array<{ slug: string; url: string }> = [];
  const fresh: Array<{ slug: string; url: string }> = [];

  for (const r of data ?? []) {
    const entry = { slug: r.slug, url: r.source_url as string };
    const harvested = r.last_harvested_at ? new Date(r.last_harvested_at) : null;
    if (harvested && harvested > cutoff) {
      fresh.push(entry);
    } else {
      toHarvest.push(entry);
    }
  }

  return { toHarvest, fresh };
}

// ─── Writing ──────────────────────────────────────────────────────────────────

/**
 * Upsert a funder discovered by an agentic scan.
 * Does not overwrite `discovered_by` if the funder was already found by the
 * pipeline (pipeline > agentic_scan in provenance hierarchy).
 * Returns the funder's UUID.
 */
export async function upsertFunderFromDiscovery(
  funder: DiscoveredFunder
): Promise<string> {
  const { data, error } = await supabase
    .from("funders")
    .upsert(
      {
        slug: funder.slug,
        name: funder.name,
        website: funder.website,
        source_url: funder.source_url,
        disciplines: funder.disciplines,
        discovered_by: funder.discovered_by,
        discovery_context: funder.discovery_context ?? {},
        source_metadata: {},
        type: null,
      },
      {
        onConflict: "slug",
        // ignoreDuplicates keeps the existing row for conflicting columns
        // We use a column list that excludes discovered_by so pipeline-sourced
        // funders keep their provenance.
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Upsert an opportunity discovered by an agentic scan.
 * Will not overwrite opportunities that came from higher-priority sources
 * (ukri_funding_finder, gtr) via the onConflict DO UPDATE WHERE clause.
 */
export async function upsertOpportunityFromDiscovery(
  opp: DiscoveredOpportunity,
  funderId: string
): Promise<void> {
  // Build embedding from available text fields
  let embedding: number[] | null = null;
  const embeddingText = [opp.name, opp.description, opp.scope, opp.eligibility]
    .filter(Boolean)
    .join("\n");
  if (embeddingText) {
    try {
      embedding = await embedText(embeddingText);
    } catch (err) {
      console.error(`[opportunity-store] embedding failed for ${opp.slug}:`, err);
    }
  }

  const { error } = await supabase.from("opportunities").upsert(
    {
      funder_id: funderId,
      name: opp.name,
      slug: opp.slug,
      status: opp.status,
      deadline_raw: opp.deadline_raw,
      deadline_date: opp.deadline_date,
      amount_raw: opp.amount_raw,
      amount_min: opp.amount_min,
      amount_max: opp.amount_max,
      url: opp.url,
      funding_type: opp.funding_type,
      description: opp.description,
      eligibility: opp.eligibility,
      scope: opp.scope,
      source: "agentic_scan",
      ...(embedding ? { embedding } : {}),
    },
    { onConflict: "funder_id,slug" }
  );

  if (error) throw new Error(error.message);
}

/**
 * Fetch a single opportunity by funder slug and opportunity name.
 * Used by the propose route to pull scheme details from the DB.
 */
export async function getOpportunityByFunderAndName(
  funderIdentifier: string,
  opportunityName: string
): Promise<{
  name: string;
  description: string | null;
  scope: string | null;
  eligibility: string | null;
  url: string | null;
  funding_type: string | null;
  deadline_date: string | null;
  deadline_raw: string | null;
  amount_raw: string | null;
  status: string | null;
  funder_name: string;
  funder_website: string | null;
  funder_source_url: string | null;
} | null> {
  // Step 1: resolve funder_id by slug (lowercased) or by name (case-insensitive)
  const slug = funderIdentifier.toLowerCase().replace(/\s+/g, "-");
  let { data: funderRow } = await supabase
    .from("funders")
    .select("id, name, website, source_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!funderRow) {
    // Fall back to name ilike (handles "AHRC", "Wellcome Trust", etc.)
    const { data } = await supabase
      .from("funders")
      .select("id, name, website, source_url")
      .ilike("name", `%${funderIdentifier}%`)
      .limit(1)
      .maybeSingle();
    funderRow = data;
  }

  if (!funderRow) return null;

  // Step 2: find opportunity by funder_id + name (case-insensitive)
  const { data: opp } = await supabase
    .from("opportunities")
    .select("name, description, scope, eligibility, url, funding_type, deadline_date, deadline_raw, amount_raw, status")
    .eq("funder_id", funderRow.id)
    .ilike("name", opportunityName)
    .limit(1)
    .maybeSingle();

  if (!opp) return null;

  return {
    name: opp.name,
    description: opp.description,
    scope: opp.scope,
    eligibility: opp.eligibility,
    url: opp.url,
    funding_type: opp.funding_type,
    deadline_date: opp.deadline_date,
    deadline_raw: opp.deadline_raw,
    amount_raw: opp.amount_raw,
    status: opp.status,
    funder_name: funderRow.name,
    funder_website: funderRow.website,
    funder_source_url: funderRow.source_url,
  };
}

/** Update harvest tracking fields on a funder after a scan completes. */
export async function updateHarvestStatus(
  funderSlug: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from("funders")
    .update({
      last_harvested_at: new Date().toISOString(),
      last_harvest_status: status,
    })
    .eq("slug", funderSlug);

  if (error) throw new Error(error.message);
}
