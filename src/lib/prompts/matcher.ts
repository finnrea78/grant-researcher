export const MATCHER_PROMPT = `
Score a researcher's profile against the provided funding opportunities. Produce a ranked, tiered list of matches with transparent reasoning. Opportunities are passed directly as JSON — do NOT search for files.

## Instructions

### Step 1: Read Inputs

1. Read the researcher's profile.json in full.
2. If a file named \`researcher-context.md\` exists alongside profile.json, read it for enriched context (citations, online presence, future research direction).
3. If a file named \`proposal-intent.json\` exists alongside profile.json, read it. Use it to sharpen Thematic Alignment and Strategic Fit scoring.
4. Read the list of funding opportunities from the \`<opportunities>\` JSON block in your input prompt. Do NOT read any files from funding-sources/.
5. Note the current date — this determines whether deadlines are still open.

### Step 2: Score Each Opportunity

For each opportunity in the JSON, apply the scoring framework below. Scores are 0-10 per dimension.

---

#### Dimension 1: Eligibility (Binary Gate)

If the researcher is ineligible, set overall score = 0 and move to the "Not Eligible" list with the reason. Do not score further.

Check:
- **Career stage:** Does the scheme's career stage requirement match the researcher's?
- **Institution:** Must be UK HEI? Is the researcher at a qualifying institution?
- **Nationality/residency:** Any restrictions that exclude this researcher?
- **Prior grant restrictions:** e.g. "must not have held a major grant" — check against \`prior_grants\` in profile.
- **Deadline:** If the deadline has passed and no next round is announced, mark as closed.

---

#### Dimension 2: Thematic Alignment (weight: 3x)

Score 0-10. This is the most important dimension.

- 9-10: Researcher's primary themes directly match the funder's stated priorities. The researcher's geographic/cultural focus is explicitly mentioned.
- 7-8: Strong overlap on 2+ themes. Funder's scope clearly includes this researcher's work.
- 5-6: Moderate overlap. The researcher could make a case for fit, but it's not obvious.
- 3-4: Tangential connection. Would require significant reframing.
- 1-2: Minimal overlap. Only very general alignment (e.g. "humanities").
- 0: No thematic alignment.

Cross-reference: \`research_themes\`, \`research_keywords\`, \`geographic_focus\`, \`disciplinary_fields\` from profile vs \`scope\`, \`description\` from the opportunity.

---

#### Dimension 3: Track Record Fit (weight: 2x)

Score 0-10.

- 9-10: Strong publication record in top-tier venues relevant to this funder's field. Prior successful grant from this funder or close peer.
- 7-8: Good publication record. Prior grants from peer funders.
- 5-6: Adequate record. Some relevant publications. Limited grant track record.
- 3-4: Thin publication record for this funder's expectations. No relevant prior grants.
- 1-2: Weak record relative to scheme requirements.
- 0: Insufficient track record for this scheme.

Consider: \`publications\` (recency, venue quality, relevance), \`prior_grants\` (funder, role, amount), \`phd_supervision\`.

---

#### Dimension 4: Strategic Fit (weight: 1x)

Score 0-10.

- 9-10: This grant perfectly fills a gap in the researcher's CV or directly supports an active project.
- 7-8: Clear strategic value — career progression, new collaborations, or supports current work.
- 5-6: Useful but not strategically critical.
- 3-4: Low strategic value.
- 1-2: Unlikely to advance the researcher's career goals.

Consider: \`key_strengths\`, \`potential_gaps\`, \`current_projects\` from profile.

---

#### Dimension 5: Practical Factors (weight: 1x)

Score 0-10.

- 9-10: Rolling or imminent deadline. Straightforward application. High amount relative to scope.
- 7-8: Deadline within 6 months. Moderate complexity.
- 5-6: Deadline in 6-12 months. Standard complexity.
- 3-4: Complex process. Low success rate relative to effort.
- 1-2: Highly competitive, onerous process.
- 0: Deadline unclear or scheme inactive.

Consider: \`deadline_date\`, \`deadline_raw\`, \`status\`, \`funding_type\`, \`amount_raw\`.

---

### Step 3: Calculate Overall Score

\`\`\`
overall_score = (thematic_alignment × 3 + track_record × 2 + strategic_fit × 1 + practical × 1) / 7
\`\`\`

Round to 1 decimal place. Eligibility-failed schemes score 0 overall.

---

### Step 4: Write Output

Write the matches.md file following this format exactly:

\`\`\`markdown
# Grant Matches for [Researcher Name]

> Generated: YYYY-MM-DD
> Profile version: [date of profile.json]
> Opportunities evaluated: [total count from JSON]

## Tier 1: Strong Matches (score 7.0+)

### 1. [Scheme Name] — [Funder]
- **Overall score:** X.X/10
- **Amount:** £X | **Deadline:** YYYY-MM-DD or rolling | **Status:** open
- **URL:** [url from opportunity]
- **Why this matches:**
  - [2-3 sentences explaining the alignment — be specific about which themes match]
- **Key strengths:** [what makes this researcher competitive]
- **Potential weaknesses:** [honest gaps to address]
- **Action:** [apply now / prepare for next round / monitor for next cycle]

## Tier 2: Worth Exploring (score 4.0–6.9)

[Same format as Tier 1]

## Tier 3: Long Shots or Future Opportunities (score 1.0–3.9)

[Same format — brief reasoning]

## Not Eligible

- **[Scheme] — [Funder]:** [One-line reason]

## Funding Gaps Identified

[1-2 paragraphs: gaps in the researcher's portfolio, types missing, funders to build relationships with]
\`\`\`

### Step 5: Constraints

- Make ZERO web calls.
- Never stretch a match. Be honest about weak fits.
- Flag schemes with deadlines within 30 days with ⚠️ URGENT.
`.trim();
