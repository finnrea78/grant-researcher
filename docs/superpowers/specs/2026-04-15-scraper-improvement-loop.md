# Scraper Improvement Loop

**Date:** 2026-04-15  
**Status:** Approved  
**Scope:** `data-pipeline/` workspace

---

## Goal

Run an autonomous ralph loop that works through every implemented scraper, improves each one to extract the richest possible data from detail pages (description, eligibility, amounts, deadlines), re-ingests to verify the DB improves, and commits — without manual intervention.

---

## Context

Current DB quality audit shows most scrapers have thin or zero descriptions, missing eligibility, and inconsistent amount/deadline coverage. Root cause: scrapers fetch listing pages but don't follow individual grant URLs to extract full content.

Quality audit SQL (run at start of each iteration to pick target):

```sql
SELECT source,
  count(*) as total,
  round(avg(length(description)))::int as avg_desc,
  count(amount_min) as has_amount,
  count(deadline_date) as has_deadline,
  count(eligibility) as has_elig,
  count(scope) as has_scope
FROM opportunities
GROUP BY source
ORDER BY avg_desc ASC, has_elig ASC;
```

Run via node:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('opportunities')
  .select('source, description, amount_min, deadline_date, eligibility, scope')
  .then(r => {
    if (r.error) { console.error(r.error); return; }
    const stats = {};
    for (const row of r.data) {
      const s = row.source;
      if (!stats[s]) stats[s] = { total: 0, desc_len: 0, desc_count: 0, amount: 0, deadline: 0, elig: 0, scope: 0 };
      stats[s].total++;
      if (row.description) { stats[s].desc_count++; stats[s].desc_len += row.description.length; }
      if (row.amount_min) stats[s].amount++;
      if (row.deadline_date) stats[s].deadline++;
      if (row.eligibility) stats[s].elig++;
      if (row.scope) stats[s].scope++;
    }
    const rows = Object.entries(stats).map(([src, d]) => ({
      source: src,
      total: d.total,
      avg_desc: d.desc_count > 0 ? Math.round(d.desc_len / d.desc_count) : 0,
      pct_amount: Math.round(d.amount / d.total * 100),
      pct_deadline: Math.round(d.deadline / d.total * 100),
      has_elig: d.elig,
      has_scope: d.scope
    })).sort((a, b) => a.avg_desc - b.avg_desc);
    console.table(rows);
  });
" 2>/dev/null
```

---

## Priority Order

Work through scrapers in this order (worst quality first). Skip sources marked as unfixable.

| Source | Issue | Notes |
|--------|-------|-------|
| `wolfson` | 0 desc, 0 amount, 0 deadline | Sub-pages return 502 — assess live, likely unfixable |
| `lms` | 0 desc, scope hardcoded | Each grant has a detail URL — fetch and extract |
| `sci` | 0 desc | Detail pages have content — fetch and extract |
| `febs` | 0 desc | Detail pages have content — fetch and extract |
| `embo` | 0 desc | Detail pages have content — fix extraction |
| `physoc` | avg 82 desc | Below threshold — enrich detail pages |
| `royensoc` | avg 101 desc | Just above threshold — improve |
| `genetics_society` | avg 104 desc | Just above threshold — improve |
| `acmedsci` | avg 118 desc | Improve from detail pages |
| `heritage_fund` | avg 121 desc | Improve from detail pages |
| `nuffield` | avg 127 desc | Improve from detail pages |
| `royal_commission_1851` | avg 128 desc | Improve from detail pages |
| `hias_hamburg` | avg 144 desc | Improve from detail pages |
| `humboldt_foundation` | avg 151 desc | Improve from detail pages |
| `biochemical_society` | avg 153 desc | Improve from detail pages |
| `classical_association` | avg 159 desc | Improve if more content on detail pages |
| `erc` | avg 163 desc | Improve from detail pages |
| `benhs` | avg 181 desc | Improve from detail pages |
| `hfsp` | avg 264 desc | Decent — only touch if detail pages have eligibility |
| `wellcome` | avg 228, 0 elig, 0 scope | Add detail-page fetch for eligibility + scope |
| `ukri_funding_finder` | avg 178, 15% elig | Fix multi-paragraph desc + improve eligibility |
| All others | Various | Run audit, improve if fixable |

Skip (out of scope): `find_a_grant`, `agentic_scan`, `innovate_uk` — these already have good quality or are aggregators.

---

## Per-Iteration Process

### Step 1 — Run quality audit

Run the audit SQL above. Identify the lowest-quality source that:
- Is in the `OPPORTUNITY_SOURCES` list in `data-pipeline/src/cli.ts`
- Has not been marked as `✅ Improved` or `⏭ Unfixable` in the improvement log below
- Is not `find_a_grant`, `agentic_scan`, or `innovate_uk`

### Step 2 — Probe the live detail page

Fetch 2–3 grant URLs from that source directly from the DB:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('opportunities').select('name, url, description, eligibility').eq('source', 'SLUG').limit(3).then(r => console.log(JSON.stringify(r.data, null, 2)));
" 2>/dev/null
```

