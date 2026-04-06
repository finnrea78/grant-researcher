export const RESEARCHER_ENRICHER_PROMPT = `
Research a researcher online to enrich their profile with web-sourced data. You have access to WebSearch and WebFetch for this purpose.

## Instructions

### Step 1: Read Local Data

1. Read intake.json — this contains optional user-provided fields: google_scholar_url and future_research.
2. Read profile.json — this contains the CV-extracted profile (name, institution, department, research_themes, etc.).

### Step 2: Google Scholar

**If google_scholar_url is present in intake.json:**
- Use WebFetch to retrieve the page and confirm it belongs to this researcher (name and institution must match).
- Extract: h-index, citation count, and the 5 most recent publications listed.
- Proceed to Step 3.

**If google_scholar_url is NOT in intake.json:**
- Use WebSearch to find the researcher's Google Scholar profile.
  - Search query: "[name] [institution] site:scholar.google.com"
  - Also try: "[name] [department] google scholar"
- Evaluate the top results. A strong match has the researcher's exact name, institution, and at least one publication title overlapping with profile.json.
- If you find a high-confidence match (name + institution confirmed):
  - Write enrich-pending.json: { "candidate_url": "[url]", "candidate_confidence": "high" }
  - Note: the user must confirm this URL before you use it. Proceed to Step 3 WITHOUT fetching the Scholar page.
- If you find a medium-confidence match (name matches but institution unclear):
  - Write enrich-pending.json: { "candidate_url": "[url]", "candidate_confidence": "medium" }
  - Proceed to Step 3 WITHOUT fetching the Scholar page.
- If no match found:
  - Do not write enrich-pending.json. Proceed to Step 3.

### Step 3: Additional Web Research

Regardless of Scholar status, search for the researcher online:

1. Search for their institutional profile page: "[name] [institution]"
   - Use WebFetch to retrieve it if found.
   - Extract: any information not in the CV (recent news, awards, collaborative projects, public engagement activities).

2. Search for recent publications or media coverage: "[name] [research_themes[0]] 2023 OR 2024 OR 2025"
   - Note any publications, conference keynotes, or press coverage not captured in profile.json.

3. If future_research is present in intake.json, note it explicitly — it will be used in the output.

### Step 4: Enrich profile.json

Read the current profile.json. Add or update only these fields (do NOT overwrite any CV-extracted fields):

- google_scholar_url: the confirmed URL (only if intake.json provided one AND you verified it in Step 2)
- future_research: the value from intake.json (if present)
- scholar_h_index: integer (only if you fetched the Scholar page)
- scholar_citation_count: integer (only if you fetched the Scholar page)

Write the updated profile.json.

### Step 5: Write researcher-context.md

Write a structured summary at the researcher-context.md path provided. This file is the completion marker for the Enrich stage — write it last.

Format:

\`\`\`markdown
# Researcher Context: [Name]

> Enriched: YYYY-MM-DD
> Sources checked: [list of URLs fetched]

## Online Presence

[2-3 sentences: What did you find about this researcher online? Institutional page found? Active online presence?]

## Recent Activity (Beyond CV)

[Any publications, keynotes, awards, collaborations, or news found online that are not in the CV. Use bullet points. If nothing found, say so.]

## Citation Profile

[If Scholar was fetched: h-index X, Y total citations, most cited works listed. If Scholar pending confirmation: "Scholar profile candidate found — awaiting user confirmation." If no Scholar found: "No Scholar profile identified."]

## Future Research Direction

[If future_research was provided in intake: quote or paraphrase it here. Explain how it connects to the researcher's existing track record. If not provided: "No future research direction provided by researcher."]

## Enrichment Notes for Grant Matching

[2-3 sentences: How does this enriched context change or strengthen the grant matching picture? What does the web research reveal that the CV alone did not?]
\`\`\`

### Step 6: Write retrieval_summary into profile.json

Read the current profile.json. Add a new field \`retrieval_summary\` — a single string of approximately 400 words written in natural, coherent prose.

This summary is used to compute a semantic embedding for grant matching. Write it to surface implicit connections and research affinities, NOT as a keyword dump.

Include:
- What the researcher actually studies (their core intellectual concerns, not just subject labels)
- Their key methodological approaches and theoretical frameworks
- The geographic, cultural, or thematic contexts of their work
- What their current projects are trying to achieve
- The trajectory of their career and where they are heading
- What kinds of funding and collaborations would suit them

Write in third-person, present tense. Be specific about their actual work, not generic. A good summary makes it possible to find funding opportunities that fit even if they use different terminology.

Example opening: "Dr [Name] is a [field] researcher at [institution] whose work centres on [specific topic]. Their current projects explore [specific angles]..."

Write the updated profile.json with this new field added (do not overwrite other fields).

### Step 7: Report Completion

After writing both files, report:
- Whether Google Scholar was found and at what confidence level
- Number of web sources checked
- Key new information found beyond the CV
- Any fields that could not be populated
`.trim();
