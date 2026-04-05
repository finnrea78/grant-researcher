# Grant Researcher

AI-powered grant discovery for researchers. Upload a CV, run the pipeline, get ranked funding matches and a tailored proposal outline — all in the browser.

Key selling points:

- Agent-driven research into the researcher
- Built for admins
- Match against thousands of datasets of grants
- Key proposals write
- Specific for UK academics
- Agentic-first research and proposal writing (more expensive but much deeper understanding)
- To be linked directly into university systems to see grants and researchers' published papers, pulling in information
- Ensure that these systems can be liable to hallucinate — all details are given as suggestions

- Use Gateway to Research to enhance proposal and matching logic — they have over 173,000 papers on how to do this.

- TODO: security and protection against prompt injection

---

## How it works

Grant Researcher runs a five-stage pipeline driven by Claude:

```
CV upload → Profile → Enrich → Scan → Match → Propose
```

1. **Profile** — Claude reads the CV and extracts a structured researcher profile (themes, track record, career stage, gaps)
2. **Enrich** — web research to fill gaps (Google Scholar, institutional pages, ORCID)
3. **Scan** — harvests funding source data from known URLs and stores it locally as markdown
4. **Match** — scores every funding scheme against the researcher profile across five dimensions, producing a tiered ranked list
5. **Propose** — drafts a strategic alignment document for a selected grant

Each stage streams its output live to the browser via Server-Sent Events (SSE).

---

## Scoring

Matches are scored using a weighted rubric:

| Dimension | Weight | Description |
|---|---|---|
| Eligibility | Gate | Binary — ineligible schemes score 0 regardless |
| Thematic alignment | 3x | How well the researcher's themes match funder priorities |
| Track record fit | 2x | Publication record and prior grants vs scheme expectations |
| Strategic fit | 1x | How much this grant would advance the researcher's career |
| Practical factors | 1x | Deadline proximity, application complexity, success rate |

**Overall score** = `(thematic×3 + track_record×2 + strategic×1 + practical×1) / 7`

Results are grouped into three tiers: **Strong Matches (7+)**, **Worth Exploring (4–6.9)**, and **Long Shots (<4)**.

---

## Project structure

```
grant-researcher/
├── src/                             # Next.js 14 App Router
│   ├── app/
│   │   ├── page.tsx                 # CV upload home page
│   │   ├── session/[name]/          # Session pipeline page
│   │   └── api/
│   │       ├── orcid/               # ORCID API integration
│   │       └── session/[name]/      # Agent API routes (profile, enrich, scan, match, propose)
│   ├── components/                  # IntakeWizard, PipelineBar, StageLog, MatchList, ProposalViewer
│   └── lib/
│       ├── prompts/                 # Claude prompt templates (5 agents)
│       ├── types.ts                 # Core interfaces
│       ├── sse.ts                   # SSE streaming helper
│       └── researcher-store.ts      # Supabase sync
│
├── data-pipeline/                   # Grant ingestion CLI (UKRI GtR + Finder)
│   └── src/
│       ├── cli.ts                   # Commander-based entry point
│       ├── sources/                 # Fetchers (gtr.ts, ukri-finder.ts)
│       ├── transforms/              # Normalisation and parsing
│       └── loaders/                 # Supabase upserts
│
├── db/                              # Supabase schema & client (@grant-researcher/db)
│   └── src/
│
├── data/                            # Local filesystem storage
│   ├── funding-sources/             # Harvested grant data (markdown per funder)
│   ├── researchers/                 # Researcher profiles and CVs
│   └── outputs/                     # Match results and proposals
│
├── docs/                            # Domain knowledge and reference
│   └── domain.md                    # Grant landscape knowledge
│
├── CLAUDE.md                        # Quick-ref for Claude Code sessions
├── CONTEXT.md                       # Product vision and current state
├── DECISIONS.md                     # Technical decisions and rationale
└── package.json                     # Workspace root (npm workspaces)
```

---

## Getting started

**Prerequisites:** Node.js 18+, an Anthropic API key.

```bash
# Install all workspace dependencies
npm install

# Set your API key
echo "ANTHROPIC_API_KEY=sk-..." > .env.local

# Start the dev server (run from project root)
npm run dev
```

Open `http://localhost:3000`, upload a CV, and run the pipeline.

---

## Adding grant sources

Add a new markdown file to `data/funding-sources/` following the template at `_template.md`. Run the scan stage to harvest it.

### Awarded grants vs open opportunities

The UKRI Gateway to Research (GtR) API holds 173,000+ past funded projects — useful for understanding funder priorities and for enriching match reasoning ("this researcher's profile resembles past AHRC award winners"). But it records what was already funded, not what is currently open to apply for. Open calls live only on individual funder websites.

The scan stage uses `data/funding-sources/_urls.md` as its seed list. This should contain the funding listing pages for each funder you want to track.

---

## Tech stack

- **AI** — Anthropic Claude via `@anthropic-ai/claude-agent-sdk`
- **Frontend** — Next.js 14, Tailwind CSS, shadcn/ui, React
- **Database** — Supabase (Postgres)
- **Streaming** — Server-Sent Events (SSE) for live pipeline output
- **Data pipeline** — TypeScript CLI with Commander, Cheerio
- **Deployment** — Railway

---

## Security

User-supplied CV content is inserted into Claude prompts. See [issue #16](https://github.com/finnrea78/grant-researcher/issues/16) for the ongoing prompt injection audit. Do not deploy to a public endpoint before that work is complete.

---

## Related

- [grant-scout](https://github.com/finnrea78/grant-scout) — deprecated v1 (Next.js 15, Supabase, Drizzle ORM). All v1 code is preserved on the `deprecated/v1` branch.
