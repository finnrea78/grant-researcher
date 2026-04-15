import { Command } from "commander";
import { resolve } from "path";
import { supabase } from "@grant-researcher/db";
import { fetchGtrProjects, GTR_COUNCIL_NAMES } from "./sources/gtr.js";
import { fetchUkriOpportunities } from "./sources/ukri-finder.js";
import { fetchFindAGrantOpportunities } from "./sources/find-a-grant.js";
import { fetchWellcomeSchemes } from "./sources/wellcome.js";
import { fetchLeverhulmeSchemes } from "./sources/leverhulme.js";
import { fetchRoyalSocietySchemes } from "./sources/royal-society.js";
import { fetchNuffieldSchemes } from "./sources/nuffield.js";
import { fetchWolfsonSchemes } from "./sources/wolfson.js";
import { fetchHeritageFundSchemes } from "./sources/heritage-fund.js";
import { fetchCarnegieTrustSchemes } from "./sources/carnegie-trust.js";
import { fetchHenryMooreSchemes } from "./sources/henry-moore.js";
import { fetchERCSchemes } from "./sources/erc.js";
import { fetchMSCASchemes } from "./sources/msca.js";
import { fetchHIASSchemes } from "./sources/hias-hamburg.js";
import { normaliseGtrProject } from "./transforms/normalise-gtr.js";
import { normaliseUkriOpportunity } from "./transforms/normalise-ukri.js";
import { normaliseFindAGrant } from "./transforms/normalise-find-a-grant.js";
import { normaliseWellcome } from "./transforms/normalise-wellcome.js";
import { normaliseLeverhulme } from "./transforms/normalise-leverhulme.js";
import { normaliseRoyalSociety } from "./transforms/normalise-royal-society.js";
import { normaliseNuffield } from "./transforms/normalise-nuffield.js";
import { normaliseWolfson } from "./transforms/normalise-wolfson.js";
import { normaliseHeritageFund } from "./transforms/normalise-heritage-fund.js";
import { normaliseCarnegie } from "./transforms/normalise-carnegie-trust.js";
import { normaliseHenryMoore } from "./transforms/normalise-henry-moore.js";
import { normaliseERC } from "./transforms/normalise-erc.js";
import { normaliseMSCA } from "./transforms/normalise-msca.js";
import { normaliseHIAS } from "./transforms/normalise-hias-hamburg.js";
import { upsertGrants } from "./loaders/upsert-grants.js";
import { startRun, completeRun } from "./loaders/log-run.js";
import { seedSourcesFromUrlList } from "./loaders/upsert-discovered-source.js";
import { embedBackfill } from "./commands/embed-backfill.js";
import { runOpportunitySource, ensureFunders, type SourceConfig } from "./commands/run-source.js";
import { runCleanup, runPurge } from "./commands/cleanup.js";
import type { NormalisedGrant } from "./types.js";

const program = new Command();
program.name("ingest").description("Grant data ingestion pipeline").version("0.1.0");

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
    await runOpportunitySource({
      displayName: "UKRI Funding Finder",
      source: "ukri_funding_finder",
      funderSlug: opts.council,
      fetch: () => fetchUkriOpportunities(opts.council).then(r => r.map(normaliseUkriOpportunity)),
    });
  });

program
  .command("find-a-grant")
  .description("Ingest open opportunities from UK Find a Grant (GOV.UK)")
  .option("--limit <n>", "Max opportunities to fetch", parseInt)
  .action(async (opts) => {
    await runOpportunitySource({
      displayName: "Find a Grant (GOV.UK)",
      source: "find_a_grant",
      fetch: () => fetchFindAGrantOpportunities(opts.limit).then(r => r.map(normaliseFindAGrant)),
    });
  });

program
  .command("wellcome")
  .description("Ingest open opportunities from Wellcome Trust")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Wellcome Trust schemes",
      source: "wellcome",
      funderSlug: "wellcome-trust",
      fetch: () => fetchWellcomeSchemes().then(r => r.map(normaliseWellcome)),
    });
  });

program
  .command("leverhulme")
  .description("Ingest open opportunities from Leverhulme Trust")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Leverhulme Trust schemes",
      source: "leverhulme",
      funderSlug: "leverhulme-trust",
      fetch: () => fetchLeverhulmeSchemes().then(r => r.map(normaliseLeverhulme)),
    });
  });

