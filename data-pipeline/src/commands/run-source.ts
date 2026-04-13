// data-pipeline/src/commands/run-source.ts
import { upsertFunder } from "../loaders/upsert-funder.js";
import { upsertOpportunities } from "../loaders/upsert-opportunities.js";
import { startRun, completeRun } from "../loaders/log-run.js";
import type { NormalisedOpportunity, RunCounters } from "../types.js";

export interface SourceConfig {
  displayName: string;
  source: string;
  funderSlug?: string;
  fetch: () => Promise<NormalisedOpportunity[]>;
}

export async function ensureFunders(
  items: Array<{ funder_slug: string; funder_name?: string | null }>
): Promise<Map<string, { id: string; name: string }>> {
  const seen = new Map<string, string | null>();
  for (const item of items) {
    if (!seen.has(item.funder_slug)) {
      seen.set(item.funder_slug, item.funder_name ?? null);
    }
  }

  const map = new Map<string, { id: string; name: string }>();
  for (const [slug, funderName] of seen) {
    const name = funderName ?? slug.toUpperCase().replace(/-/g, " ");
    const id = await upsertFunder({
      slug,
      name,
      website: null,
      type: slug.match(/^(ahrc|bbsrc|epsrc|esrc|mrc|nerc|stfc|innovate-uk|research-england)$/)
        ? "ukri_council"
        : null,
      disciplines: [],
      source_metadata: {},
    });
    map.set(slug, { id, name });
  }
  return map;
}

export async function runOpportunitySource(config: SourceConfig): Promise<{
  status: "success" | "failed";
  counters: RunCounters;
  error?: string;
}> {
  console.log(`\nIngesting ${config.displayName}`);
  const runId = await startRun(config.source, config.funderSlug);
  try {
    const opportunities = await config.fetch();
    const funderMap = await ensureFunders(opportunities);
    const counters = await upsertOpportunities(opportunities, funderMap);
    console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
    await completeRun(runId, "success", counters);
    return { status: "success", counters };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Error: ${msg}`);
    await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
    return { status: "failed", counters: { created: 0, updated: 0, skipped: 0 }, error: msg };
  }
}
