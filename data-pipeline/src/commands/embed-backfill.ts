// data-pipeline/src/commands/embed-backfill.ts
import { supabase } from "@grant-researcher/db";
import { buildOpportunityText, embedText } from "../lib/embedder.js";

interface BackfillOptions {
  batchSize?: number;
}

interface BackfillResult {
  embedded: number;
  skipped: number;
}

export async function embedBackfill({ batchSize = 100 }: BackfillOptions = {}): Promise<BackfillResult> {
  let embedded = 0;
  let skipped = 0;

  while (true) {
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, name, description, scope, eligibility")
      .is("embedding", null)
      .limit(batchSize);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const opp of data) {
      try {
        const text = buildOpportunityText(opp);
        const embedding = await embedText(text);
        const { error: updateErr } = await supabase
          .from("opportunities")
          .update({ embedding })
          .eq("id", opp.id);
        if (updateErr) {
          console.warn(`Failed to store embedding for ${opp.id}: ${updateErr.message}`);
          skipped++;
        } else {
          embedded++;
        }
      } catch (err) {
        console.warn(`Failed to embed ${opp.name}: ${err instanceof Error ? err.message : err}`);
        skipped++;
      }
    }

    // If batch returned fewer than batchSize, we've processed all
    if (data.length < batchSize) break;
  }

  return { embedded, skipped };
}