program
  .command("royal-society")
  .description("Ingest open opportunities from the Royal Society (server-rendered items only)")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Royal Society grants",
      source: "royal_society",
      funderSlug: "royal-society",
      fetch: () => fetchRoyalSocietySchemes().then(r => r.map(normaliseRoyalSociety)),
    });
  });

const OPPORTUNITY_SOURCES: SourceConfig[] = [
  {
    displayName: "UKRI Funding Finder",
    source: "ukri_funding_finder",
    fetch: () => fetchUkriOpportunities().then(r => r.map(normaliseUkriOpportunity)),
  },
  {
    displayName: "Find a Grant (GOV.UK)",
    source: "find_a_grant",
    fetch: () => fetchFindAGrantOpportunities().then(r => r.map(normaliseFindAGrant)),
  },
  {
    displayName: "Wellcome Trust schemes",
    source: "wellcome",
    funderSlug: "wellcome-trust",
    fetch: () => fetchWellcomeSchemes().then(r => r.map(normaliseWellcome)),
  },
  {
    displayName: "Leverhulme Trust schemes",
    source: "leverhulme",
    funderSlug: "leverhulme-trust",
    fetch: () => fetchLeverhulmeSchemes().then(r => r.map(normaliseLeverhulme)),
  },
  {
    displayName: "Royal Society grants",
    source: "royal_society",
    funderSlug: "royal-society",
    fetch: () => fetchRoyalSocietySchemes().then(r => r.map(normaliseRoyalSociety)),
  },
  {
    displayName: "Nuffield Foundation schemes",
    source: "nuffield",
    funderSlug: "nuffield-foundation",
    fetch: () => fetchNuffieldSchemes().then(r => r.map(normaliseNuffield)),
  },
  {
    displayName: "Wolfson Foundation schemes",
    source: "wolfson",
    funderSlug: "wolfson-foundation",
    fetch: () => fetchWolfsonSchemes().then(r => r.map(normaliseWolfson)),
  },
  {
    displayName: "National Lottery Heritage Fund",
    source: "heritage_fund",
    funderSlug: "national-lottery-heritage-fund",
    fetch: () => fetchHeritageFundSchemes().then(r => r.map(normaliseHeritageFund)),
  },
  {
    displayName: "Carnegie Trust schemes",
    source: "carnegie_trust",
    funderSlug: "carnegie-trust",
    fetch: () => fetchCarnegieTrustSchemes().then(r => r.map(normaliseCarnegie)),
  },
  {
    displayName: "Henry Moore Foundation grants",
    source: "henry_moore",
    funderSlug: "henry-moore-foundation",
    fetch: () => fetchHenryMooreSchemes().then(r => r.map(normaliseHenryMoore)),
  },
  {
    displayName: "European Research Council grants",
    source: "erc",
    funderSlug: "european-research-council",
    fetch: () => fetchERCSchemes().then(r => r.map(normaliseERC)),
  },
  {
    displayName: "Marie Skłodowska-Curie Actions",
    source: "msca",
    funderSlug: "european-commission",
    fetch: () => fetchMSCASchemes().then(r => r.map(normaliseMSCA)),
  },
  {
    displayName: "HIAS Hamburg fellowships",
    source: "hias_hamburg",
    funderSlug: "hias-hamburg",
    fetch: () => fetchHIASSchemes().then(r => r.map(normaliseHIAS)),
  },
];

program
  .command("hias-hamburg")
  .description("Ingest fellowship calls from Hamburg Institute for Advanced Study")
  .action(async () => {
    await runOpportunitySource({
      displayName: "HIAS Hamburg fellowships",
      source: "hias_hamburg",
      funderSlug: "hias-hamburg",
      fetch: () => fetchHIASSchemes().then(r => r.map(normaliseHIAS)),
    });
  });

program
  .command("msca")
  .description("Ingest MSCA action types from Marie Skłodowska-Curie Actions")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Marie Skłodowska-Curie Actions",
      source: "msca",
      funderSlug: "european-commission",
      fetch: () => fetchMSCASchemes().then(r => r.map(normaliseMSCA)),
    });
  });

program
  .command("erc")
  .description("Ingest ERC grant types from European Research Council")
  .action(async () => {
    await runOpportunitySource({
      displayName: "European Research Council grants",
      source: "erc",
      funderSlug: "european-research-council",
      fetch: () => fetchERCSchemes().then(r => r.map(normaliseERC)),
    });
  });

