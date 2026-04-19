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
import { fetchNETIASSchemes } from "./sources/netias.js";
import { fetchInnovateUKCompetitions } from "./sources/innovate-uk.js";
import { normaliseInnovateUK } from "./transforms/normalise-innovate-uk.js";
import { fetchBloodCancerUKSchemes } from "./sources/blood-cancer-uk.js";
import { normaliseBloodCancerUK } from "./transforms/normalise-blood-cancer-uk.js";
import { fetchNewtonFellowship } from "./sources/newton-fellowship.js";
import { normaliseNewton } from "./transforms/normalise-newton.js";
import { fetchRSEAwards } from "./sources/rse.js";
import { normaliseRSE } from "./transforms/normalise-rse.js";
import { fetchActionMedicalGrants } from "./sources/action-medical.js";
import { normaliseActionMedical } from "./transforms/normalise-action-medical.js";
import { fetchVivensaGrants } from "./sources/vivensa.js";
import { normaliseVivensa } from "./transforms/normalise-vivensa.js";
import { fetchEmboGrants } from "./sources/embo.js";
import { normaliseEmbo } from "./transforms/normalise-embo.js";
import { fetchHfspGrants } from "./sources/hfsp.js";
import { normaliseHfsp } from "./transforms/normalise-hfsp.js";
import { fetchBiochemGrants } from "./sources/biochemical-society.js";
import { normaliseBiochem } from "./transforms/normalise-biochemical-society.js";
import { fetchHumboldtGrants } from "./sources/humboldt.js";
import { normaliseHumboldt } from "./transforms/normalise-humboldt.js";
import { fetchGeolsocGrants } from "./sources/geolsoc.js";
import { normaliseGeolsoc } from "./transforms/normalise-geolsoc.js";
import { fetchAcMedSciGrants } from "./sources/acmedsci.js";
import { normaliseAcMedSci } from "./transforms/normalise-acmedsci.js";
import { fetchRgsGrants } from "./sources/rgs.js";
import { normaliseRgs } from "./transforms/normalise-rgs.js";
import { fetchBpsGrants } from "./sources/bps.js";
import { normaliseBps } from "./transforms/normalise-bps.js";
import { fetchGeneticsSocietyGrants } from "./sources/genetics-society.js";
import { normaliseGeneticsSociety } from "./transforms/normalise-genetics-society.js";
import { fetchMicrobiologySocietyGrants } from "./sources/microbiology-society.js";
import { normaliseMicrobiologySociety } from "./transforms/normalise-microbiology-society.js";
import { fetchRoyEnSocGrants } from "./sources/royensoc.js";
import { normaliseRoyEnSoc } from "./transforms/normalise-royensoc.js";
import { fetchLmsGrants } from "./sources/lms.js";
import { normaliseLms } from "./transforms/normalise-lms.js";
import { fetchPhysocGrants } from "./sources/physoc.js";
import { normalisePhysoc } from "./transforms/normalise-physoc.js";
import { fetchImaGrants } from "./sources/ima.js";
import { normaliseIma } from "./transforms/normalise-ima.js";
import { fetchEsebGrants } from "./sources/eseb.js";
import { normaliseEseb } from "./transforms/normalise-eseb.js";
import { fetchEndocrinologyGrants } from "./sources/endocrinology.js";
import { normaliseEndocrinology } from "./transforms/normalise-endocrinology.js";
import { fetchRhsGrants } from "./sources/royal-historical-society.js";
import { normaliseRhs } from "./transforms/normalise-royal-historical-society.js";
import { fetchRc1851Grants } from "./sources/royal-commission-1851.js";
import { normaliseRc1851 } from "./transforms/normalise-royal-commission-1851.js";
import { fetchAsabGrants } from "./sources/asab.js";
import { normaliseAsab } from "./transforms/normalise-asab.js";
import { fetchSciGrants } from "./sources/sci.js";
import { normaliseSci } from "./transforms/normalise-sci.js";
import { fetchSalGrants } from "./sources/sal.js";
import { normaliseSal } from "./transforms/normalise-sal.js";
import { fetchBshsGrants } from "./sources/bshs.js";
import { normaliseBshs } from "./transforms/normalise-bshs.js";
import { fetchBsbiGrants } from "./sources/bsbi.js";
import { normaliseBsbi } from "./transforms/normalise-bsbi.js";
import { fetchFebsGrants } from "./sources/febs.js";
import { normaliseFebs } from "./transforms/normalise-febs.js";
import { fetchPalassGrants } from "./sources/palass.js";
import { normalisePalass } from "./transforms/normalise-palass.js";
import { fetchChallengerSocietyGrants } from "./sources/challenger-society.js";
import { normaliseChallengerSociety } from "./transforms/normalise-challenger-society.js";
import { fetchBouGrants } from "./sources/bou.js";
import { normaliseBou } from "./transforms/normalise-bou.js";
import { fetchClassicalAssocGrants } from "./sources/classical-association.js";
import { normaliseClassicalAssoc } from "./transforms/normalise-classical-association.js";
import { fetchBenhsGrants } from "./sources/benhs.js";
import { normaliseBenhs } from "./transforms/normalise-benhs.js";
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
import { normaliseNETIAS } from "./transforms/normalise-netias.js";
import { upsertGrants } from "./loaders/upsert-grants.js";
import { startRun, completeRun } from "./loaders/log-run.js";
import { seedSourcesFromUrlList } from "./loaders/upsert-discovered-source.js";
import { embedBackfill } from "./commands/embed-backfill.js";
import { ingestFromJson } from "./loaders/ingest-json.js";
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
  {
    displayName: "NETIAS fellowship calls",
    source: "netias",
    funderSlug: "netias",
    fetch: () => fetchNETIASSchemes().then(r => r.map(normaliseNETIAS)),
  },
  {
    displayName: "Innovate UK competitions",
    source: "innovate_uk",
    funderSlug: "innovate-uk",
    fetch: () => fetchInnovateUKCompetitions().then(r => r.map(normaliseInnovateUK)),
  },
  {
    displayName: "Blood Cancer UK funding schemes",
    source: "blood_cancer_uk",
    funderSlug: "blood-cancer-uk",
    fetch: () => fetchBloodCancerUKSchemes().then(r => r.map(normaliseBloodCancerUK)),
  },
  {
    displayName: "Newton International Fellowships",
    source: "newton_fellowship",
    funderSlug: "royal-society",
    fetch: () => fetchNewtonFellowship().then(r => r.map(normaliseNewton)),
  },
  {
    displayName: "Royal Society of Edinburgh awards",
    source: "rse",
    funderSlug: "royal-society-of-edinburgh",
    fetch: () => fetchRSEAwards().then(r => r.map(normaliseRSE)),
  },
  {
    displayName: "Action Medical Research grants",
    source: "action_medical",
    funderSlug: "action-medical-research",
    fetch: () => fetchActionMedicalGrants().then(r => r.map(normaliseActionMedical)),
  },
  {
    displayName: "Vivensa Foundation grants",
    source: "vivensa_foundation",
    funderSlug: "vivensa-foundation",
    fetch: () => fetchVivensaGrants().then(r => r.map(normaliseVivensa)),
  },
  {
    displayName: "EMBO funding programmes",
    source: "embo",
    funderSlug: "embo",
    fetch: () => fetchEmboGrants().then(r => r.map(normaliseEmbo)),
  },
  {
    displayName: "HFSP funding programmes",
    source: "hfsp",
    funderSlug: "hfsp",
    fetch: () => fetchHfspGrants().then(r => r.map(normaliseHfsp)),
  },
  {
    displayName: "Biochemical Society grants",
    source: "biochemical_society",
    funderSlug: "biochemical-society",
    fetch: () => fetchBiochemGrants().then(r => r.map(normaliseBiochem)),
  },
  {
    displayName: "Humboldt Foundation programmes",
    source: "humboldt_foundation",
    funderSlug: "humboldt-foundation",
    fetch: () => fetchHumboldtGrants().then(r => r.map(normaliseHumboldt)),
  },
  {
    displayName: "Geological Society of London grants",
    source: "geolsoc",
    funderSlug: "geological-society-of-london",
    fetch: () => fetchGeolsocGrants().then(r => r.map(normaliseGeolsoc)),
  },
  {
    displayName: "Academy of Medical Sciences schemes",
    source: "acmedsci",
    funderSlug: "academy-of-medical-sciences",
    fetch: () => fetchAcMedSciGrants().then(r => r.map(normaliseAcMedSci)),
  },
  {
    displayName: "Royal Geographical Society grants",
    source: "rgs",
    funderSlug: "royal-geographical-society",
    fetch: () => fetchRgsGrants().then(r => r.map(normaliseRgs)),
  },
  {
    displayName: "British Psychological Society grants",
    source: "bps",
    funderSlug: "british-psychological-society",
    fetch: () => fetchBpsGrants().then(r => r.map(normaliseBps)),
  },
  {
    displayName: "Genetics Society grants",
    source: "genetics_society",
    funderSlug: "genetics-society",
    fetch: () => fetchGeneticsSocietyGrants().then(r => r.map(normaliseGeneticsSociety)),
  },
  {
    displayName: "Microbiology Society grants",
    source: "microbiology_society",
    funderSlug: "microbiology-society",
    fetch: () => fetchMicrobiologySocietyGrants().then(r => r.map(normaliseMicrobiologySociety)),
  },
  {
    displayName: "Royal Entomological Society grants",
    source: "royensoc",
    funderSlug: "royal-entomological-society",
    fetch: () => fetchRoyEnSocGrants().then(r => r.map(normaliseRoyEnSoc)),
  },
  {
    displayName: "London Mathematical Society grants",
    source: "lms",
    funderSlug: "london-mathematical-society",
    fetch: () => fetchLmsGrants().then(r => r.map(normaliseLms)),
  },
  {
    displayName: "Physiological Society grants",
    source: "physoc",
    funderSlug: "physiological-society",
    fetch: () => fetchPhysocGrants().then(r => r.map(normalisePhysoc)),
  },
  {
    displayName: "IMA grants",
    source: "ima",
    funderSlug: "institute-of-mathematics-and-its-applications",
    fetch: () => fetchImaGrants().then(r => r.map(normaliseIma)),
  },
  {
    displayName: "ESEB prizes & funding",
    source: "eseb",
    funderSlug: "eseb",
    fetch: () => fetchEsebGrants().then(r => r.map(normaliseEseb)),
  },
  {
    displayName: "Society for Endocrinology grants",
    source: "endocrinology",
    funderSlug: "society-for-endocrinology",
    fetch: () => fetchEndocrinologyGrants().then(r => r.map(normaliseEndocrinology)),
  },
  {
    displayName: "Royal Historical Society open calls",
    source: "royal_historical_society",
    funderSlug: "royal-historical-society",
    fetch: () => fetchRhsGrants().then(r => r.map(normaliseRhs)),
  },
  {
    displayName: "Royal Commission for the Exhibition of 1851 awards",
    source: "royal_commission_1851",
    funderSlug: "royal-commission-1851",
    fetch: () => fetchRc1851Grants().then(r => r.map(normaliseRc1851)),
  },
  {
    displayName: "ASAB grants",
    source: "asab",
    funderSlug: "asab",
    fetch: () => fetchAsabGrants().then(r => r.map(normaliseAsab)),
  },
  {
    displayName: "SCI awards",
    source: "sci",
    funderSlug: "sci",
    fetch: () => fetchSciGrants().then(r => r.map(normaliseSci)),
  },
  {
    displayName: "Society of Antiquaries of London grants",
    source: "sal",
    funderSlug: "society-of-antiquaries-london",
    fetch: () => fetchSalGrants().then(r => r.map(normaliseSal)),
  },
  {
    displayName: "BSHS grants",
    source: "bshs",
    funderSlug: "bshs",
    fetch: () => fetchBshsGrants().then(r => r.map(normaliseBshs)),
  },
  {
    displayName: "BSBI grants",
    source: "bsbi",
    funderSlug: "bsbi",
    fetch: () => fetchBsbiGrants().then(r => r.map(normaliseBsbi)),
  },
  {
    displayName: "FEBS grants",
    source: "febs",
    funderSlug: "febs",
    fetch: () => fetchFebsGrants().then(r => r.map(normaliseFebs)),
  },
  {
    displayName: "Palaeontological Association grants",
    source: "palass",
    funderSlug: "palaeontological-association",
    fetch: () => fetchPalassGrants().then(r => r.map(normalisePalass)),
  },
  {
    displayName: "Challenger Society for Marine Science grants",
    source: "challenger_society",
    funderSlug: "challenger-society",
    fetch: () => fetchChallengerSocietyGrants().then(r => r.map(normaliseChallengerSociety)),
  },
];

