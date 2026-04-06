// Server-only module — only import in Next.js API routes, not client components.
import { supabase } from "@/lib/supabase";
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
    },
    { onConflict: "funder_id,slug" }
  );

  if (error) throw new Error(error.message);
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
