# Grant Researcher

AI-powered grant discovery for researchers. Upload a CV, run the pipeline, get ranked funding matches and a tailored proposal outline — all in the browser.

Key features:

- Agent-driven research into the researcher's profile
- Built for university admins
- Match against thousands of grant datasets
- Key proposal writing support
- Specific to UK academics
- Agentic-first research and proposal writing (deeper understanding, higher cost)
- Gateway to Research integration — 173,000+ funded papers used to enrich match reasoning
- Designed to connect directly into university systems (published papers, existing grants)
- All AI outputs are clearly labelled as suggestions — system is designed to be non-liable for hallucinations

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
grant-researcher/          # monorepo root — also the Next.js app
├── src/
│   └── app/
│       ├── page.tsx               # CV upload home page
│       ├── session/[name]/        # Live pipeline session page
│       └── api/
│           ├── session/[name]/    # SSE API routes (profile, scan, match, propose)
│           └── orcid/             # ORCID profile fetch
├── components/                    # CVDropZone, PipelineBar, MatchList, ProposalViewer, etc.
├── data/
│   ├── funding-sources/           # Harvested grant data (markdown per funder)
│   ├── researchers/               # Researcher profiles and CVs
│   └── outputs/                   # Match results and proposals
│
├── data-pipeline/                 # Standalone ingestion CLI (npm workspace)
│   └── src/
│       ├── cli.ts                 # Commands: gtr, ukri-finder
│       ├── sources/               # API fetch logic (GtR, UKRI Funding Finder)
│       ├── transforms/            # Normalise raw API data to shared schema
│       └── loaders/               # Upsert funders/schemes to Supabase
│
├── db/                            # Shared database package (npm workspace)
│   └── src/
│       ├── client.ts              # Supabase client
│       ├── types.ts               # Database types
│       └── index.ts               # Exports
│
├── docs/                          # Design specs and plans
└── research-docs/                 # Grant databases, API references
```

---

## Getting started

**Prerequisites:** Node.js 18+, an Anthropic API key, a Supabase project.

```bash
# Install all workspace dependencies from monorepo root
npm install

# Copy and fill in environment variables
cp .env.example .env.local
# Add: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# Push database schema
npm run db:push

# Start the Next.js dev server (must run from monorepo root — API routes use cwd)
npm run dev
```

Open `http://localhost:3000`, upload a CV, and run the pipeline.

---

## Running each part

### Next.js frontend + API

```bash
# Dev server (from monorepo root)
npm run dev

# Production build
npm run build
npm run start
```

The API routes live under `src/app/api/` and handle all pipeline stages via SSE.

### Data ingestion pipeline

The `data-pipeline` workspace ingests grant data into Supabase from external APIs.

```bash
# Ingest awarded grants from UKRI Gateway to Research
npm run ingest -w data-pipeline -- gtr --council ahrc
npm run ingest -w data-pipeline -- gtr --council epsrc
npm run ingest -w data-pipeline -- gtr --all          # all UKRI councils
npm run ingest -w data-pipeline -- gtr --all --limit 500

# Ingest open opportunities from UKRI Funding Finder
npm run ingest -w data-pipeline -- ukri-finder

# Run ingestion tests
npm test -w data-pipeline
```

### Database (Supabase / Drizzle)

```bash
# Push schema migrations
npm run db:push

# Check migration status
npm run db:status -w db

# Generate a diff from current schema
npm run db:diff -w db
```

---

## CLI usage (file-based pipeline)

The core pipeline can also be run directly against local files (no database required):

```bash
# Build a researcher profile from their CV
grant-researcher profile <name>

# Harvest / refresh the funding database
grant-researcher scan
grant-researcher scan --check    # only re-fetch sources older than 7 days
grant-researcher scan --force    # re-harvest everything

# Score all grants against a researcher profile
grant-researcher match <name>

# Draft a proposal alignment document
grant-researcher propose <funder> <scheme>
grant-researcher propose <name> <funder> <scheme>
```