program
  .command("genetics-society")
  .description("Ingest grant schemes from the Genetics Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Genetics Society grants",
      source: "genetics_society",
      funderSlug: "genetics-society",
      fetch: () => fetchGeneticsSocietyGrants().then(r => r.map(normaliseGeneticsSociety)),
    });
  });

program
  .command("microbiology-society")
  .description("Ingest grant schemes from the Microbiology Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Microbiology Society grants",
      source: "microbiology_society",
      funderSlug: "microbiology-society",
      fetch: () => fetchMicrobiologySocietyGrants().then(r => r.map(normaliseMicrobiologySociety)),
    });
  });

program
  .command("royensoc")
  .description("Ingest grants from the Royal Entomological Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Royal Entomological Society grants",
      source: "royensoc",
      funderSlug: "royal-entomological-society",
      fetch: () => fetchRoyEnSocGrants().then(r => r.map(normaliseRoyEnSoc)),
    });
  });

program
  .command("lms")
  .description("Ingest grant schemes from the London Mathematical Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "London Mathematical Society grants",
      source: "lms",
      funderSlug: "london-mathematical-society",
      fetch: () => fetchLmsGrants().then(r => r.map(normaliseLms)),
    });
  });

program
  .command("physoc")
  .description("Ingest grant schemes from the Physiological Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Physiological Society grants",
      source: "physoc",
      funderSlug: "physiological-society",
      fetch: () => fetchPhysocGrants().then(r => r.map(normalisePhysoc)),
    });
  });

