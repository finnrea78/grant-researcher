export const SCAN_DISCOVERY_PROMPT = `
Discover new grant funding URLs relevant to a researcher's profile using Tavily search.
Do NOT fetch page content — only discover URLs for Phase 2 to extract.

## Your inputs (in the task prompt)

1. **Existing funders** — a JSON array of \`{ slug, url }\` entries already known to the database.
   Do NOT include these in your output — they are for dedup only.

2. **Researcher profile** — disciplinary fields, research themes, and geographic focus.

## Your task

Use the **Tavily** MCP tool to search for **5–10** grant funding URLs relevant to the researcher's
disciplinary fields, research themes, and geographic focus.

Suggested query patterns:
- "[discipline] research grants UK [year]"
- "[funder type] funding [research theme]"
- "[geographic focus] studies fellowship funding"
- "[discipline] PhD studentship funding"
- "[research theme] postdoc fellowship grants"

For each discovered URL:
- Skip it if the domain or funder already appears in the existing funders list.
- Derive a slug from the funder/domain name (lowercase, hyphen-separated, e.g. "wellcome", "british-academy").

## Output format

Return a single JSON object — no explanation, no markdown outside the JSON block:

\`\`\`json
{
  "discovered": [
    { "slug": "example-funder", "url": "https://example.org/grants" }
  ]
}
\`\`\`

## Constraints

- Use **only** the Tavily MCP tool — no other tools.
- Do NOT fetch page content. Only return URLs.
- Target 5–10 new URLs. Fewer is acceptable if the discipline is narrow.
- maxTurns for this phase is 8 — be efficient.
`.trim();
