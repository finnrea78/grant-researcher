import { readFile } from "fs/promises";
import type { NormalisedOpportunity, RunCounters } from "../types.js";
import { upsertFunder } from "./upsert-funder.js";
import { upsertOpportunities } from "./upsert-opportunities.js";
import { startRun, completeRun } from "./log-run.js";

export interface AgentJsonPayload {
  source: string;
  funder: {
    slug: string;
    name: string;
    url?: string | null;
  };
  opportunities: Array<Omit<NormalisedOpportunity, "source"> & { source: string }>;
}

export async function ingestFromJson(filePath: string): Promise<RunCounters> {
  const raw = JSON.parse(await readFile(filePath, "utf-8")) as AgentJsonPayload;

  const { source, funder, opportunities } = raw;
  if (!source || !funder?.slug || !Array.isArray(opportunities)) {
    throw new Error("Invalid JSON payload: must have source, funder.slug, and opportunities[]");
  }

  console.log(`\nIngesting ${opportunities.length} opportunities from ${funder.name ?? funder.slug} (${source})`);

  const runId = await startRun(source, funder.slug);
  try {
    const funderId = await upsertFunder({
      slug: funder.slug,
      name: funder.name ?? funder.slug,
      website: funder.url ?? null,
      type: null,
      disciplines: [],
      source_metadata: {},
    });

    const funderMap = new Map([[funder.slug, { id: funderId, name: funder.name ?? funder.slug }]]);
    const counters = await upsertOpportunities(opportunities as NormalisedOpportunity[], funderMap);

    console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
    await completeRun(runId, "success", counters);
    return counters;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Error: ${msg}`);
    await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
    throw err;
  }
}