Use WebFetch on each URL. Assess what additional content is available:
- Is there a longer description / "about this grant" paragraph?
- Is there an "eligibility" or "who can apply" section?
- Is there a funding amount (£/€) not captured?
- Is there a closing date or deadline not captured?

If a URL returns 403/404/JS-only/502: mark as unfixable, log reason, skip.

### Step 3 — Read the existing source + normaliser

Read:
- `data-pipeline/src/sources/<slug>.ts`
- `data-pipeline/src/transforms/normalise-<slug>.ts`
- `data-pipeline/tests/<slug>.test.ts`

Understand the current extraction logic before changing anything.

### Step 4 — Implement improvements

Apply whichever improvements the live page supports. Common patterns:

**A. Add multi-paragraph description (replaces single-paragraph capture):**
```typescript
// Collect all substantial paragraphs up to ~2,000 chars
const descParts: string[] = [];
$("main p, .entry-content p, article p, .content p").each((_i, el) => {
  const text = $(el).text().trim();
  if (text.length > 60) descParts.push(text);
});
const description = descParts.length > 0
  ? descParts.join("\n\n").slice(0, 2000)
  : null;
```

**B. Add eligibility extraction (using extractSection helper):**
```typescript
const eligibility = extractSection($, /who can apply|eligibility|who is eligible/i);
```

If the source doesn't have `extractSection`, implement it inline:
```typescript
function extractSection($: cheerio.CheerioAPI, headingPattern: RegExp): string | null {
  let result: string | null = null;
  $("h2, h3, h4").each((_i, el) => {
    if (result !== null) return;
    if (!headingPattern.test($(el).text().trim())) return;
    const parts: string[] = [];
    let sibling = $(el).next();
    while (sibling.length && !sibling.is("h2, h3, h4")) {
      const text = sibling.text().trim();
      if (text) parts.push(text);
      sibling = sibling.next();
    }
    if (parts.length > 0) result = parts.join("\n\n").slice(0, 1500);
  });
  return result;
}
```

**C. Add detail-page fetching loop (for scrapers that only parse listing):**
```typescript
const DETAIL_DELAY_MS = 300;

for (const item of items) {
  if (!item.url) continue;
  await sleep(DETAIL_DELAY_MS);
  try {
    const res = await fetchWithRetry(item.url);
    if (!res.ok) continue;
    const html = await res.text();
    const $d = cheerio.load(html);

    // Description
    const descParts: string[] = [];
    $d("main p, article p, .content p, .entry-content p").each((_i, el) => {
      const text = $d(el).text().trim();
      if (text.length > 60) descParts.push(text);
    });
    if (descParts.length > 0) item.description = descParts.join("\n\n").slice(0, 2000);

    // Eligibility
    item.eligibility = extractSection($d, /who can apply|eligibility|who is eligible/i);

    // Amount (if not already captured)
    if (!item.amountRaw) {
      const bodyText = $d("body").text();
      const amountMatch = bodyText.match(/(?:up\s+to\s+)?((?:£|€|€)\s*[\d,]+(?:\s*(?:k|m|million))?)/i);
      if (amountMatch) item.amountRaw = amountMatch[0].trim();
    }

    // Deadline (if not already captured)
    if (!item.deadlineRaw) {
      const bodyText = $d("body").text();
      const dateMatch = bodyText.match(/(?:deadline|closing date|closes?)[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i);
      if (dateMatch) item.deadlineRaw = dateMatch[1];
    }
  } catch {
    // Skip failed detail fetches — listing data is still valid
  }
}
```

