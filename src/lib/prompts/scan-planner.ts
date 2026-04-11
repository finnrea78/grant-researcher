export const SCAN_PLANNER_PROMPT = `
Plan which grant funder URLs to scan, optionally discovering new ones via Tavily search.
Output a scan plan file — do NOT fetch any page content.

## Your inputs

### 1. Seed URL list
Read \`funding-sources/_urls.md\`. Each line has the format:
\`\`\`
funder-slug | https://url
\`\`\`
Empty lines and lines starting with \`#\` are comments — skip them.

### 2. Database-sourced funders (in task prompt)
The task prompt may include a section headed **"Database-sourced funders"** listing funders already
known to the database, with their last-harvest timestamps. Each entry indicates whether the funder
is **fresh** (harvested recently — skip it) or **stale** (needs re-scan — include it).

- If a funder from this section is marked fresh: add it to the \`skipped\` list with reason "harvested N days ago".
- If a funder from this section is marked stale: include it in \`urls\`.
- If a funder appears in both the seed list and this section, prefer the URL from this section.

### 3. Researcher profile (optional, in task prompt)
If the task prompt includes researcher profile fields (disciplinary fields, research themes, geographic
focus), activate **discovery mode** (see below).

---

## Discovery mode (researcher profile provided)

When a researcher profile is present:

1. Read the researcher's **disciplinary fields**, **research themes**, and **geographic focus**.
2. Use the **Tavily** MCP tool to search for 3–5 grant funding URLs relevant to those specifics.
   Suggested query patterns:
   - "[discipline] research grants UK [year]"
   - "[funder type] funding [research theme]"
   - "[geographic focus] studies fellowship funding"
3. For each newly discovered URL that is **not already** in \`_urls.md\` or the database-sourced list:
   - Add it to \`_urls.md\` by **appending** a new line in the format \`funder-slug | https://url\`.
     Derive the slug from the funder/domain name (lowercase, hyphen-separated). Never overwrite or
     reformat existing lines.
   - Include it in the \`urls\` list in the scan plan.

If no researcher profile is provided, skip Tavily entirely.

---

## Output: \`_scan-plan.json\`

Write \`funding-sources/_scan-plan.json\` with the following schema:

\`\`\`json
{
  "urls": [
    { "slug": "wellcome", "url": "https://wellcome.org/grant-funding/schemes" }
  ],
  "skipped": [
    { "slug": "ba", "reason": "harvested 2 days ago" }
  ]
}
\`\`\`

Rules:
- \`urls\` contains every funder that Phase 2 should fetch and extract — seed + stale database funders +
  newly discovered.
- \`skipped\` contains every funder excluded from this run, with a human-readable reason.
- A funder should appear in exactly one list.
- Do not duplicate entries across both lists.

---

## Constraints

- **Do NOT use WebFetch or WebSearch.** Use Tavily only, and only when discovery mode is active.
- **Do NOT fetch any page content.** Phase 2 (scan-extractor) handles that. Your only job is to
  produce \`_scan-plan.json\`.
- Append new URLs to \`_urls.md\` — never overwrite or truncate existing content.
- maxTurns for this phase is 10 — be efficient.

---

## Completion report

After writing \`_scan-plan.json\`, report:
- Total URLs queued for Phase 2
- Total skipped (with reason summary)
- Any newly discovered URLs appended to \`_urls.md\` (if discovery mode was active)
`.trim();
