export const SCAN_EXTRACTOR_PROMPT = `
Extract structured grant funding data from pre-fetched page content.
Output a single JSON object — nothing else.

## Your inputs (provided in the user prompt)

- **Funder slug** — e.g. \`wellcome\`
- **Source URL** — the canonical URL of the page that was fetched
- **Page content** — full markdown rendering of the page

## Your output

Output **only** a single JSON object with no markdown code fences, no preamble, no explanation.
The object must match this schema exactly:

\`\`\`
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
      "deadline_raw": "Rolling",
      "deadline_date": null,
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

## Field rules

### Top-level fields
- \`funder_slug\` — use the slug provided in the user prompt verbatim
- \`funder_name\` — extract the funder's full official name from the page; if not determinable, derive from the slug
- \`source_url\` — use the source URL provided in the user prompt verbatim
- \`disciplines\` — list of research discipline tags inferred from the page (e.g. \`["health", "biomedical"]\`); empty array if none can be determined

### Per-opportunity fields
- \`name\` — full scheme name as it appears on the page
- \`slug\` — lowercase, hyphen-separated version of the scheme name (e.g. \`"discovery-research"\`)
- \`status\` — one of: \`"open"\`, \`"closed"\`, \`"upcoming"\`, \`"rolling"\`, or \`null\` if not determinable
- \`deadline_raw\` — deadline text exactly as it appears on the page, or \`null\`
- \`deadline_date\` — ISO 8601 date (\`YYYY-MM-DD\`) if the deadline is a specific date, otherwise \`null\`
- \`amount_raw\` — award amount text exactly as it appears on the page, or \`null\`
- \`amount_min\` — minimum award in GBP as a number (no currency symbol, no commas), or \`null\`
- \`amount_max\` — maximum award in GBP as a number, or \`null\`
- \`url\` — direct URL to the scheme page if present on the page, otherwise \`null\`
- \`funding_type\` — e.g. \`"research grant"\`, \`"fellowship"\`, \`"travel grant"\`, or \`null\`
- \`description\` — brief description of the scheme's purpose (1–3 sentences), or \`null\`
- \`eligibility\` — eligibility criteria as described on the page, or \`null\`
- \`scope\` — thematic or disciplinary scope of the scheme, or \`null\`

## Hard rules

- Use \`null\` for any field that cannot be determined from the page content — **never guess or invent values**.
- Do not add fields beyond those in the schema.
- If the page contains no funding schemes (e.g. an error page or redirect), output:
  \`{"funder_slug":"<slug>","funder_name":null,"source_url":"<url>","disciplines":[],"opportunities":[]}\`
- Output the JSON object only — the very first character of your response must be \`{\` and the last must be \`}\`.
`.trim();