Researcher data lives in `data/researchers/<name>/`. Place a CV at `data/researchers/<name>/raw/cv.md` (or `.pdf` / `.docx`) before running `profile`.

---

## Adding grant sources

Add a new markdown file to `data/funding-sources/` following the template at `_template.md`. Run the scan stage to harvest it.

### Awarded grants vs open opportunities

The UKRI Gateway to Research (GtR) API holds 173,000+ past funded projects — useful for understanding funder priorities and for enriching match reasoning ("this researcher's profile resembles past AHRC award winners"). But it records what was already funded, not what is currently open to apply for. Open calls live only on individual funder websites.

The scan stage uses `data/funding-sources/_urls.md` as its seed list. This should contain the funding listing pages for each funder you want to track. See [`research-docs/grant-databases.md`](research-docs/grant-databases.md) for a full catalogue of UK grant databases, APIs, and recommended seed URLs.

---

## Roadmap

### Cost optimisation
- [ ] Cache researcher profiles so re-runs of match/propose don't re-call Claude for profile
- [ ] Implement tiered matching: cheap embedding/keyword pre-filter before full Claude scoring
- [ ] Batch Claude calls where possible (e.g. score multiple schemes per prompt)
- [ ] Track and log token usage per pipeline stage for visibility
- [ ] Add a "lite mode" flag that skips deep analysis for quick exploratory runs

### Match against database opportunities
- [ ] Connect the match stage to Supabase — query live opportunities table instead of local markdown files
- [ ] Support filtering by funder, discipline, deadline window, and career stage
- [ ] Surface deadline proximity in scoring (urgent opportunities ranked higher)
- [ ] Add pagination / lazy loading for large result sets

### Build the opportunities database
- [ ] Ingest open calls from UKRI Funding Finder API (in progress — `data-pipeline ukri-finder`)
- [ ] Set up scheduled ingestion (cron / Railway) to keep opportunities fresh
- [ ] Add additional funders: Wellcome, Leverhulme, British Academy, Royal Society
- [ ] Scrape funder "open calls" pages for non-API sources
- [ ] Normalise and deduplicate across sources into a unified `opportunities` table
- [ ] Track historical open/close dates to build deadline pattern data

### Historical award intelligence
- [ ] Use GtR awarded grant data to identify which researchers won which grants and why
- [ ] Build a "funder fingerprint" per scheme: disciplines, career stages, institution types funded historically
- [ ] Surface award history in match output: "EPSRC funded 12 similar profiles in the last 3 years"
- [ ] Score proposals against historical success patterns to maximise likelihood of success
- [ ] Flag schemes where the researcher's profile closely resembles previous winners

### Security
- [ ] **Prompt injection** — sanitise and validate all user-supplied content (CV text, free-text fields) before insertion into Claude prompts ([issue #16](https://github.com/finnrea78/grant-researcher/issues/16))
- [ ] **Input validation** — enforce file type/size limits on CV upload; reject unexpected MIME types
- [ ] **Output validation** — treat all Claude-generated content as untrusted before rendering; sanitise HTML/markdown output
- [ ] **Rate limiting** — per-session and per-IP limits on pipeline API routes to prevent abuse and runaway API costs
- [ ] **Auth** — protect admin routes; ensure Supabase RLS policies are in place before public deployment
- [ ] **Secrets** — audit that no API keys are logged or exposed in SSE streams or error responses
- [ ] **Dependency audit** — run `npm audit` as part of CI; pin critical dependencies

---

## Tech stack

- **AI** — Anthropic Claude via `@anthropic-ai/claude-agent-sdk`
- **Frontend** — Next.js 14, Tailwind CSS, React
- **Streaming** — Server-Sent Events (SSE) for live pipeline output
- **Database** — Supabase (Postgres)
- **CLI** — TypeScript + Commander
- **Monorepo** — npm workspaces

---

## Related

- [grant-scout](https://github.com/finnrea78/grant-scout) — deprecated v1 (Next.js 15, Supabase, Drizzle ORM). All v1 code is preserved on the `deprecated/v1` branch.