program
  .command("ima")
  .description("Ingest grant schemes from the Institute of Mathematics and its Applications")
  .action(async () => {
    await runOpportunitySource({
      displayName: "IMA grants",
      source: "ima",
      funderSlug: "institute-of-mathematics-and-its-applications",
      fetch: () => fetchImaGrants().then(r => r.map(normaliseIma)),
    });
  });

program
  .command("eseb")
  .description("Ingest prizes & funding from the European Society for Evolutionary Biology")
  .action(async () => {
    await runOpportunitySource({
      displayName: "ESEB prizes & funding",
      source: "eseb",
      funderSlug: "eseb",
      fetch: () => fetchEsebGrants().then(r => r.map(normaliseEseb)),
    });
  });

program
  .command("endocrinology")
  .description("Ingest grant schemes from the Society for Endocrinology")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Society for Endocrinology grants",
      source: "endocrinology",
      funderSlug: "society-for-endocrinology",
      fetch: () => fetchEndocrinologyGrants().then(r => r.map(normaliseEndocrinology)),
    });
  });

program
  .command("royal-historical-society")
  .description("Ingest open calls from the Royal Historical Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Royal Historical Society open calls",
      source: "royal_historical_society",
      funderSlug: "royal-historical-society",
      fetch: () => fetchRhsGrants().then(r => r.map(normaliseRhs)),
    });
  });

