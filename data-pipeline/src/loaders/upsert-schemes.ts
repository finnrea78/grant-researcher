// data-pipeline/src/loaders/upsert-schemes.ts
import { supabase } from "../db.js";
import type { NormalisedScheme, RunCounters } from "../types.js";
import { upsertFunder } from "./upsert-funder.js";

/**
 * Upsert a batch of normalised schemes into the database.
 * Resolves funder_id from funder_slug, inserts classifications.
 */
export async function upsertSchemes(
  schemes: NormalisedScheme[],
  funderMap: Map<string, { id: string; name: string }>
): Promise<RunCounters> {
  const counters: RunCounters = { created: 0, updated: 0, skipped: 0 };

  for (const scheme of schemes) {
    const funderInfo = funderMap.get(scheme.funder_slug);
    if (!funderInfo) {
      console.warn(`Skipping scheme "${scheme.name}": unknown funder slug "${scheme.funder_slug}"`);
      counters.skipped++;
      continue;
    }

    const row = {
      funder_id: funderInfo.id,
      name: scheme.name,
      slug: scheme.slug,
      status: scheme.status,
      deadline_raw: scheme.deadline_raw,
      deadline_date: scheme.deadline_date,
      amount_raw: scheme.amount_raw,
      amount_min: scheme.amount_min,
      amount_max: scheme.amount_max,
      amount_currency: scheme.amount_currency,
      duration: scheme.duration,
      career_stage: scheme.career_stage,
      institutional_eligibility: scheme.institutional_eligibility,
      thematic_priorities: scheme.thematic_priorities,
      application_process: scheme.application_process,
      url: scheme.url,
      grant_reference: scheme.grant_reference,
      source: scheme.source,
      source_metadata: scheme.source_metadata,
    };

    // Upsert the scheme. Use grant_reference for GtR, (funder_id, slug) for others.
    let result;
    if (scheme.grant_reference) {
      result = await supabase
        .from("schemes")
        .upsert(row, { onConflict: "grant_reference" })
        .select("id, created_at, updated_at")
        .single();
    } else {
      result = await supabase
        .from("schemes")
        .upsert(row, { onConflict: "funder_id,slug" })
        .select("id, created_at, updated_at")
        .single();
    }

    if (result.error) {
      // 23505 = unique_violation — expected duplicate within batch, skip silently
      if (result.error.code !== "23505") {
        console.error(`Failed to upsert scheme "${scheme.name}": ${result.error.message}`);
      }
      counters.skipped++;
      continue;
    }

    const schemeId = result.data.id;
    const wasCreated = result.data.created_at === result.data.updated_at;
    if (wasCreated) counters.created++;
    else counters.updated++;

    // Upsert classifications: delete existing, re-insert
    if (scheme.classifications.length > 0) {
      await supabase
        .from("scheme_classifications")
        .delete()
        .eq("scheme_id", schemeId);

      const classRows = scheme.classifications.map((c) => ({
        scheme_id: schemeId,
        type: c.type,
        name: c.name,
        percentage: c.percentage,
      }));

      const { error: classError } = await supabase
        .from("scheme_classifications")
        .insert(classRows);

      if (classError) {
        console.error(`Failed to insert classifications for "${scheme.name}": ${classError.message}`);
      }
    }
  }

  return counters;
}