**D. Fix hardcoded scope strings** — if `scope` is hardcoded as a subject area (e.g. `"mathematics, statistics, computer science"`), replace with either a real extracted scope section or `null`. Never store subject labels as scope.

**E. Wolfson / JS-rendered sub-pages** — if WebFetch returns 502/403/JS-only shell on detail pages: mark as unfixable in the log. Do not spend more than one probe attempt.

### Step 5 — Update the normaliser

Ensure `RawXxx` interface has `description`, `eligibility`, `scope` fields and the normaliser maps them:
```typescript
description: raw.description || null,
eligibility: raw.eligibility || null,
scope: raw.scope || null,
```

Remove hardcoded subject strings from `scope`.

### Step 6 — Update tests

Update the fixture HTML in `data-pipeline/tests/<slug>.test.ts` to include realistic content for the new fields. If detail-page fetching was added, add a fixture for a detail page and test that description/eligibility are extracted correctly.

Run: `npm test -w data-pipeline` — must pass before proceeding.

### Step 7 — Re-ingest and verify

```bash
npm run ingest -w data-pipeline -- <slug>
```

Then verify improvement:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('opportunities').select('name, description, eligibility, amount_min, deadline_date').eq('source', 'SLUG').limit(5).then(r => {
  for (const row of r.data) {
    console.log('---');
    console.log('name:', row.name);
    console.log('desc:', row.description ? row.description.slice(0, 120) + '...' : 'NULL');
    console.log('elig:', row.eligibility ? row.eligibility.slice(0, 80) + '...' : 'NULL');
    console.log('amount_min:', row.amount_min);
    console.log('deadline_date:', row.deadline_date);
  }
});
" 2>/dev/null
```

Quality bar — only commit if the re-ingest shows improvement over the baseline:
- `avg_desc` increased OR description was null and is now populated
- `eligibility` populated if the live page has a "who can apply" section
- `amount_min` / `deadline_date` populated if the live page shows them

### Step 8 — Commit

```
fix(data-pipeline): improve <slug> data quality — richer descriptions, eligibility, amounts
```

Update the improvement log below.

### Step 9 — Next iteration

Re-run the quality audit. Pick the next source. Repeat.

---

## Improvement Log

Updated each iteration. Format:

```
- **<slug>** ✅ Improved (YYYY-MM-DD) — avg_desc N→M, elig 0→X, amounts Y%, deadlines Z%
- **<slug>** ⏭ Unfixable (YYYY-MM-DD) — reason (502 on detail pages / JS-only / no detail pages exist)
- **<slug>** ✅ Already good — avg_desc >300, elig populated, skipped
```

---

## Completion Criteria

Output `<promise>DONE</promise>` when ALL of the following are true:

- Every source in `OPPORTUNITY_SOURCES` (excluding `find_a_grant`, `agentic_scan`, `innovate_uk`) has been either improved or marked unfixable/already-good
- `npm test -w data-pipeline` passes
- The improvement log is committed and up to date
- Re-running the quality audit shows no source with `avg_desc = 0` that could be fixed

---

## Out of Scope

- Adding new scrapers (separate loop)
- JS-rendered sources that require headless browsers
- Paid data sources
- `find_a_grant`, `agentic_scan`, `innovate_uk` — already high quality
