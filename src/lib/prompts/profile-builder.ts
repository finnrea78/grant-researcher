export const PROFILE_BUILDER_PROMPT = `
Parse a researcher's intake data and/or CV text into a structured JSON profile and a thematic publications summary.

The researcher's intake form data and CV text are provided directly in the user message — there are no files to read.

## Input Modes

**Form + CV (both present):** Treat the structured fields in intake.json as ground truth. Use the CV only to fill fields not already covered by intake.json (e.g. publications list, prior grants, conference papers). Never override an intake.json field with a CV-extracted value.

**Form only (no CV):** Build the profile entirely from intake.json. Set publications, prior_grants, conference_papers, and exhibitions_curated to empty arrays unless intake data implies otherwise. Generate key_strengths and potential_gaps based on the available structured fields.

**CV only (no intake data):** Use the CV text for all fields.

**Proposal intent (optional):** If proposal intent data is included in the user message, use it to inform the \`current_projects\`, \`research_themes\`, and \`key_strengths\` fields — but only where it adds genuine signal beyond what the CV and intake data already provide.

## Instructions

### Step 1: Extract the JSON Profile

Produce a profile following this schema exactly:

\`\`\`json
{
  "name": "",
  "title": "",
  "career_stage": "early_career | mid_career | established | senior",
  "institution": "",
  "department": "",
  "country": "UK",
  "research_themes": [],
  "research_keywords": [],
  "geographic_focus": [],
  "disciplinary_fields": [],
  "current_projects": [],
  "publications": [
    {
      "title": "",
      "year": 0,
      "type": "book | chapter | journal_article | review | catalogue | other",
      "journal_or_publisher": "",
      "themes": []
    }
  ],
  "prior_grants": [
    {
      "funder": "",
      "scheme": "",
      "amount_gbp": 0,
      "year": 0,
      "role": "PI | CoI | team_member | fellow",
      "project_title": ""
    }
  ],
  "phd_supervision": {
    "current": 0,
    "completed": 0,
    "topics": []
  },
  "external_roles": [],
  "exhibitions_curated": [],
  "conference_papers": [],
  "key_strengths": [],
  "potential_gaps": []
}
\`\`\`

**Field guidance:**

- \`career_stage\`: use \`established\` for senior lecturers with 20+ years and major grants. Use \`early_career\` only for researchers within 8 years of PhD. \`senior\` for professors/chairs.
- \`research_themes\`: high-level thematic clusters (e.g. "Yoruba masquerade", "Nigerian modernism"). 5-10 items.
- \`research_keywords\`: specific terms useful for funder matching (e.g. "Epa masquerade", "postcolonial theory", "African art history"). 15-25 items.
- \`geographic_focus\`: regions/countries the researcher works on (e.g. "Nigeria", "West Africa", "Yorubaland", "Ekiti").
- \`disciplinary_fields\`: academic disciplines (e.g. "art history", "anthropology of art", "cultural studies", "museum studies").
- \`current_projects\`: active projects with titles and brief descriptions.
- \`prior_grants.amount_gbp\`: use 0 if amount not stated. For consortium grants, record the full consortium amount noted on the CV.
- \`key_strengths\`: 5-8 items distilled from the CV — what makes this researcher fundable (publication record, track record with specific funders, institutional roles, public engagement, etc.).
- \`potential_gaps\`: honest assessment — e.g. "no PI grant in last 10 years", "limited international co-investigator network", "no ERC or Horizon experience".

### Step 2: Generate Publications Summary

Produce a publications_md string — a thematic analysis of the researcher's publication record.

**Structure:**

\`\`\`markdown
# Publications: [Researcher Name]

> Generated: YYYY-MM-DD
> Total publications: [count]

## Research Strands

### Strand 1: [Theme Name]

[2-3 sentences describing this research thread. What is the core argument or contribution?]

**Key works:**
- [Title] ([Year]) — [one-line description of contribution]
- ...

### Strand 2: [Theme Name]
...

## Publication Profile Assessment

**Strongest thread for grant applications:** [Which strand has the most depth and recency?]

**Top-tier publications:** [List venues that signal research quality — Art Bulletin, African Arts, NKa, Yale UP, Tate, etc.]

**Recency:** [Are publications recent enough? Any gap?]

**Books in progress:** [Note any manuscripts in preparation or review — these matter for applications]

**Recommendations:** [1-2 sentences on how this publication record positions the researcher for funding]
\`\`\`

### Step 3: Do Not Infer

- Only extract information explicitly stated in the provided data.
- If a field cannot be populated, use \`[]\` for arrays or \`""\` for strings.
- Do not invent publications, grants, or roles.
- For \`key_strengths\` and \`potential_gaps\`, use your analytical judgement — but base it solely on what the data contains.

## Response Format

Respond with a JSON object and no markdown fences or extra text — just the raw JSON:

\`\`\`
{
  "profile": { ...ResearcherProfile },
  "publications_md": "...markdown string..."
}
\`\`\`
`.trim();