program
  .command("henry-moore")
  .description("Ingest grant categories from Henry Moore Foundation")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Henry Moore Foundation grants",
      source: "henry_moore",
      funderSlug: "henry-moore-foundation",
      fetch: () => fetchHenryMooreSchemes().then(r => r.map(normaliseHenryMoore)),
    });
  });

program
  .command("carnegie-trust")
  .description("Ingest grant schemes from Carnegie Trust for the Universities of Scotland")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Carnegie Trust schemes",
      source: "carnegie_trust",
      funderSlug: "carnegie-trust",
      fetch: () => fetchCarnegieTrustSchemes().then(r => r.map(normaliseCarnegie)),
    });
  });

program
  .command("heritage-fund")
  .description("Ingest open programmes from National Lottery Heritage Fund")
  .action(async () => {
    await runOpportunitySource({
      displayName: "National Lottery Heritage Fund",
      source: "heritage_fund",
      funderSlug: "national-lottery-heritage-fund",
      fetch: () => fetchHeritageFundSchemes().then(r => r.map(normaliseHeritageFund)),
    });
  });

program
  .command("wolfson")
  .description("Ingest open opportunities from Wolfson Foundation")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Wolfson Foundation schemes",
      source: "wolfson",
      funderSlug: "wolfson-foundation",
      fetch: () => fetchWolfsonSchemes().then(r => r.map(normaliseWolfson)),
    });
  });

program
  .command("nuffield")
  .description("Ingest open opportunities from Nuffield Foundation")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Nuffield Foundation schemes",
      source: "nuffield",
      funderSlug: "nuffield-foundation",
      fetch: () => fetchNuffieldSchemes().then(r => r.map(normaliseNuffield)),
    });
  });

program
  .command("ingest-all")
  .description("Run all opportunity sources sequentially")
  .option("--include-gtr", "Also run GtR awarded grants (--all --since 2016)")
  .action(async (opts) => {
    const results = [];
    for (const source of OPPORTUNITY_SOURCES) {
      results.push(await runOpportunitySource(source));
    }

    console.log("\n── Summary ──────────────────────────────────────");
    for (let i = 0; i < OPPORTUNITY_SOURCES.length; i++) {
      const s = OPPORTUNITY_SOURCES[i];
      const r = results[i];
      const icon = r.status === "success" ? "✓" : "✗";
      console.log(`  ${icon} ${s.displayName}: ${r.counters.created} created, ${r.counters.updated} updated, ${r.counters.skipped} skipped`);
    }

    if (opts.includeGtr) {
      console.log("\nRunning GtR (all councils, since 2016)...");
      const sinceYear = 2016;
      for (const council of Object.keys(GTR_COUNCIL_NAMES)) {
        console.log(`\nIngesting GtR: ${council} (since ${sinceYear})`);
        const runId = await startRun("gtr", council);
        const allGrants: NormalisedGrant[] = [];
        try {
          for await (const batch of fetchGtrProjects({ council, sinceYear })) {
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
    }

    const anyFailed = results.some(r => r.status === "failed");
    if (anyFailed) process.exit(1);
  });

program
  .command("cleanup")
  .description("Close expired opportunities and backfill missing embeddings")
  .action(async () => {
    await runCleanup();
  });

program
  .command("purge")
  .description("Permanently delete closed or past-deadline opportunities")
  .action(async () => {
    await runPurge();
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

program
  .command("seed-sources")
  .description("Seed funders table with source URLs from data/funding-sources/_urls.md")
  .option("--urls <path>", "Path to _urls.md", "data/funding-sources/_urls.md")
  .action(async (opts) => {
    const urlsPath = resolve(process.cwd(), opts.urls);
    console.log(`\nSeeding funders from ${urlsPath}`);
    try {
      const count = await seedSourcesFromUrlList(urlsPath);
      console.log(`  Done: ${count} sources seeded into funders table`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${msg}`);
      process.exit(1);
    }
  });

program
  .command("embed")
  .description("Compute and store embeddings for all opportunities missing them")
  .option("--batch <n>", "Batch size (default 100)", parseInt)
  .action(async (opts) => {
    const batchSize = opts.batch ?? 100;
    console.log(`\nEmbedding opportunities (batch: ${batchSize})`);
    try {
      const { embedded, skipped } = await embedBackfill({ batchSize });
      console.log(`  Done: ${embedded} embedded, ${skipped} failed`);
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program.parse();
