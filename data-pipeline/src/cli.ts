import { Command } from "commander";
import { supabase } from "@grant-researcher/db";
import { fetchGtrProjects, GTR_COUNCIL_NAMES } from "./sources/gtr.js";
import { fetchUkriOpportunities } from "./sources/ukri-finder.js";
import { fetchFindAGrantOpportunities } from "./sources/find-a-grant.js";
import { fetchWellcomeSchemes } from "./sources/wellcome.js";
import { fetchLeverhulmeSchemes } from "./sources/leverhulme.js";
import { fetchRoyalSocietySchemes } from "./sources/royal-society.js";
import { normaliseGtrProject } from "./transforms/normalise-gtr.js";
import { normaliseUkriOpportunity } from "./transforms/normalise-ukri.js";
import { normaliseFindAGrant } from "./transforms/normalise-find-a-grant.js";
import { normaliseWellcome } from "./transforms/normalise-wellcome.js";
import { normaliseLeverhulme } from "./transforms/normalise-leverhulme.js";
import { normaliseRoyalSociety } from "./transforms/normalise-royal-society.js";
import { upsertFunder } from "./loaders/upsert-funder.js";
import { upsertGrants } from "./loaders/upsert-grants.js";
import { upsertOpportunities } from "./loaders/upsert-opportunities.js";
import { startRun, completeRun } from "./loaders/log-run.js";
import type { NormalisedGrant, NormalisedOpportunity } from "./types.js";

const program = new Command();
program.name("ingest").description("Grant data ingestion pipeline").version("0.1.0");

async function ensureFunders(
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

program
  .command("gtr")
  .description("Ingest awarded grants from UKRI Gateway to Research API")
  .option("--council <name>", "Filter by UKRI council slug (e.g. ahrc, epsrc)")
  .option("--all", "Ingest from all UKRI councils")
  .option("--limit <n>", "Max projects to fetch", parseInt)
  .option("--since <year>", "Only fetch projects with fund_start >= this year (default 2016)", parseInt)
  .action(async (opts) => {
    const councils = opts.all
      ? Object.keys(GTR_COUNCIL_NAMES)
      : opts.council ? [opts.council] : [];
    if (councils.length === 0) { console.error("Specify --council <name> or --all"); process.exit(1); }

    const sinceYear: number = opts.since ?? 2016;

    for (const council of councils) {
      console.log(`\nIngesting GtR: ${council} (since ${sinceYear})`);
      const runId = await startRun("gtr", council);
      const allGrants: NormalisedGrant[] = [];
      try {
        for await (const batch of fetchGtrProjects({ council, limit: opts.limit, sinceYear })) {
          allGrants.push(...batch.map(normaliseGtrProject));
        }
        const funderMap = await ensureFunders(allGrants);
        const counters = await upsertGrants(allGrants, funderMap);
        console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
        await completeRun(runId, "success", counters);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Error: ${msg}`);
        await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
      }
    }
  });

program
  .command("ukri-finder")
  .description("Ingest open opportunities from UKRI Funding Finder")
  .option("--council <name>", "Filter by council slug")
  .action(async (opts) => {
    console.log("\nIngesting UKRI Funding Finder");
    const runId = await startRun("ukri_funding_finder", opts.council);
    try {
      const raw = await fetchUkriOpportunities(opts.council);
      const opportunities: NormalisedOpportunity[] = raw.map(normaliseUkriOpportunity);
      const funderMap = await ensureFunders(opportunities);
      const counters = await upsertOpportunities(opportunities, funderMap);
      console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
      await completeRun(runId, "success", counters);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${msg}`);
      await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
    }
  });

program
  .command("find-a-grant")
  .description("Ingest open opportunities from UK Find a Grant (GOV.UK)")
  .option("--limit <n>", "Max opportunities to fetch", parseInt)
  .action(async (opts) => {
    console.log("\nIngesting Find a Grant (GOV.UK)");
    const runId = await startRun("find_a_grant", null);
    try {
      const raw = await fetchFindAGrantOpportunities(opts.limit);
      const opportunities: NormalisedOpportunity[] = raw.map(normaliseFindAGrant);
      const funderMap = await ensureFunders(opportunities);
      const counters = await upsertOpportunities(opportunities, funderMap);
      console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
      await completeRun(runId, "success", counters);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${msg}`);
      await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
    }
  });

program
  .command("wellcome")
  .description("Ingest open opportunities from Wellcome Trust")
  .action(async () => {
    console.log("\nIngesting Wellcome Trust schemes");
    const runId = await startRun("wellcome", "wellcome-trust");
    try {
      const raw = await fetchWellcomeSchemes();
      const opportunities: NormalisedOpportunity[] = raw.map(normaliseWellcome);
      const funderMap = await ensureFunders(opportunities);
      const counters = await upsertOpportunities(opportunities, funderMap);
      console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
      await completeRun(runId, "success", counters);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${msg}`);
      await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
    }
  });

program
  .command("leverhulme")
  .description("Ingest open opportunities from Leverhulme Trust")
  .action(async () => {
    console.log("\nIngesting Leverhulme Trust schemes");
    const runId = await startRun("leverhulme", "leverhulme-trust");
    try {
      const raw = await fetchLeverhulmeSchemes();
      const opportunities: NormalisedOpportunity[] = raw.map(normaliseLeverhulme);
      const funderMap = await ensureFunders(opportunities);
      const counters = await upsertOpportunities(opportunities, funderMap);
      console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
      await completeRun(runId, "success", counters);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${msg}`);
      await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
    }
  });

program
  .command("royal-society")
  .description("Ingest open opportunities from the Royal Society (server-rendered items only)")
  .action(async () => {
    console.log("\nIngesting Royal Society grants");
    const runId = await startRun("royal_society", "royal-society");
    try {
      const raw = await fetchRoyalSocietySchemes();
      const opportunities: NormalisedOpportunity[] = raw.map(normaliseRoyalSociety);
      const funderMap = await ensureFunders(opportunities);
      const counters = await upsertOpportunities(opportunities, funderMap);
      console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
      await completeRun(runId, "success", counters);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${msg}`);
      await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
    }
  });

program
  .command("status")
  .description("Show database record counts and last ingestion runs")
  .action(async () => {
    // Show table counts
    const [grantsResult, oppsResult] = await Promise.all([
      supabase.from("awarded_grants").select("id", { count: "exact", head: true }),
      supabase.from("opportunities").select("id", { count: "exact", head: true }),
    ]);
    console.log("\nDatabase counts:");
    console.log(`  awarded_grants:  ${grantsResult.count ?? "error"}`);
    console.log(`  opportunities:   ${oppsResult.count ?? "error"}`);

    // Show recent ingestion runs
    const { data, error } = await supabase
      .from("ingestion_runs")
      .select("source, funder_slug, status, records_created, records_updated, started_at")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) { console.error(`Failed to fetch status: ${error.message}`); process.exit(1); }
    if (!data || data.length === 0) { console.log("\nNo ingestion runs found."); return; }
    console.log("\nRecent ingestion runs:");
    console.log("─".repeat(80));
    for (const run of data) {
      const funder = run.funder_slug ? ` (${run.funder_slug})` : "";
      console.log(`  ${run.source}${funder}  ${run.status}  +${run.records_created} created  ${run.started_at}`);
    }
  });

program.parse();
