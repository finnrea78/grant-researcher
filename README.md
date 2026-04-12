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

Grant Researcher runs a five-stage pipeline driven by Claude:

```
CV upload → Profile → Enrich → Scan → Match → Propose
```

1. **Profile** — Claude reads the CV and extracts a structured researcher profile (themes, track record, career stage, gaps)
2. **Enrich** — web research to fill gaps (Google Scholar, institutional pages, ORCID)
3. **Scan** — harvests funding source data from known URLs; persists funders and opportunities to Supabase
4. **Match** — scores every funding scheme against the researcher profile across five dimensions, producing a tiered ranked list; results persisted to `researcher_matches` table
5. **Propose** — drafts a strategic alignment document for a selected grant; content persisted to `researcher_proposals` table

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
│       ├── researcher-store.ts      # Supabase CRUD for researcher rows
│       ├── match-store.ts           # researcher_matches CRUD
│       ├── funding-source-store.ts  # funding_sources CRUD
│       └── cv-store.ts             # Supabase Storage for CV upload/read
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
├── data/                            # Scan agent working directory (not persistent state)
│   └── funding-sources/             # _urls.md seed list + intermediate scan files
│
├── .claude/                         # Claude Code project context
│   ├── CONTEXT.md                   # Product vision and current state
│   ├── DECISIONS.md                 # Technical decisions and rationale
│   └── docs/
│       └── domain.md                # Grant landscape domain knowledge
│
├── CLAUDE.md                        # Quick-ref for Claude Code sessions
└── package.json                     # Workspace root (npm workspaces)
```

---

## Getting started

**Prerequisites:** Node.js 18+, an Anthropic API key, a Supabase project, an OpenAI API key.

```bash
# Install all workspace dependencies from monorepo root
npm install

# Copy and fill in environment variables
cp .env.example .env.local
# Add: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY

# Also add OPENAI_API_KEY and Supabase credentials to data-pipeline/.env for the CLI
cp data-pipeline/.env.example data-pipeline/.env

# Push database schema (links to your Supabase project and applies all migrations)
npm run db:push -w db

# Embed existing opportunities (first run only — backfills any rows missing embeddings)
npm run embed -w data-pipeline

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

# Compute OpenAI embeddings for all opportunities missing them
# Run after any bulk ingest, or on first setup
npm run embed -w data-pipeline
npm run embed -w data-pipeline -- --batch 50  # smaller batches to avoid rate limits (default: 100)

# Run ingestion tests
npm test -w data-pipeline
```

### Database (Supabase / Drizzle)

```bash
# Push schema migrations to the linked Supabase project
npm run db:push -w db

# Check migration status
npm run db:status -w db

# Generate a diff from current schema
npm run db:diff -w db
```

---

## Adding grant sources

To add a new funding source, add a line to `data/funding-sources/_urls.md`:

```
funder-slug | https://funder-website.example/open-calls
```

Run the Scan stage from the web UI to harvest it. Discovered opportunities are persisted to Supabase and are immediately available to the Match stage.

### Awarded grants vs open opportunities

The UKRI Gateway to Research (GtR) API holds 173,000+ past funded projects — useful for understanding funder priorities and for enriching match reasoning ("this researcher's profile resembles past AHRC award winners"). But it records what was already funded, not what is currently open to apply for. Open calls live only on individual funder websites.

The scan stage uses `data/funding-sources/_urls.md` as its seed list. This should contain the funding listing pages for each funder you want to track.

---

## Roadmap

### Cost optimisation
- [ ] Cache researcher profiles so re-runs of match/propose don't re-call Claude for profile
- [x] Implement tiered matching: pgvector + tsvector pre-filter before full Claude scoring
- [ ] Batch Claude calls where possible (e.g. score multiple schemes per prompt)
- [ ] Track and log token usage per pipeline stage for visibility
- [ ] Add a "lite mode" flag that skips deep analysis for quick exploratory runs

### Match against database opportunities
- [x] Connect the match stage to Supabase — hybrid pgvector + tsvector retrieval (up to 150 candidates) fed to Claude scorer
- [x] Researcher profile embedding computed from Claude-generated prose summary during enrich step
- [x] Opportunity embeddings computed at ingest time via OpenAI `text-embedding-3-small`
- [ ] Support filtering by funder, discipline, deadline window, and career stage
- [x] Surface deadline proximity in scoring (urgent flag — ⚠️ URGENT on matches within 30 days)
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
- **Frontend** — Next.js 14, Tailwind CSS, shadcn/ui, React
- **Database** — Supabase (Postgres)
- **Streaming** — Server-Sent Events (SSE) for live pipeline output
- **Data pipeline** — TypeScript CLI with Commander, Cheerio
- **Monorepo** — npm workspaces
- **Deployment** — Railway

---

## Related

- [grant-scout](https://github.com/finnrea78/grant-scout) — deprecated v1 (Next.js 15, Supabase, Drizzle ORM). All v1 code is preserved on the `deprecated/v1` branch.
