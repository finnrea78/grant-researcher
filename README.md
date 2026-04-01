# Grant Researcher

AI-powered grant discovery for researchers. Upload a CV, run the pipeline, get ranked funding matches and a tailored proposal outline — all in the browser.


Key selling points: 

- Agent driven research in to the researcher
- Built for admins
- Match agaist thousands of datasets of grants
- Key proposals write
- specific for UK academics 
- Agentic first research and proposal writing (more expensive but much deeper understand)
- To be linked directly into university systems to see grants and researchers published papers pulling in infomation
- ensure that these systems can be liable to hallucinate all details are given as suggestions. 


- todo: security and protects agaist prompt ingestions. 

---

## How it works

Grant Researcher runs a four-stage pipeline driven by Claude:

```
CV upload → Profile → Scan → Match → Propose
```

1. **Profile** — Claude reads the CV and extracts a structured researcher profile (themes, track record, career stage, gaps)
2. **Scan** — harvests funding source data from known URLs and stores it locally as markdown
3. **Match** — scores every funding scheme against the researcher profile across five dimensions, producing a tiered ranked list
4. **Propose** — drafts a strategic alignment document for a selected grant

Each stage streams its output live to the browser via Server-Sent Events (SSE).

---

## Scoring

Matches are scored using a weighted rubric:

| Dimension | Weight | Description |
|---|---|---|
| Eligibility | Gate | Binary — ineligible schemes score 0 regardless |
| Thematic alignment | 3× | How well the researcher's themes match funder priorities |
| Track record fit | 2× | Publication record and prior grants vs scheme expectations |
| Strategic fit | 1× | How much this grant would advance the researcher's career |
| Practical factors | 1× | Deadline proximity, application complexity, success rate |

**Overall score** = `(thematic×3 + track_record×2 + strategic×1 + practical×1) / 7`

Results are grouped into three tiers: **Strong Matches (7+)**, **Worth Exploring (4–6.9)**, and **Long Shots (<4)**.

---

## Monorepo structure

```
grant-researcher/
├── core/                        # TypeScript CLI and AI pipeline
│   ├── src/
│   │   ├── cli.ts               # Entry point: profile, scan, match, propose commands
│   │   ├── commands/            # Command implementations
│   │   ├── prompts/             # Claude prompt templates
│   │   └── stream.ts            # Claude Agent SDK streaming helper
│   ├── data/
│   │   ├── funding-sources/     # Harvested grant data (markdown per funder)
│   │   ├── researchers/         # Researcher profiles and CVs
│   │   └── outputs/             # Match results and proposals
│   └── dist/                    # Compiled output
│
├── grant-researcher/            # Next.js 14 frontend
│   └── src/
│       ├── app/
│       │   ├── page.tsx         # CV upload home page
│       │   ├── session/[name]/  # Session pipeline page
│       │   └── api/session/     # SSE API routes
│       ├── components/          # CVDropZone, PipelineBar, MatchList, ProposalViewer, StageLog
│       └── lib/                 # parseMatches, slugify, SSE helpers
│
├── docs/                        # Design specs and plans
└── package.json                 # Workspace root (npm workspaces)
```

---

## Getting started

**Prerequisites:** Node.js 18+, an Anthropic API key.

```bash
# Install all workspace dependencies
npm install

# Set your API key
echo "ANTHROPIC_API_KEY=sk-..." > .env.local

# Build the core CLI
cd core && npm run build && cd ..

# Start the frontend dev server (run from monorepo root)
npm run dev -w grant-researcher
```

Open `http://localhost:3000`, upload a CV, and run the pipeline.

---

## CLI usage

The core pipeline can also be run directly from the command line:

```bash
# Build a researcher profile from their CV
grant-scout profile <name>

# Harvest / refresh the funding database
grant-scout scan
grant-scout scan --check    # only re-fetch sources older than 7 days
grant-scout scan --force    # re-harvest everything

# Score all grants against a researcher profile
grant-scout match <name>

# Draft a proposal alignment document
grant-scout propose <funder> <scheme>
grant-scout propose <name> <funder> <scheme>
```

Researcher data lives in `core/data/researchers/<name>/`. Place a CV at `core/data/researchers/<name>/raw/cv.md` (or `.pdf` / `.docx`) before running `profile`.

---

## Adding grant sources

Add a new markdown file to `core/data/funding-sources/` following the template at `_template.md`. Run `grant-scout scan --force` to harvest it.

---

## Tech stack

- **AI** — Anthropic Claude via `@anthropic-ai/claude-agent-sdk`
- **Frontend** — Next.js 14, Tailwind CSS, React
- **Streaming** — Server-Sent Events (SSE) for live pipeline output
- **CLI** — TypeScript + Commander

---

## Security

User-supplied CV content is inserted into Claude prompts. See [issue #16](https://github.com/finnrea78/grant-researcher/issues/16) for the ongoing prompt injection audit. Do not deploy to a public endpoint before that work is complete.

---

## Related

- [grant-scout](https://github.com/finnrea78/grant-scout) — deprecated v1 (Next.js 15, Supabase, Drizzle ORM). All v1 code is preserved on the `deprecated/v1` branch.
