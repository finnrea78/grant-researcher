import { supabase } from "@grant-researcher/db";
import type { NormalisedGrant, RunCounters } from "../types.js";

export async function upsertGrants(
  grants: NormalisedGrant[],
  funderMap: Map<string, { id: string; name: string }>
): Promise<RunCounters> {
  const counters: RunCounters = { created: 0, updated: 0, skipped: 0 };

  for (const grant of grants) {
    const funderInfo = funderMap.get(grant.funder_slug);
    if (!funderInfo) {
      console.warn(`Skipping grant "${grant.name}": unknown funder slug "${grant.funder_slug}"`);
      counters.skipped++;
      continue;
    }

    const row = {
      funder_id: funderInfo.id,
      name: grant.name,
      slug: grant.slug,
      grant_reference: grant.grant_reference,
      status: grant.status,
      abstract: grant.abstract,
      technical_summary: grant.technical_summary,
      impact_text: grant.impact_text,
      grant_category: grant.grant_category,
      fund_start: grant.fund_start,
      fund_end: grant.fund_end,
      amount: grant.amount,
      amount_currency: grant.amount_currency,
      url: grant.url,
      source: grant.source,
      source_metadata: grant.source_metadata,
    };

    // Use grant_reference as the unique key when available.
    // For records without a grant_reference, fall back to slug alone
    // (GtR records can share titles across councils so funder+slug is not unique).
    const result = grant.grant_reference
      ? await supabase
          .from("awarded_grants")
          .upsert(row, { onConflict: "grant_reference" })
          .select("id, created_at, updated_at")
          .single()
      : await supabase
          .from("awarded_grants")
          .upsert(row, { onConflict: "slug" })
          .select("id, created_at, updated_at")
          .single();

    if (result.error) {
      // 23505 = unique_violation — expected duplicate within batch, skip silently
      if (result.error.code !== "23505") {
        console.error(`Failed to upsert grant "${grant.name}": ${result.error.message}`);
      }
      counters.skipped++;
      continue;
    }

    const grantId = result.data.id;
    const wasCreated = result.data.created_at === result.data.updated_at;
    if (wasCreated) counters.created++;
    else counters.updated++;

    // Upsert classifications: delete existing, re-insert
    if (grant.classifications.length > 0) {
      await supabase.from("grant_classifications").delete().eq("awarded_grant_id", grantId);

      const classRows = grant.classifications.map((c) => ({
        awarded_grant_id: grantId,
        type: c.type,
        name: c.name,
        percentage: c.percentage,
      }));

      const { error: classError } = await supabase.from("grant_classifications").insert(classRows);
      if (classError) {
        console.error(`Failed to insert classifications for "${grant.name}": ${classError.message}`);
      }
    }
  }

  return counters;
}