program
  .command("royal-commission-1851")
  .description("Ingest award schemes from the Royal Commission for the Exhibition of 1851")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Royal Commission for the Exhibition of 1851 awards",
      source: "royal_commission_1851",
      funderSlug: "royal-commission-1851",
      fetch: () => fetchRc1851Grants().then(r => r.map(normaliseRc1851)),
    });
  });

program
  .command("asab")
  .description("Ingest grant schemes from the Association for the Study of Animal Behaviour")
  .action(async () => {
    await runOpportunitySource({
      displayName: "ASAB grants",
      source: "asab",
      funderSlug: "asab",
      fetch: () => fetchAsabGrants().then(r => r.map(normaliseAsab)),
    });
  });

program
  .command("sci")
  .description("Ingest award schemes from the Society of Chemical Industry")
  .action(async () => {
    await runOpportunitySource({
      displayName: "SCI awards",
      source: "sci",
      funderSlug: "sci",
      fetch: () => fetchSciGrants().then(r => r.map(normaliseSci)),
    });
  });

program
  .command("sal")
  .description("Ingest grant schemes from the Society of Antiquaries of London")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Society of Antiquaries of London grants",
      source: "sal",
      funderSlug: "society-of-antiquaries-london",
      fetch: () => fetchSalGrants().then(r => r.map(normaliseSal)),
    });
  });

