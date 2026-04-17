---
name: scrape-grants
description: Discover new grant funders and opportunities via web search, extract structured data, and load into Supabase. Use when the user wants to find new funding sources or run a grant discovery loop.
user-invocable: true
---

# Grant Discovery via Web Search

You are a grant discovery agent. Your job is to find **new** grant funders and funding opportunities that are NOT already in the database, extract structured data from their websites, and load it into Supabase.

## Step 0 — Check environment

Before doing anything, verify that the required env vars are set:

```bash
node -e "const u=process.env.SUPABASE_URL; const k=process.env.SUPABASE_SERVICE_ROLE_KEY; if(!u||!k){console.log('MISSING')}else{console.log('OK')}"
```

If `MISSING`, ask the user:

> I need your Supabase credentials to write discovered grants to the database.
> Please paste your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Then export them in the current shell before proceeding:
```bash
export SUPABASE_URL="<value>"
export SUPABASE_SERVICE_ROLE_KEY="<value>"
```

Optionally ask for `OPENAI_API_KEY` (needed for embeddings, not required).

## Step 1 — Load existing funders

Run:
```bash
cd data-pipeline && node --import=tsx src/cli.ts list-funders
```

Parse the output to build a list of **known funder slugs**. You will skip these during discovery.

## Step 2 — Discover new funders via WebSearch

Use **WebSearch** to find UK and international research grant opportunities. Vary your queries each run to explore different areas. Example queries:

- "UK research grants open applications 2026"
- "charity research funding opportunities UK"
- "European research council open calls"
- "medical research grants currently open"
- "STEM research fellowships accepting applications"
- "arts humanities research funding open"
- "environmental research grants deadline 2026"

Run at least 3-5 different searches per session.

For each search result:
1. Identify the **funder organisation** (e.g., "British Academy", "Cancer Research UK")
2. Derive a slug: lowercase, hyphens, no special chars (e.g., `british-academy`, `cancer-research-uk`)
3. **Skip** if the slug matches any known funder from Step 1
4. If new, add to your discovery list

## Step 3 — Fetch and extract opportunities

For each **new** funder discovered:

1. Use **WebFetch** to load their grants/funding page
2. Extract every open funding opportunity you can find on the page
3. For each opportunity, extract these fields **verbatim from the page** (do NOT paraphrase or invent data):

| Field | How to extract |
|-------|---------------|
| `name` | Exact grant/scheme title as shown on the page |
| `funder_slug` | The slug you derived in Step 2 |
| `funder_name` | Full funder name as shown on their website |
| `slug` | Slugified version of the grant name |
| `status` | "open" if accepting applications, "closed" otherwise |
| `deadline_raw` | Deadline text exactly as shown (e.g., "30 June 2026, 4pm") |
| `deadline_date` | ISO date YYYY-MM-DD parsed from deadline_raw, or null |
| `amount_raw` | Funding amount text exactly as shown (e.g., "up to 500,000") |
| `amount_min` | Minimum amount in **pence** (multiply pounds by 100), or null |
| `amount_max` | Maximum amount in **pence**, or null |
| `amount_currency` | "GBP", "EUR", or "USD" |
| `url` | Direct URL to the opportunity page |
| `funding_type` | "grant", "fellowship", "studentship", or null |
| `description` | First 1-2 paragraphs describing the scheme |
| `eligibility` | Who can apply (verbatim from page), or null |
| `scope` | What research areas are covered, or null |
| `source` | Always `"claude_web_extract"` |
| `source_metadata` | `{}` or any extra context as JSON |

**IMPORTANT — amounts are in PENCE:**
- "500,000" (pounds) = `50000000` (pence)
- "2.5 million" = `250000000` (pence)
- "50k" = `5000000` (pence)
- If unsure, set both `amount_min` and `amount_max` to `null` and put the text in `amount_raw`

## Step 4 — Verify against hallucinations

For each opportunity extracted, do a verification pass:

1. If you extracted from a listing page, **WebFetch the individual opportunity URL** to confirm:
   - The grant name matches
   - The deadline matches
   - The amount matches
2. If any field does NOT match, use the value from the detail page
3. If you cannot verify (page won't load, behind auth, etc.), mark the opportunity with `source_metadata: { "verified": false }` but still include it
4. For verified opportunities, set `source_metadata: { "verified": true }`

**Never invent deadlines, amounts, or eligibility criteria.** If a field isn't on the page, set it to `null`.

## Step 5 — Write JSON and load into database

1. Collect all verified opportunities into a JSON array
2. Write to a temp file:
```bash
cat > /tmp/claude-grants.json << 'GRANTS_EOF'
[
  { ... your extracted opportunities ... }
]
GRANTS_EOF
```

3. Run the loader:
```bash
cd data-pipeline && node --import=tsx src/cli.ts claude-extract --file /tmp/claude-grants.json
```

4. Report the results (created/updated/skipped counts)

## Step 6 — Summary

After loading, provide a summary:
- How many new funders discovered
- How many opportunities extracted and loaded
- Any opportunities that failed verification (with reasons)
- Suggest follow-up queries for the next run

## Rules

- **Only extract data that is visibly on the page.** Never hallucinate grant details.
- **Always use WebFetch** to read the actual page. Never rely solely on WebSearch snippets.
- **Amounts in pence.** Multiply pounds by 100.
- **Skip known funders.** The value of this skill is discovery of NEW sources.
- **Be conservative.** It's better to set a field to null than to guess wrong.
- **This skill is safe to run repeatedly.** The pipeline uses upsert (funder_id + slug), so duplicates are handled gracefully.
