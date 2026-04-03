// data-pipeline/src/loaders/log-run.ts
import { supabase } from "@grant-researcher/db";
import type { RunCounters } from "../types.js";

/** Start a new ingestion run. Returns the run ID. */
export async function startRun(source: string, funderSlug?: string): Promise<string> {
  const { data, error } = await supabase
    .from("ingestion_runs")
    .insert({
      source,
      funder_slug: funderSlug ?? null,
      status: "running",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to start run: ${error.message}`);
  return data.id;
}

/** Complete an ingestion run with final status and counters. */
export async function completeRun(
  runId: string,
  status: "success" | "failed" | "partial",
  counters: RunCounters,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from("ingestion_runs")
    .update({
      status,
      records_created: counters.created,
      records_updated: counters.updated,
      records_skipped: counters.skipped,
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) console.error(`Failed to complete run ${runId}: ${error.message}`);
}
