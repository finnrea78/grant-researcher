# Autonomous Grant Scraper Discovery Loop

**Date:** 2026-04-15
**Status:** Approved
**Scope:** `data-pipeline/` workspace

---

## Goal

Run an autonomous agent (ralph loop) that discovers UK and EU grant opportunity sources, writes a working scraper for each, verifies data lands in Supabase, and commits — without manual intervention. The user kicks it off, leaves it running, and comes back to a populated `feat/new-scrapers` branch.

---

## Architecture

### Loop mechanism: ralph loop

A ralph loop in the current session. Each iteration handles one funder end-to-end:

```
Iteration N:
  1. Read git log + SCRAPER_LOG.md → know what's done/skipped
  2. Pick next untried source from the seed list (or newly discovered)
  3. WebFetch the listing page → assess scrapeability
  4. If scrapeable: implement → test → ingest → verify DB → commit
  5. If not: log reason in SCRAPER_LOG.md → commit log update
  6. Exit → ralph feeds same prompt back → Iteration N+1
```

Stops when: `<promise>DONE</promise>` is output, or `--max-iterations 50` is hit.

### Invocation

```bash
git checkout -b feat/new-scrapers
/ralph-loop <prompt below> --completion-promise 'ALL SOURCES ASSESSED' --max-iterations 30
```

### The prompt

```
You are an autonomous grant scraper agent. Your job each iteration:

1. Read git log and data-pipeline/SCRAPER_LOG.md to see what's already done or skipped.
2. Pick the next untried source from the seed list in the spec at
   docs/superpowers/specs/2026-04-15-autonomous-scraper-loop-design.md.
   If the seed list is exhausted, run a WebSearch for more UK/EU grant opportunity sources.
3. Probe the source: fetch the page, check it returns 200 HTML with visible grant listings.
   If blocked or JS-only: log it in SCRAPER_LOG.md as skipped with reason, commit, done.
4. If scrapeable: implement the scraper following the pattern in the spec exactly:
   - data-pipeline/src/sources/<slug>.ts
   - data-pipeline/src/transforms/normalise-<slug>.ts
   - data-pipeline/tests/<slug>.test.ts
   - Add to OpportunitySource union in data-pipeline/src/types.ts
   - Wire CLI command + OPPORTUNITY_SOURCES in data-pipeline/src/cli.ts
5. Run: npm test -w data-pipeline — must pass. Debug up to 2 attempts, then skip.
6. Run: npm run ingest -w data-pipeline -- <slug> — must succeed.
7. After ingest, query the DB directly to verify data quality:
   - Count rows: SELECT count(*) FROM opportunities WHERE source='<slug>'
   - Check amounts: SELECT count(*) FROM opportunities WHERE source='<slug>' AND amount_min IS NOT NULL
   - Check deadlines: SELECT count(*) FROM opportunities WHERE source='<slug>' AND deadline_date IS NOT NULL
   If amounts or deadlines are all NULL but the source page has that data, improve the
   transform before committing. The DB pipeline auto-removes closed opportunities —
   only open ones should appear in the DB.
8. Update SCRAPER_LOG.md: note row count, how many have amount_min set, how many have deadline_date set.
9. Commit everything with message: feat(data-pipeline): add <name> opportunity scraper
10. When ALL sources in the seed list plus any discovered sources have been attempted,
    output: <promise>DONE</promise>

Read the full spec before starting. Follow the existing source/transform patterns exactly —
read data-pipeline/src/sources/wellcome.ts and data-pipeline/src/transforms/normalise-wellcome.ts
as your reference implementation.
```

---

## Seed List

The agent starts with these known sources (from vault research), then uses WebSearch to discover more:

**UK — Independent foundations**
- British Academy (`thebritishacademy.ac.uk/funding/`) — ⚠️ previously 403, try alternate URLs
- Nuffield Foundation (`nuffieldfoundation.org/funding`) — clean HTML, 4 schemes
- Wolfson Foundation (`wolfson.org.uk/funding/`) — landing page, needs sub-page navigation
- National Lottery Heritage Fund (`heritagefund.org.uk/funding`) — Drupal CMS
- British Council (`britishcouncil.org/arts/funding`) — previously timeout
- Paul Mellon Centre (`paul-mellon-centre.ac.uk/fellowships-and-grants`)
- Henry Moore Foundation (`henry-moore.org/grants`)
- Carnegie Trust for the Universities of Scotland (`carnegie-trust.org`)
- Royal Society of Edinburgh (`rse.org.uk/grants`)

**EU — Open calls**
- ERC open calls (`erc.europa.eu/apply-grant/open-calls`)
- MSCA fellowship calls (`marie-sklodowska-curie-actions.ec.europa.eu/calls`)
- Horizon Europe open calls (`ec.europa.eu/info/funding-tenders/opportunities/portal/`)

