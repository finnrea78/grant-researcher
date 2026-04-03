import { Command } from "commander";
import { supabase } from "./db.js";
import { fetchGtrProjects } from "./sources/gtr.js";
import { fetchUkriOpportunities } from "./sources/ukri-finder.js";
import { normaliseGtrProject } from "./transforms/normalise-gtr.js";
import { normaliseUkriOpportunity } from "./transforms/normalise-ukri.js";
import { upsertFunder } from "./loaders/upsert-funder.js";
import { upsertSchemes } from "./loaders/upsert-schemes.js";
import { startRun, completeRun } from "./loaders/log-run.js";
import type { NormalisedScheme } from "./types.js";

const program = new Command();
program.name("ingest").description("Grant data ingestion pipeline").version("0.1.0");

async function ensureFunders(
  schemes: NormalisedScheme[]
): Promise<Map<string, { id: string; name: string }>> {
  const slugs = [...new Set(schemes.map((s) => s.funder_slug))];
  const map = new Map<string, { id: string; name: string }>();
  for (const slug of slugs) {
    const id = await upsertFunder({
      slug,
      name: slug.toUpperCase().replace(/-/g, " "),
      website: null,
      type: slug.match(/^(ahrc|bbsrc|epsrc|esrc|mrc|nerc|stfc|innovate-uk|research-england)$/)
        ? "ukri_council"
        : null,
      disciplines: [],
      source_metadata: {},
    });
    map.set(slug, { id, name: slug });
  }
  return map;
}

program
  .command("gtr")
  .description("Ingest awarded grants from UKRI Gateway to Research API")
  .option("--council <name>", "Filter by UKRI council (e.g. ahrc, epsrc)")
  .option("--all", "Ingest from all UKRI councils")
  .option("--limit <n>", "Max projects to fetch", parseInt)
  .action(async (opts) => {
    const councils = opts.all
      ? ["ahrc", "bbsrc", "epsrc", "esrc", "mrc", "nerc", "stfc", "innovate-uk"]
      : opts.council ? [opts.council] : [];
    if (councils.length === 0) { console.error("Specify --council <name> or --all"); process.exit(1); }
    for (const council of councils) {
      console.log(`\nIngesting GtR: ${council}`);
      const runId = await startRun("gtr", council);
      const allSchemes: NormalisedScheme[] = [];
      try {
        for await (const batch of fetchGtrProjects({ council, limit: opts.limit })) {
          allSchemes.push(...batch.map(normaliseGtrProject));
        }
        const funderMap = await ensureFunders(allSchemes);
        const counters = await upsertSchemes(allSchemes, funderMap);
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
      const schemes = raw.map(normaliseUkriOpportunity);
      const funderMap = await ensureFunders(schemes);
      const counters = await upsertSchemes(schemes, funderMap);
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
  .description("Show last ingestion runs")
  .action(async () => {
    const { data, error } = await supabase
      .from("ingestion_runs")
      .select("source, funder_slug, status, records_created, records_updated, started_at")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) { console.error(`Failed to fetch status: ${error.message}`); process.exit(1); }
    if (!data || data.length === 0) { console.log("No ingestion runs found."); return; }
    console.log("\nRecent ingestion runs:");
    console.log("─".repeat(80));
    for (const run of data) {
      const funder = run.funder_slug ? ` (${run.funder_slug})` : "";
      console.log(`  ${run.source}${funder}  ${run.status}  +${run.records_created} created  ${run.started_at}`);
    }
  });

program.parse();
