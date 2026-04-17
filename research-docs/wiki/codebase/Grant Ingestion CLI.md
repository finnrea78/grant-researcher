# Grant Ingestion CLI

Workspace at `data-pipeline/`. Commander-based CLI: `data-pipeline/src/cli.ts`.

## Commands

```bash
npm run ingest -w data-pipeline -- gtr            # Gateway to Research (UKRI awarded grants)
npm run ingest -w data-pipeline -- ukri-finder    # UKRI Funding Finder (open opportunities)
npm run ingest -w data-pipeline -- find-a-grant   # Find-a-Grant scraper
npm run ingest -w data-pipeline -- wellcome       # Wellcome Trust scraper
npm run ingest -w data-pipeline -- leverhulme     # Leverhulme Trust scraper
npm run ingest -w data-pipeline -- royal-society  # Royal Society scraper
npm run embed -w data-pipeline                    # Backfill missing embeddings
```

## Architecture: Fetch → Normalise → Load

```
Fetcher (sources/) → Normaliser (transforms/) → Loader (loaders/)
```

### Sources (fetchers)

| File | What it fetches |
|------|----------------|
| `sources/gtr.ts` | UKRI Gateway to Research API (173k+ awarded grants) |
| `sources/ukri-finder.ts` | UKRI Funding Finder API (open opportunities) |
| `sources/find-a-grant.ts` | Find-a-Grant web scraper |
| `sources/wellcome.ts` | Wellcome Trust web scraper |
| `sources/leverhulme.ts` | Leverhulme Trust web scraper |
| `sources/royal-society.ts` | Royal Society web scraper |

### Transforms (normalisers)

| File | Output type |
|------|------------|
| `transforms/normalise-gtr.ts` | `NormalisedGrant` (awarded grants) |
| `transforms/normalise-ukri.ts` | `NormalisedOpportunity` |
| `transforms/normalise-find-a-grant.ts` | `NormalisedOpportunity` |
| `transforms/normalise-*.ts` | funder-specific variants |
| `transforms/parse-amounts.ts` | Extract min/max GBP |
| `transforms/parse-dates.ts` | Parse deadlines to ISO dates |

### Loaders (upserts)

| File | Supabase table |
|------|---------------|
| `loaders/upsert-funder.ts` | `funders` |
| `loaders/upsert-grants.ts` | `awarded_grants` |
| `loaders/upsert-opportunities.ts` | `opportunities` (+ OpenAI embeddings) |
| `loaders/upsert-discovered-source.ts` | `funders` (from `_urls.md` seed) |
| `loaders/log-run.ts` | `ingestion_runs` (audit trail) |

### Commands

- `commands/embed-backfill.ts` — batch-embed opportunities missing vector

## Types

- `data-pipeline/src/types.ts` — `NormalisedOpportunity`, `NormalisedGrant`

## Config

- `data-pipeline/.env` — same keys as root `.env.local`

## Related

- [[Database Schema]] · [[Codebase Index]] · [[Data Sources & APIs]]