**Discovery:** After the seed list, run WebSearch queries like:
- `"UK research grant" "apply now" "open call" site:.ac.uk OR site:.org.uk`
- `"EU research fellowship" "open call" 2026 humanities social science`

---

## Per-Scraper Implementation Pattern

Follow the established pattern exactly. For funder slug `<slug>`:

```
data-pipeline/src/sources/<slug>.ts
data-pipeline/src/transforms/normalise-<slug>.ts
data-pipeline/tests/<slug>.test.ts        (unit tests with fixture HTML)
data-pipeline/src/types.ts                (add to OpportunitySource union)
data-pipeline/src/cli.ts                  (add command + OPPORTUNITY_SOURCES entry)
```

### Scraper file structure

```typescript
// sources/<slug>.ts
export function parse<Slug>Page(html: string): Raw<Slug>[] { ... }
export async function fetch<Slug>Schemes(): Promise<Raw<Slug>[]> { ... }
```

```typescript
// transforms/normalise-<slug>.ts
export interface Raw<Slug> { title, url, status, ... }
export function normalise<Slug>(raw: Raw<Slug>): NormalisedOpportunity { ... }
```

### Verification steps (in order)

1. `npm test -w data-pipeline` — unit tests must pass
2. `npm run ingest -w data-pipeline -- <slug>` — ingest must succeed (no thrown errors)
3. Check DB: at least 1 row with `source = '<slug>'` in `opportunities` table

If step 1 fails: debug up to 2 attempts, then skip + log.
If step 2 fails: skip + log (likely page structure changed or blocked).
If step 3 returns 0 rows: check if all opportunities are closed/expired — acceptable, log it.

---

## SCRAPER_LOG.md

Written to `data-pipeline/SCRAPER_LOG.md`. Updated and committed each iteration.

```markdown
# Scraper Discovery Log

## Implemented
- **nuffield** (2026-04-15) — 4 schemes, 1 open. Unit tests pass. 4 rows in DB.
- **wolfson** (2026-04-15) — 3 schemes found via sub-page navigation.

## Skipped
- **british-academy** — 403 on all tried URLs. Needs JS rendering.
- **british-council** — Timeout on fetch. Dynamic content suspected.

## In Progress
- (current iteration)
```

---

## Scrapeability Assessment

Before implementing, the agent does a quick probe:

| Check | Pass condition |
|---|---|
| HTTP status | 200 (not 403, 429, 5xx) |
| Content-Type | text/html |
| Grant listings visible | ≥1 grant title extractable from HTML |
| Not JS-only | Content present in raw HTML (not just `<div id="root"></div>`) |

If any check fails: log and skip. Do not spend more than one retry on a blocked source.

---

## CLI Wiring

Each implemented scraper gets:

```typescript
// Individual command
program
  .command('<slug>')
  .description('Ingest open opportunities from <Funder Name>')
  .action(async () => {
    await runOpportunitySource({
      displayName: '<Funder Name>',
      source: '<slug>',
      funderSlug: '<funder-slug>',
      fetch: () => fetch<Slug>Schemes().then(r => r.map(normalise<Slug>)),
    });
  });

// Also added to OPPORTUNITY_SOURCES array for ingest-all
```

---

## Commit strategy

One commit per successfully implemented scraper:

```
feat(data-pipeline): add <funder-name> opportunity scraper

Scrapes <URL>. Found N schemes, M currently open.
Tests pass. Ingest verified: K rows written to DB.
```

`SCRAPER_LOG.md` updates are committed alongside each scraper or as a standalone commit when skipping.

---

## Completion criteria

The loop stops (outputs `<promise>ALL SOURCES ASSESSED</promise>`) when ALL of the following are true:

- Every source in the seed list has been either implemented or logged as skipped with a reason
- WebSearch has been run at least once to find sources beyond the seed list
- All discovered sources (seed + found) have been attempted
- `npm test -w data-pipeline` passes on the branch
- `SCRAPER_LOG.md` is committed and up to date

Output `<promise>DONE</promise>` (the word DONE in promise tags) to stop the loop.

---

## Out of scope

- Pagination for JS-rendered/AJAX sources (e.g. Royal Society full pagination) — already noted in existing Royal Society scraper
- 360Giving awarded-grants integration — separate feature (use for match enrichment, not open calls)
- EU structural funds / regional funders — future iteration
- Paid sources (Research Professional, Dimensions, GrantFinder) — out of scope entirely

---

## Related

- Vault: `[[Grant Databases — Full Catalogue]]`, `[[Niche & Overlooked]]`, `[[Free APIs]]`
- Existing sources: `data-pipeline/src/sources/`
- CCR follow-up: finnrea78/grant-researcher#86
