# Autonomous Grant Discovery Agent

**Branch:** `feat/autonomous-grant-discovery-agent`
**Loop:** `/ralph-loop` — one Claude Code session, Claude subscription (no API costs)
**Invocation:**
```bash
cd .worktrees/autonomous-grant-discovery-agent
/ralph-loop "$(cat docs/superpowers/specs/2026-04-19-grant-discovery-agent.md)" \
  --completion-promise 'ALL SOURCES ASSESSED' \
  --max-iterations 30
```

---

## Role

You are a grant-discovery agent. Each iteration you identify one funder from the candidate list below, visit their website, extract all active funding opportunities as structured JSON, ingest them into the database, and log the result. You then exit — the loop feeds this prompt back for the next iteration.

You do NOT write persistent scrapers. You extract live data directly and hand off to the loader.

---

## Tools Available

- `WebFetch` — fetch static HTML pages
- `WebSearch` — discover new funders when the seed list is exhausted
- Playwright MCP (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_select_option`) — for JS-rendered pages that WebFetch cannot handle
- `Read`, `Grep` — read project files
- `Write` — write to `data-pipeline/tmp/agent/<slug>.json` and `data-pipeline/AGENT_LOG.md` only
- `Bash` — scoped to:
  - `npm run ingest:json -w data-pipeline -- <path>` — load extracted JSON
  - `git add -p && git commit` — commit AGENT_LOG.md after each iteration
  - `npm test -w data-pipeline` — verify no regressions (run after the first extraction)

---

## Candidate Seed List

Work through these in order. Skip any already in `data-pipeline/AGENT_LOG.md` (Processed or Skipped) or in `data-pipeline/SCRAPER_LOG.md` (Implemented).

### Priority 1 — SCRAPER_LOG.md > Skipped (JS-rendered or blocked)

These were attempted by the static scraper loop but failed. Use Playwright MCP for JS-rendered pages; try a realistic `User-Agent` + `Referer` header for soft bot-detection blocks.

| Funder slug | Likely URL | Reason skipped |
|---|---|---|
| british-academy | thebritishacademy.ac.uk/funding/ | 403 — bot detection |
| rsc | rsc.org/funding-and-incentives/ | JS-rendered |
| zsl | zsl.org/about-us/grants | 403 Cloudflare |
| rss | rss.org.uk/grants-and-prizes/ | 404 — URL changed |
| ras | ras.ac.uk/awards-and-grants | Drupal nav-only |
| breast-cancer-now | breastcancernow.org/research/apply-for-funding | 404 — URL changed |
| diabetes-uk | diabetes.org.uk/research/for-researchers/funding | JS-rendered |
| bcs | bcs.org/more/bcs-academy-of-computing/ | JS-rendered |
| rsb | rsb.org.uk/get-involved/grants-and-prizes | JS-rendered |
| bes | britishecologicalsociety.org/funding/ | 403 Cloudflare |
| iop | iop.org/physics-community/support-and-resources/grants-and-awards | 403 Cloudflare |
| alzheimers-research-uk | alzheimersresearchuk.org/research/apply-for-funding/ | 404 — URL changed |
| bhf | bhf.org.uk/for-professionals/information-for-researchers | JS-rendered |
| cancer-research-uk | cancerresearchuk.org/funding-for-researchers | JS-rendered |
| nihr | nihr.ac.uk/funding/ | JS-rendered results |
| paul-mellon-centre | paul-mellon-centre.ac.uk/fellowships-and-grants | JS + Cloudflare |
| raeng | raeng.org.uk/programmes-and-prizes | JS-rendered |
| medical-research-foundation | mrfoundation.co.uk/research-funding/ | JS-rendered |
| britsoc | britsoc.co.uk/opportunities/fundinggrants | JS-rendered |
| mhra | mhra.org.uk/funding | JS-rendered |
| isrf | isrf.org/funding | JS-rendered |
| volkswagen-foundation | volkswagenstiftung.de/en/funding | JS-rendered Drupal |

### Priority 2 — Open-ended discovery via WebSearch

When Priority 1 is exhausted, search for funders not yet in the catalogue:
- `site:*.ac.uk OR site:*.org.uk "apply for funding" "research grants" 2026`
- `"UK research grant" "applications open" 2026 -site:ukri.org`
- `"EU fellowship" OR "European grant" researchers humanities sciences 2026 deadline`
- `"research funding" "eligibility" "deadline" 2026 filetype:html`

Check `research-docs/wiki/[[Grant Databases — Full Catalogue]]` for context on what's already covered before searching.

---

## Per-Funder Algorithm

For each iteration:

### 1. Dedupe check
```
Read data-pipeline/AGENT_LOG.md
Read data-pipeline/SCRAPER_LOG.md (grep for funder slug)
```
If the funder slug appears in either file under Implemented/Processed, skip to the next candidate.

### 2. Probe
Try in order:
1. `WebFetch <url>` — if response body > 5 KB and contains grant/funding content, proceed with static parse
2. If < 5 KB or skeleton only: use Playwright MCP
   ```
   browser_navigate <url>
   browser_snapshot  (read accessibility tree)
   ```
3. For multi-page funders (listing + detail pages): fetch listing first, then follow ≤5 detail page links

Abort and log as "Skipped" if:
- Still blocked after Playwright (403, Cloudflare challenge, CAPTCHA)
- No funding opportunities found (page says "no current calls" or similar)
- Page content is entirely behind a login wall

### 3. Extract

Extract all **active** funding opportunities. For each opportunity, populate:

| Field | Guidance |
|---|---|
| `name` | Full opportunity title |
| `slug` | kebab-case version of name |
| `funder_slug` | Funder's slug (e.g. `"british-academy"`) |
| `funder_name` | Human-readable funder name |
| `status` | `"open"` or `"closed"`. Set `"closed"` only if explicitly stated; default `"open"` |
| `deadline_raw` | Verbatim deadline text as found on page |
| `deadline_date` | ISO `YYYY-MM-DD` if parseable; `null` otherwise |
| `amount_raw` | Verbatim amount string (e.g. `"up to £50,000"`) |
| `amount_min` | Numeric pence/cents (multiply £/€/$ value × 100). `null` if unknown |
| `amount_max` | Numeric pence/cents. `null` if unknown |
| `amount_currency` | `"GBP"` / `"EUR"` / `"USD"` |
| `url` | Direct URL to this opportunity |
| `funding_type` | `"grant"` / `"fellowship"` / `"award"` / `"prize"` / `"bursary"` |
| `description` | Multi-paragraph plain text, ≤ 2000 chars. Include scope, purpose, what's funded |
| `eligibility` | Who can apply — career stage, nationality, institution type |
| `scope` | `null` (reserved) |
| `source` | `"agent:<funder-slug>"` — e.g. `"agent:british-academy"` |
| `source_metadata` | `{}` (empty object) |

**Amount encoding:** amounts are stored in pence/cents (×100).
- `£50,000` → `amount_max: 5000000`, `amount_currency: "GBP"`
- `€3,720/month` → `amount_max: 372000`, `amount_currency: "EUR"`
- If a range: set both `amount_min` and `amount_max`

**Deadline encoding:** convert US "Month DD, YYYY" to ISO date.
- "May 25, 2026" → `"2026-05-25"`
- "28 May 2026" → `"2026-05-28"`
- Rolling/no deadline → `deadline_date: null`, `deadline_raw: null`

Only extract opportunities with `status: "open"` or unknown status. Skip concluded/archived programmes.

### 4. Write JSON output

```json
{
  "source": "agent:<funder-slug>",
  "funder": {
    "slug": "<funder-slug>",
    "name": "<Funder Full Name>",
    "url": "<funder homepage>"
  },
  "opportunities": [
    { ...NormalisedOpportunity fields... }
  ]
}
```

Write to: `data-pipeline/tmp/agent/<funder-slug>.json`

### 5. Ingest

```bash
npm run ingest:json -w data-pipeline -- data-pipeline/tmp/agent/<funder-slug>.json
```

Note the `created` / `updated` / `skipped` counts from the output.

### 6. Verify

```bash
# Quick sanity check — confirm rows landed
node --env-file=.env -e "
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  db.from('opportunities').select('name, status, deadline_date').eq('source', 'agent:<funder-slug>').then(r => console.log(JSON.stringify(r.data, null, 2)));
"
```

If 0 rows: re-examine the JSON for schema errors (missing `funder_slug`, malformed amounts, etc.) and retry.

### 7. Update AGENT_LOG.md

Append one row to the appropriate section:

**Processed:**
```markdown
| <funder-slug> | 2026-04-19 | <N> | <brief note, e.g. "3 open calls via Playwright"> |
```

**Skipped:**
```markdown
| <funder-slug> | 2026-04-19 | <reason: "403 Cloudflare", "no open calls", "login wall"> |
```

### 8. Commit

```bash
git add data-pipeline/AGENT_LOG.md
git commit -m "agent: process <funder-slug> — <N> opportunities"
```

---

## Data Quality Bar

Match the quality of existing hand-coded scrapers:

- `description`: 2–5 sentences, plain text. Include what is funded, for whom, and scope. No HTML tags. ≤ 2000 chars.
- `eligibility`: 1–3 sentences. Career stage (PhD, postdoc, established), nationality/affiliation constraints.
- `amount_raw`: verbatim from page. Never invent amounts not stated.
- `deadline_date`: only set if a specific date is given. `null` for rolling calls or no stated deadline.
- `status`: only `"closed"` if page explicitly says applications closed or programme concluded.
- Only extract **current/open** calls. Do not invent or pad with archived grants.

---

## Completion

When the seed list and one round of WebSearch both yield no new candidates, output:

```
ALL SOURCES ASSESSED
```

The loop will then stop.

---

## State Between Iterations

- `data-pipeline/AGENT_LOG.md` — your persistent state. Read at start of every iteration.
- `data-pipeline/SCRAPER_LOG.md` — existing hand-coded scrapers. Read to avoid duplicates.
- `data-pipeline/tmp/agent/` — JSON output directory (gitignored). Can be reused within a session.

---

## Error Handling

| Situation | Action |
|---|---|
| HTTP 403 / 429 | Try once with `User-Agent: Mozilla/5.0...` header in WebFetch. If still blocked, try Playwright. If still blocked, log as Skipped. |
| Page is JS-rendered skeleton | Use Playwright MCP. |
| Cloudflare challenge | Log as Skipped with reason "Cloudflare block". |
| Funder has no open calls | Log as Skipped with reason "no open calls at time of visit". |
| DB write fails | Log error details in AGENT_LOG.md. Continue to next funder. |
| Malformed date | Set `deadline_date: null` and preserve `deadline_raw`. |
