import { supabase } from "@grant-researcher/db";
import type { NormalisedOpportunity, RunCounters } from "../types.js";

export async function upsertOpportunities(
  opportunities: NormalisedOpportunity[],
  funderMap: Map<string, { id: string; name: string }>
): Promise<RunCounters> {
  const counters: RunCounters = { created: 0, updated: 0, skipped: 0 };

  for (const opp of opportunities) {
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
      source: opp.source,
      source_metadata: opp.source_metadata,
    };

    const result = await supabase
      .from("opportunities")
      .upsert(row, { onConflict: "funder_id,slug" })
      .select("id, created_at, updated_at")
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
  }

  return counters;
}
