/**
 * @deprecated Use SCAN_PLANNER_PROMPT + SCAN_EXTRACTOR_PROMPT instead.
 * This prompt is no longer used by the scan route. Will be deleted in a follow-up.
 */
export const GRANT_SCANNER_PROMPT = `
Harvest funding data and write structured markdown files for each funder.

## Modes

### HARVEST mode (default)

Full harvest of all sources. Run this infrequently (monthly or when adding new sources).

### CHECK mode (--check flag)

Lightweight. Only re-fetches sources where _last-harvested.json shows more than 7 days since last harvest. Skip sources that are still fresh.

### FORCE mode (--force flag)

Ignore all timestamps. Re-harvest every source regardless of age.

---

## Smart Scan (when researcher profile is provided)

When a researcher profile is provided in the task prompt, perform a smart scan:

1. Read the researcher's disciplinary fields, research themes, and geographic focus from the provided profile data.
2. Use **WebSearch** to discover grant funding URLs relevant to those specific fields. Search queries should be targeted, for example:
   - "[discipline] research grants UK 2026"
   - "[funder type] funding [research theme]"
   - "[geographic focus] studies fellowship"
3. Combine discovered URLs with the seed list from \`funding-sources/_urls.md\` AND any database-sourced URLs provided in the task prompt.
4. When you discover a new funder URL via WebSearch that is NOT already in \`_urls.md\` or the database-sourced list, append it to \`_urls.md\` (so future non-smart scans pick it up) in the same format: \`funder-slug | https://url\`.
5. Harvest all URLs (seed + database-sourced + newly discovered) using **WebFetch**.
6. When writing each funder file, add a \`disciplines:\` field listing which research fields this funder covers (e.g. \`disciplines: art-history, african-studies, museum-studies\`).

If no researcher profile is provided, fall back to harvesting the seed URL list and any database-sourced URLs (no WebSearch).

---

## Database-Sourced URLs

When the task prompt includes a section headed "Database-sourced funders", treat those entries exactly like seed URLs — harvest them in the same flow. These were discovered by previous scans and should be re-harvested to keep opportunities current.

The task prompt may also include a list of existing opportunity slugs under "Existing opportunity slugs". When harvesting, skip any opportunity whose slug matches this list — it is already in the database and does not need re-extraction unless its fields have changed.

---

## Instructions

### Step 1: Determine Mode

Read which flag was passed via the task prompt:
- No flag → HARVEST mode
- --check → CHECK mode
- --force → FORCE mode

### Step 2: Read the URL List

Read \`funding-sources/_urls.md\`. Build the list of (file, URL) pairs to process.

In CHECK mode: also read \`_last-harvested.json\` and skip any source harvested within the last 7 days.

### Step 3: Harvest Each Source

For each URL to process:

1. Use **WebFetch** to retrieve the page content. Do NOT use WebSearch unless a researcher profile was provided (see Smart Scan above).
2. Extract all available funding schemes from the page:
   - Scheme name
   - Status (open/closed/upcoming/rolling)
   - Deadline
   - Amount/range
   - Duration
   - Career stage eligibility
   - Institutional eligibility
   - Thematic priorities
   - Application process summary
   - Direct URL to the scheme page
3. Write the extracted data to the corresponding \`funding-sources/<funder>.md\` file following the \`_template.md\` schema exactly.
4. If a researcher profile was provided, add \`disciplines: [field1, field2]\` to the funder file header.
5. Update \`_last-harvested.json\` with the current date for this source.
6. Append this funder's structured data to \`funding-sources/_discovered.json\`. This is a **cumulative array file** — read it first if it exists, then append. Each entry must follow this schema exactly:
   \`\`\`json
   {
     "funder_slug": "wellcome",
     "funder_name": "Wellcome Trust",
     "source_url": "https://wellcome.org/grant-funding/schemes",
     "disciplines": ["health", "biomedical"],
     "opportunities": [
       {
         "name": "Discovery Research",
         "slug": "discovery-research",
         "status": "open",
         "deadline_raw": "2026-07-15",
         "deadline_date": "2026-07-15",
         "amount_raw": "Up to £3M",
         "amount_min": null,
         "amount_max": 3000000,
         "url": "https://wellcome.org/grant-funding/schemes/discovery-research",
         "funding_type": "research grant",
         "description": "Supports discovery research with no defined scope.",
         "eligibility": "Must be at a UK/Republic of Ireland organisation.",
         "scope": "Any area of health-relevant research."
       }
     ]
   }
   \`\`\`
   - Use \`null\` for any fields you cannot extract from the page. Never guess or invent values.
   - The \`slug\` for each opportunity should be a lowercase, hyphen-separated version of the scheme name.
   - \`deadline_date\` must be in ISO 8601 format (YYYY-MM-DD) if determinable, otherwise \`null\`.

### Step 4: Handle Failures Honestly

If a URL fails to load, returns a redirect, or returns content that does not contain useful funding information:

- Write to the funder file:
  \`\`\`
  > Harvest failed: YYYY-MM-DD — [reason: e.g. "page returned no scheme data", "URL redirected", "timeout"]
  > Manual check required. URL: [url]
  \`\`\`
- Update \`_last-harvested.json\` with the attempt timestamp anyway, so CHECK mode knows not to retry immediately.
- Continue to the next source. Do NOT stop the entire harvest.

### Step 5: Do Not Hallucinate

**Never invent or guess funding information.** If the page does not state a deadline, write "TBC". If the page does not state an amount, write "varies". If the page does not describe eligibility, write "see URL".

### Step 6: Report Completion

After processing all sources, report:
- Sources successfully harvested (count and list)
- Sources that failed (count, file, and reason)
- Sources skipped because still fresh (CHECK mode only)
- Any sources where the URL needs manual attention
- Updated \`_last-harvested.json\` summary

---

## Important Constraints

- Use **WebFetch** on known URLs only unless smart scan is active.
- Use **WebSearch** only when a researcher profile is provided and only to discover relevant URLs — not for general browsing.
- Each URL should map to a specific funder file. Multiple URLs for the same funder should result in merged content in one file.
- Do not remove existing scheme data from a funder file unless you have confirmed the scheme no longer exists on the live page.
- Always update \`_last-harvested.json\` even if the harvest was partial or failed.
`.trim();
