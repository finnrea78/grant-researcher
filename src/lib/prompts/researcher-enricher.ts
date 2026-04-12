export const RESEARCHER_ENRICHER_PROMPT = `
Research a researcher online to enrich their profile with web-sourced data. You have access to WebSearch and WebFetch for this purpose.

All researcher context is injected in the user prompt — do NOT read any local files. There are no files to read; this system operates entirely through a database.

## Instructions

### Step 1: Read Injected Context

The user prompt contains:
- The researcher's current profile from the database (name, institution, department, research_themes, etc.)
- Their publications context (publications_md), if available

Read this context carefully before proceeding. Do not attempt to read any files.

### Step 2: Google Scholar

**If google_scholar_url is present in the injected profile:**
- Use WebFetch to retrieve the page and confirm it belongs to this researcher (name and institution must match).
- Extract: h-index, citation count, and the 5 most recent publications listed.
- Proceed to Step 3.

**If google_scholar_url is NOT in the injected profile:**
- Use WebSearch to find the researcher's Google Scholar profile.
  - Search query: "[name] [institution] site:scholar.google.com"
  - Also try: "[name] [department] google scholar"
- Evaluate the top results. A strong match has the researcher's exact name, institution, and at least one publication title overlapping with the injected profile.
- If you find a high-confidence match (name + institution confirmed):
  - Include a scholar_candidate in your JSON output: { "candidate_url": "[url]", "candidate_confidence": "high" }
  - The user must confirm this URL before it is used. Proceed to Step 3 WITHOUT fetching the Scholar page.
- If you find a medium-confidence match (name matches but institution unclear):
  - Include a scholar_candidate in your JSON output: { "candidate_url": "[url]", "candidate_confidence": "medium" }
  - Proceed to Step 3 WITHOUT fetching the Scholar page.
- If no match found:
  - Set scholar_candidate to null in your JSON output. Proceed to Step 3.

### Step 3: Additional Web Research

Regardless of Scholar status, search for the researcher online:

1. Search for their institutional profile page: "[name] [institution]"
   - Use WebFetch to retrieve it if found.
   - Extract: any information not in the injected profile (recent news, awards, collaborative projects, public engagement activities).

2. Search for recent publications or media coverage: "[name] [research_themes[0]] 2023 OR 2024 OR 2025"
   - Note any publications, conference keynotes, or press coverage not captured in the profile.

3. If future_research is present in the injected profile, note it explicitly — it will be used in the output.

### Step 4: Prepare Enriched Fields

Based on your research, prepare the enriched fields to merge into the profile. Include only fields you have actually found:

- google_scholar_url: the confirmed URL (only if the profile already had one AND you verified it in Step 2)
- future_research: the value from the injected profile (if present)
- scholar_h_index: integer (only if you fetched the Scholar page)
- scholar_citation_count: integer (only if you fetched the Scholar page)
- recent_publications_web: array of publication objects found online (if any)

Do NOT include retrieval_summary — this is generated separately after your output.

### Step 5: Prepare Researcher Context

Write a structured researcher context summary as a string. This captures everything you found that enriches the picture beyond the CV.

Format as markdown:

\`\`\`
# Researcher Context: [Name]

> Enriched: YYYY-MM-DD
> Sources checked: [list of URLs fetched]

## Online Presence

[2-3 sentences: What did you find about this researcher online? Institutional page found? Active online presence?]

## Recent Activity (Beyond CV)

[Any publications, keynotes, awards, collaborations, or news found online that are not in the profile. Use bullet points. If nothing found, say so.]

## Citation Profile

[If Scholar was fetched: h-index X, Y total citations, most cited works listed. If Scholar pending confirmation: "Scholar profile candidate found — awaiting user confirmation." If no Scholar found: "No Scholar profile identified."]

## Future Research Direction

[If future_research was provided in the profile: quote or paraphrase it here. Explain how it connects to the researcher's existing track record. If not provided: "No future research direction provided by researcher."]

## Enrichment Notes for Grant Matching

[2-3 sentences: How does this enriched context change or strengthen the grant matching picture? What does the web research reveal that the CV alone did not?]
\`\`\`

### Step 6: Return JSON Output

Return a single JSON object (no markdown fences, no extra text before or after). The object must have exactly these keys:

- "enriched_fields": object with fields to merge into the profile (e.g. google_scholar_url, scholar_h_index, scholar_citation_count, recent_publications_web). Omit retrieval_summary — it is generated separately.
- "scholar_candidate": object { candidate_url, candidate_confidence } if a candidate Scholar profile was found but not yet confirmed, or null if already confirmed or not found.
- "researcher_context_md": the researcher context markdown string from Step 5.

Example structure:
{
  "enriched_fields": {
    "google_scholar_url": null,
    "scholar_h_index": null
  },
  "scholar_candidate": {
    "candidate_url": "https://scholar.google.com/citations?user=abc123",
    "candidate_confidence": "high"
  },
  "researcher_context_md": "# Researcher Context: ..."
}

Do NOT write any files. Return only the JSON object above.
`.trim();
