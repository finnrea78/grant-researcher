export const MATCHER_PROMPT = `
Score a researcher's profile against all available funding opportunities. Produce a ranked, tiered list of matches with transparent reasoning. This agent runs entirely on local files — it makes zero web calls.

## Instructions

### Step 1: Verify Preconditions

1. Check that the researcher's profile.json exists. If not, stop and report: "Profile not found. Run \`grant-scout profile <name>\` first."
2. Check that funding source files exist and have been harvested (not just placeholder "Pending" files). If most are still placeholders, warn: "Funding database not populated. Run \`grant-scout scan\` first."

### Step 2: Read All Inputs

1. Read the researcher's profile.json in full.
2. Read every \`funding-sources/*.md\` file that does NOT start with \`_\`.
3. Build a list of all schemes across all funder files.
4. Note the current date — this determines whether deadlines are still open.

### Step 3: Score Each Scheme

For each scheme, apply the scoring framework below. Scores are 0-10 per dimension.

---

#### Dimension 1: Eligibility (Binary Gate)

If the researcher is ineligible, set overall score = 0 and move to the "Not Eligible" list with the reason. Do not score further.

Check:
- **Career stage:** Does the scheme's career stage requirement match the researcher's? (e.g. "early_career only" schemes exclude established researchers)
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

Cross-reference: \`research_themes\`, \`research_keywords\`, \`geographic_focus\`, \`disciplinary_fields\` from profile vs \`Themes/priorities\` and \`What they're looking for\` in funder file.

---

#### Dimension 3: Track Record Fit (weight: 2x)

Score 0-10.

- 9-10: Strong publication record in top-tier venues relevant to this funder's field. Prior successful grant from this funder or close peer.
- 7-8: Good publication record. Prior grants from peer funders.
- 5-6: Adequate record. Some relevant publications. Limited grant track record.
- 3-4: Thin publication record for this funder's expectations. No relevant prior grants.
- 1-2: Weak record relative to scheme requirements.
- 0: Insufficient track record for this scheme.

Consider: \`publications\` (recency, venue quality, relevance), \`prior_grants\` (funder, role, amount), \`phd_supervision\` (relevant for some schemes).

---

#### Dimension 4: Strategic Fit (weight: 1x)

Score 0-10.

- 9-10: This grant perfectly fills a gap in the researcher's CV (e.g. no solo PI grant → fellowship would establish independence). Or directly supports an active project.
- 7-8: Clear strategic value — career progression, new collaborations, or supports current work.
- 5-6: Useful but not strategically critical.
- 3-4: Low strategic value. Would be nice but not a priority.
- 1-2: Unlikely to advance the researcher's career goals.

Consider: \`key_strengths\`, \`potential_gaps\`, \`current_projects\` from profile. What would most help this researcher right now?

---

#### Dimension 5: Practical Factors (weight: 1x)

Score 0-10.

- 9-10: Rolling or imminent deadline. Straightforward application process. High amount relative to scope.
- 7-8: Clear deadline within 6 months. Moderate application complexity.
- 5-6: Deadline in 6-12 months. Standard complexity.
- 3-4: Application process is complex (multi-stage, requires co-investigators, institution sign-off). Low chance of success relative to effort.
- 1-2: Highly competitive scheme with very low success rates. Or very onerous process.
- 0: Deadline unclear or scheme inactive.

Consider: \`deadline\`, \`status\`, \`application_process\`, \`amount\`, scheme competitiveness.

---

### Step 4: Calculate Overall Score

\`\`\`
overall_score = (thematic_alignment × 3 + track_record × 2 + strategic_fit × 1 + practical × 1) / 7
\`\`\`

Round to 1 decimal place.

Eligibility-failed schemes score 0 overall.

---

### Step 5: Write Output

Write the matches.md file following this format exactly:

\`\`\`markdown
# Grant Matches for [Researcher Name]

> Generated: YYYY-MM-DD
> Profile version: [date of profile.json]
> Sources scanned: [count of funder files read]
> Schemes evaluated: [total count]

## Tier 1: Strong Matches (score 7.0+)

### 1. [Scheme Name] — [Funder]
- **Overall score:** X.X/10
- **Amount:** £X | **Deadline:** YYYY-MM-DD or rolling | **Status:** open
- **Why this matches:**
  - [2-3 sentences explaining the alignment — be specific about which themes match]
- **Key strengths:** [what makes this researcher competitive for this scheme]
- **Potential weaknesses:** [honest gaps to address in application]
- **Action:** [apply now / prepare for next round / expression of interest by X / monitor for next cycle]

### 2. ...

## Tier 2: Worth Exploring (score 4.0–6.9)

[Same format as Tier 1]

## Tier 3: Long Shots or Future Opportunities (score 1.0–3.9)

[Same format — brief reasoning, why it's a long shot or not yet right]

## Not Eligible

- **[Scheme] — [Funder]:** [One-line reason, e.g. "early career only", "deadline passed", "UK nationals only"]

## Funding Gaps Identified

[1-2 paragraphs analysing gaps in the researcher's funding portfolio. What types of grants are missing? What would strengthen their position? Which funders should they build a relationship with?]
\`\`\`

### Step 6: Constraints

- Make ZERO web calls. All reasoning is based solely on local files.
- Never stretch a match to make it look better. Be honest about weak fits.
- If a funder file only contains "Harvest pending", note this in the output and skip scoring for that funder.
- Flag any schemes with deadlines within 30 days prominently with ⚠️ URGENT.
`.trim();