program
  .command("bshs")
  .description("Ingest grants from the British Society for the History of Science")
  .action(async () => {
    await runOpportunitySource({
      displayName: "BSHS grants",
      source: "bshs",
      funderSlug: "bshs",
      fetch: () => fetchBshsGrants().then(r => r.map(normaliseBshs)),
    });
  });

program
  .command("bsbi")
  .description("Ingest grants from the Botanical Society of Britain and Ireland")
  .action(async () => {
    await runOpportunitySource({
      displayName: "BSBI grants",
      source: "bsbi",
      funderSlug: "bsbi",
      fetch: () => fetchBsbiGrants().then(r => r.map(normaliseBsbi)),
    });
  });

program
  .command("febs")
  .description("Ingest grant schemes from the Federation of European Biochemical Societies")
  .action(async () => {
    await runOpportunitySource({
      displayName: "FEBS grants",
      source: "febs",
      funderSlug: "febs",
      fetch: () => fetchFebsGrants().then(r => r.map(normaliseFebs)),
    });
  });

program
  .command("palass")
  .description("Ingest grant schemes from the Palaeontological Association")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Palaeontological Association grants",
      source: "palass",
      funderSlug: "palaeontological-association",
      fetch: () => fetchPalassGrants().then(r => r.map(normalisePalass)),
    });
  });

program
  .command("challenger-society")
  .description("Ingest grants from the Challenger Society for Marine Science")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Challenger Society for Marine Science grants",
      source: "challenger_society",
      funderSlug: "challenger-society",
      fetch: () => fetchChallengerSocietyGrants().then(r => r.map(normaliseChallengerSociety)),
    });
  });

program
  .command("bou")
  .description("Ingest grant schemes from the British Ornithological Union")
  .action(async () => {
    await runOpportunitySource({
      displayName: "British Ornithological Union grants",
      source: "bou",
      funderSlug: "british-ornithological-union",
      fetch: () => fetchBouGrants().then(r => r.map(normaliseBou)),
    });
  });

program
  .command("classical-association")
  .description("Ingest grant schemes from The Classical Association")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Classical Association grants",
      source: "classical_association",
      funderSlug: "classical-association",
      fetch: () => fetchClassicalAssocGrants().then(r => r.map(normaliseClassicalAssoc)),
    });
  });

program
  .command("benhs")
  .description("Ingest grant schemes from the British Entomological and Natural History Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "BENHS grants",
      source: "benhs",
      funderSlug: "benhs",
      fetch: () => fetchBenhsGrants().then(r => r.map(normaliseBenhs)),
    });
  });

program
  .command("bps")
  .description("Ingest grants, prizes and bursaries from the British Psychological Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "British Psychological Society grants",
      source: "bps",
      funderSlug: "british-psychological-society",
      fetch: () => fetchBpsGrants().then(r => r.map(normaliseBps)),
    });
  });

program
  .command("rgs")
  .description("Ingest grant deadlines from Royal Geographical Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Royal Geographical Society grants",
      source: "rgs",
      funderSlug: "royal-geographical-society",
      fetch: () => fetchRgsGrants().then(r => r.map(normaliseRgs)),
    });
  });

program
  .command("acmedsci")
  .description("Ingest grant schemes from Academy of Medical Sciences")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Academy of Medical Sciences schemes",
      source: "acmedsci",
      funderSlug: "academy-of-medical-sciences",
      fetch: () => fetchAcMedSciGrants().then(r => r.map(normaliseAcMedSci)),
    });
  });

program
  .command("geolsoc")
  .description("Ingest grants and bursaries from the Geological Society of London")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Geological Society of London grants",
      source: "geolsoc",
      funderSlug: "geological-society-of-london",
      fetch: () => fetchGeolsocGrants().then(r => r.map(normaliseGeolsoc)),
    });
  });

