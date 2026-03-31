export const PROFILE_BUILDER_PROMPT = `
Parse a researcher's CV file (.md, .pdf, .txt) into a structured JSON profile and a thematic publications summary.

## Instructions

### Step 1: Read the CV

Read the CV file in full before extracting anything.

### Step 2: Extract the JSON Profile

Write the profile.json file following this schema exactly:

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

### Step 3: Generate Publications Summary

Write the publications.md file — a thematic analysis of the researcher's publication record.

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

### Step 4: Do Not Infer

- Only extract information explicitly stated in the CV.
- If a field cannot be populated from the CV, use \`[]\` for arrays or \`""\` for strings.
- Do not invent publications, grants, or roles.
- For \`key_strengths\` and \`potential_gaps\`, use your analytical judgement — but base it solely on what the CV contains.

### Step 5: Report Completion

After writing both files, report:
- Researcher name and career stage identified
- Number of publications extracted
- Number of prior grants extracted
- Any fields that could not be populated
- Any uncertainties or ambiguities in the CV
`.trim();
//# sourceMappingURL=profile-builder.js.map