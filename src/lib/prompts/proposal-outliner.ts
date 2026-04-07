export const PROPOSAL_OUTLINER_PROMPT = `
Draft a strategic alignment document for a specific grant opportunity. This is NOT a full proposal — it is a strategic framing document to help the researcher (or a grant writer) understand how to position their work for a specific call.

The researcher must write the actual proposal prose themselves.

## Instructions

### Step 1: Read Inputs

1. Read the researcher's profile.json.
2. If a file named \`researcher-context.md\` exists alongside profile.json (in the same directory), read it. It contains enriched context including citation metrics, recent work found online, and the researcher's stated future research direction. Use the future research direction especially to sharpen Section 1 (Project Framing) and Section 2 (Research Question Suggestions).
3. Use the opportunity details provided inline in the prompt (from the database). Do NOT look for a funder markdown file.

### Step 2: Verify the Fit

Before drafting, briefly confirm:
- Is the researcher eligible for this scheme?
- Does the thematic alignment justify a proposal?

If the researcher is clearly ineligible, stop and report this. Do not draft for an ineligible scheme.

### Step 3: Draft the Alignment Document

Write the proposal alignment document with these sections:

\`\`\`markdown
# Proposal Alignment: [Scheme Name] — [Funder]

**Researcher:** [Name]
**Generated:** YYYY-MM-DD
**Scheme deadline:** [deadline from opportunity data]
**Amount available:** [from opportunity data]

> This is a strategic alignment document, not a proposal draft.
> It identifies how to frame the researcher's work for this specific call.
> The researcher must write the actual application prose.

---

## 1. Project Framing

[How to position the researcher's work for this specific funder's priorities.
What angle of the researcher's expertise best fits this call?
What narrative connects their work to the funder's mission?
2-4 sentences.]

## 2. Research Question Suggestions

Suggest 2-3 possible research questions or project angles. Each should:
- Draw on the researcher's existing expertise and publications
- Align with the funder's stated priorities
- Be feasible within the scheme's budget and duration

### Option A: [Short title]
[2-3 sentences describing this angle, why it fits the funder, and what the project would do]

### Option B: [Short title]
[2-3 sentences]

### Option C: [Short title] (if applicable)
[2-3 sentences]

## 3. Key Publications to Cite

From the researcher's own record, identify the 4-6 publications that best demonstrate track record for this application. Explain briefly why each is relevant.

- **[Title] ([Year])** — [One sentence: what this demonstrates for this application]
- ...

## 4. Methodology Notes

[What methodological approach would resonate with this funder?
What methods has the researcher used previously that align with funder expectations?
Any methodological gaps to address?
2-4 sentences.]

## 5. Impact Narrative

[How to frame broader impact for this funder.
Consider: public engagement (museum work, exhibitions), cultural heritage, international dimension, policy, knowledge exchange.
What aspects of the researcher's work are most fundable here?
2-4 sentences.]

## 6. Weaknesses to Address

[Honest assessment of where this application might be challenged.
What will reviewers question? How can the researcher pre-empt this?]

- **Potential concern:** [description] → **How to address:** [suggestion]
- ...

## 7. Budget Considerations

[Rough sense of what to request and what to include in the budget.
What costs are typical for this type of project?
What does this funder typically fund (staff, fieldwork, publication costs, events)?
What does this funder NOT fund?
3-5 sentences.]

## 8. Timeline Suggestion

[Realistic project timeline for this scheme's duration.
What would a well-structured project look like?
Include: research phases, fieldwork, writing, dissemination.]

- Year 1: [key activities]
- Year 2: [key activities] (if applicable)
- Year 3: [key activities] (if applicable)

---

## Next Steps

1. Review this alignment document and select a research question angle
2. Check the funder's guidelines for any requirements not captured here
3. Contact the relevant research office at [institution] for institutional support
4. Draft a 1-page project summary before committing to the full application
5. If the scheme requires an expression of interest, submit by [EOI deadline if known]
\`\`\`

---

### Step 4: Constraints

- Base all suggestions on what is actually in the researcher's profile. Do not invent publications or grants.
- Be honest in Section 6 (weaknesses). This is the most valuable part of the document.
- Keep budget advice general — do not make up specific figures without basis.
- The output is advisory. Do not make the document sound like a completed application.
- If the opportunity data is missing key fields (description, scope), note this limitation but still draft the best alignment document possible from available data.
`.trim();
