// data-pipeline/src/loaders/upsert-opportunities.ts
import { supabase } from "@grant-researcher/db";
import { buildOpportunityText, embedText } from "../lib/embedder.js";
import type { NormalisedOpportunity, RunCounters } from "../types.js";

/** Returns false for opportunities that are definitively closed/expired/inactive. */
function isActive(status: string | null): boolean {
  if (!status) return true;
  const s = status.toLowerCase().trim();
  return !["closed", "paused", "concluded", "expired", "inactive"].includes(s);
}

export async function upsertOpportunities(
  opportunities: NormalisedOpportunity[],
  funderMap: Map<string, { id: string; name: string }>
): Promise<RunCounters> {
  const counters: RunCounters = { created: 0, updated: 0, skipped: 0 };

  if (opportunities.length === 0) return counters;

  const source = opportunities[0].source;

  // Only write active opportunities to the DB.
  const active = opportunities.filter((o) => isActive(o.status));
  const activeSlugs = active.map((o) => o.slug);

  for (const opp of active) {
    const funderInfo = funderMap.get(opp.funder_slug);
    if (!funderInfo) {
      console.warn(`Skipping opportunity "${opp.name}": unknown funder slug "${opp.funder_slug}"`);
      counters.skipped++;
      continue;
    }

    const row = {
      funder_id: funderInfo.id,
      name: opp.name,
      slug: opp.slug,
      status: opp.status,
      deadline_raw: opp.deadline_raw,
      deadline_date: opp.deadline_date,
      amount_raw: opp.amount_raw,
      amount_min: opp.amount_min,
      amount_max: opp.amount_max,
      amount_currency: opp.amount_currency,
      url: opp.url,
      funding_type: opp.funding_type,
      description: opp.description,
      eligibility: opp.eligibility,
      scope: opp.scope,
      source: opp.source,
      source_metadata: opp.source_metadata,
    };

    const result = await supabase
      .from("opportunities")
      .upsert(row, { onConflict: "funder_id,slug" })
      .select("id, created_at, updated_at, embedding")
      .single();

    if (result.error) {
      // 23505 = unique_violation — expected duplicate within batch, skip silently
      if (result.error.code !== "23505") {
        console.error(`Failed to upsert opportunity "${opp.name}": ${result.error.message}`);
      }
      counters.skipped++;
      continue;
    }

    const wasCreated = result.data.created_at === result.data.updated_at;
    if (wasCreated) counters.created++;
    else counters.updated++;

    // Compute and store embedding only if not already present
    if (!result.data.embedding) {
      try {
        const text = buildOpportunityText(opp);
        const embedding = await embedText(text);
        await supabase
          .from("opportunities")
          .update({ embedding })
          .eq("id", result.data.id);
      } catch (err) {
        console.warn(`Failed to embed opportunity "${opp.name}": ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Remove stale rows: any DB row for this source whose slug is no longer in the
  // current active batch (went closed, expired, or was removed from the source).
  if (activeSlugs.length > 0) {
    const { error: deleteError, count } = await supabase
      .from("opportunities")
      .delete({ count: "exact" })
      .eq("source", source)
      .not("slug", "in", `(${activeSlugs.join(",")})`);
    if (deleteError) {
      console.warn(`  Warning: failed to delete stale rows for source "${source}": ${deleteError.message}`);
    } else if (count && count > 0) {
      console.log(`  Removed ${count} stale/closed row(s) for source "${source}"`);
    }
  } else {
    // All opportunities closed — clear the entire source from the DB.
    const { error: deleteError, count } = await supabase
      .from("opportunities")
      .delete({ count: "exact" })
      .eq("source", source);
    if (deleteError) {
      console.warn(`  Warning: failed to clear source "${source}": ${deleteError.message}`);
    } else if (count && count > 0) {
      console.log(`  Removed ${count} row(s) — all opportunities for source "${source}" are now closed`);
    }
  }

  return counters;
}