program
  .command("humboldt")
  .description("Ingest sponsorship programmes from Alexander von Humboldt Foundation")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Humboldt Foundation programmes",
      source: "humboldt_foundation",
      funderSlug: "humboldt-foundation",
      fetch: () => fetchHumboldtGrants().then(r => r.map(normaliseHumboldt)),
    });
  });

program
  .command("biochemical-society")
  .description("Ingest grants and bursaries from the Biochemical Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Biochemical Society grants",
      source: "biochemical_society",
      funderSlug: "biochemical-society",
      fetch: () => fetchBiochemGrants().then(r => r.map(normaliseBiochem)),
    });
  });

program
  .command("hfsp")
  .description("Ingest HFSP funding programmes (Human Frontier Science Program)")
  .action(async () => {
    await runOpportunitySource({
      displayName: "HFSP funding programmes",
      source: "hfsp",
      funderSlug: "hfsp",
      fetch: () => fetchHfspGrants().then(r => r.map(normaliseHfsp)),
    });
  });

program
  .command("embo")
  .description("Ingest EMBO funding programmes (European Molecular Biology Organization)")
  .action(async () => {
    await runOpportunitySource({
      displayName: "EMBO funding programmes",
      source: "embo",
      funderSlug: "embo",
      fetch: () => fetchEmboGrants().then(r => r.map(normaliseEmbo)),
    });
  });

program
  .command("vivensa-foundation")
  .description("Ingest grant opportunities from Vivensa Foundation (formerly Dunhill Medical Trust)")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Vivensa Foundation grants",
      source: "vivensa_foundation",
      funderSlug: "vivensa-foundation",
      fetch: () => fetchVivensaGrants().then(r => r.map(normaliseVivensa)),
    });
  });

program
  .command("action-medical")
  .description("Ingest open grant calls from Action Medical Research")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Action Medical Research grants",
      source: "action_medical",
      funderSlug: "action-medical-research",
      fetch: () => fetchActionMedicalGrants().then(r => r.map(normaliseActionMedical)),
    });
  });

program
  .command("rse")
  .description("Ingest award schemes from Royal Society of Edinburgh")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Royal Society of Edinburgh awards",
      source: "rse",
      funderSlug: "royal-society-of-edinburgh",
      fetch: () => fetchRSEAwards().then(r => r.map(normaliseRSE)),
    });
  });

program
  .command("blood-cancer-uk")
  .description("Ingest funding schemes from Blood Cancer UK")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Blood Cancer UK funding schemes",
      source: "blood_cancer_uk",
      funderSlug: "blood-cancer-uk",
      fetch: () => fetchBloodCancerUKSchemes().then(r => r.map(normaliseBloodCancerUK)),
    });
  });

program
  .command("newton-fellowship")
  .description("Ingest Newton International Fellowship from Royal Society")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Newton International Fellowships",
      source: "newton_fellowship",
      funderSlug: "royal-society",
      fetch: () => fetchNewtonFellowship().then(r => r.map(normaliseNewton)),
    });
  });

program
  .command("innovate-uk")
  .description("Ingest open competitions from Innovate UK innovation funding service")
  .action(async () => {
    await runOpportunitySource({
      displayName: "Innovate UK competitions",
      source: "innovate_uk",
      funderSlug: "innovate-uk",
      fetch: () => fetchInnovateUKCompetitions().then(r => r.map(normaliseInnovateUK)),
    });
  });

program
  .command("netias")
  .description("Ingest fellowship calls from NETIAS network of European Institutes for Advanced Study")
  .action(async () => {
    await runOpportunitySource({
      displayName: "NETIAS fellowship calls",
      source: "netias",
      funderSlug: "netias",
      fetch: () => fetchNETIASSchemes().then(r => r.map(normaliseNETIAS)),
    });
  });

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
  .command("ingest:json <path>")
  .description("Ingest opportunities from an agent-produced JSON file")
  .action(async (filePath) => {
    try {
      await ingestFromJson(resolve(process.cwd(), filePath));
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
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
