# Grant Scout — Deployment Architecture Design

**Date:** 2026-04-01
**Status:** Draft
**Author:** Finn Rea + Claude

## Context

Grant Scout is a grant-matching pipeline for academic researchers. It currently runs as a local Next.js 14 monorepo (`core/` CLI + `grant-researcher/` frontend) using the Claude Agent SDK for AI-powered pipeline steps.

The app needs to become a deployed SaaS product sold at three tiers:

- **Individual academic** — single researcher
- **Department admin** — manages researchers in one department
- **University-wide** — manages multiple departments

This spec defines the deployment architecture, cost optimisation strategy, and staged rollout plan.

## Constraints

- API costs absorbed by us (baked into subscription pricing)
- Auth starts with email + password
- Must support multi-tenancy with data isolation between users/institutions
- Grant recall is prioritised — missing a relevant grant is worse than surfacing irrelevant ones
- Staged approach: demo-ready fast, on a foundation that grows into production

---

## 1. Infrastructure

### Hosting: Railway

- Deploys the full Next.js app from the monorepo root
- Build: `npm run build -w core && npm run build -w grant-researcher`
- Start: `npm run start -w grant-researcher`
- Persistent volume mounted at `/data` for user files (CVs, profiles, proposals)
- Environment: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Database + Auth: Supabase

- **Auth:** email/password via Supabase Auth (session management, password reset, JWTs)
- **Database:** PostgreSQL for grants, users, organisations, pipeline tracking
- **Row-Level Security:** tenant isolation at the database level

---

## 2. Multi-Tenancy Data Model

### Database Tables

```sql
organisations
  id            uuid PRIMARY KEY
  name          text            -- "University of Edinburgh"
  tier          text            -- individual | department | university
  parent_org_id uuid REFERENCES organisations(id)  -- departments → university
  created_at    timestamptz

users
  id            uuid PRIMARY KEY  -- from Supabase Auth
  org_id        uuid REFERENCES organisations(id)
  role          text              -- researcher | admin
  email         text

researcher_sessions
  id              uuid PRIMARY KEY
  user_id         uuid REFERENCES users(id)
  org_id          uuid REFERENCES organisations(id)
  researcher_name text            -- slug, e.g. "will-rea"
  status          text            -- active | archived
  created_at      timestamptz

pipeline_runs
  id           uuid PRIMARY KEY
  session_id   uuid REFERENCES researcher_sessions(id)
  stage        text            -- upload | profile | match | propose
  status       text            -- pending | running | completed | failed
  started_at   timestamptz
  completed_at timestamptz
  error        text

grants
  id           uuid PRIMARY KEY
  source       text            -- "ukri", "nsf", "eu-horizon", etc.
  funder       text
  scheme       text
  title        text
  description  text
  eligibility  jsonb
  deadline     date
  url          text
  amount_range text
  raw_data     jsonb           -- original API/scraped data
  harvested_at timestamptz
  created_at   timestamptz

match_results
  id           uuid PRIMARY KEY
  session_id   uuid REFERENCES researcher_sessions(id)
  grant_id     uuid REFERENCES grants(id)
  score        integer         -- 0-100
  reasoning    text
  created_at   timestamptz
```

### RLS Rules

- **Researchers:** see rows where `user_id = auth.uid()`
- **Department admins:** see rows where `org_id = their org`
- **University admins:** see rows where `org_id = their org OR org.parent_org_id = their org`
- **Grants table:** readable by all authenticated users (shared data)

### Filesystem (Volume)

User-specific files on the Railway volume:

```
/data/{org_id}/{user_id}/{session_id}/
  ├── researchers/{name}/
  │   ├── raw/
  │   │   ├── cv.md
  │   │   ├── publications/
  │   │   ├── future-directions.md
  │   │   └── additional/
  │   ├── profile.json
  │   └── publications.md
  └── outputs/{name}/
      └── proposals/
```

---

## 3. Pipeline Architecture

Two distinct systems replace the current monolithic Agent SDK pipeline.

### System A — Harvester (background, scheduled)

Runs on a cron schedule. No Agent SDK. Pure Node.js code.

**Layer 1 — API connectors (no AI, free):**
Direct `fetch()` calls to grant databases (UKRI Gateway, NSF, etc.). Parse JSON responses. Upsert to Supabase `grants` table.

**Layer 2 — Web scrapers (no AI, free):**
`fetch()` + Cheerio for known page structures. Extract grant details. Upsert to Supabase.

**Layer 3 — AI enrichment (rare, batched, cheap):**
For pages too messy to parse with code. Single `messages.create()` call with structured output. ~$0.01-0.03 per page.

### System B — User Pipeline (on-demand)

Triggered when a user runs the pipeline. All steps use the raw Claude API (`@anthropic-ai/sdk`), not the Agent SDK.

| Step | Method | Input | Output |
|---|---|---|---|
| **Upload** | Node.js code | Multipart form | Files on volume |
| **Profile** | `messages.create()` | CV + publications + goals (read by Node.js) | profile.json (written by Node.js) |
| **Match** | Tiered (see below) | profile.json + grants from Supabase | match_results in Supabase |
| **Propose** | `messages.create()` / `.stream()` | profile.json + grant details | Proposal .md on volume |

**Pattern:** Code does all I/O (reading files, querying database, writing results). Claude does the thinking (interpreting CVs, scoring matches, drafting proposals). One API call per step instead of 20-50 agent turns.

### Tiered Matching (Recall-Optimised)

Matching uses three tiers to ensure no grants are missed:

**Tier 1 — Code-based pre-filter (free, fast):**
Filter grants by discipline keywords, eligibility country, career stage, deadline not passed. Intentionally permissive — reduces 500+ grants to ~50-100 candidates.

**Tier 2 — AI scoring (cheap, thorough):**
Send profile + each candidate grant to Claude API. Small batches of 5-10 grants per call. Each grant gets individual attention with a relevance score and reasoning. Uses structured output for consistent scoring.

**Tier 3 — AI synthesis (one call):**
Send all scored results to Claude. Returns a ranked list with strategic recommendations.

### Cost Comparison

| Step | Agent SDK (current) | Raw API (target) |
|---|---|---|
| Profile | ~$1-3 | ~$0.05-0.10 |
| Scan | ~$2-8 | ~$0 (code harvester) |
| Match | ~$1-3 | ~$0.03-0.10 |
| Propose | ~$1-3 | ~$0.05-0.15 |
| **Total per run** | **~$5-17** | **~$0.13-0.35** |

---

## 4. API Routes (Revised)

```
POST /api/session                      — CV upload, create session in Supabase
POST /api/session/[name]/profile       — Claude API: build profile from uploaded docs
POST /api/session/[name]/match         — Claude API: tiered matching against grants DB
GET  /api/session/[name]/matches       — Read match_results from Supabase
POST /api/session/[name]/propose       — Claude API: draft proposal for selected grant
GET  /api/session/[name]/proposal      — Read proposals from volume
GET  /api/session/[name]/status        — Read pipeline_runs from Supabase
```

All routes check Supabase Auth JWT before processing. Pipeline status tracked in `pipeline_runs` table.

---

## 5. Premium Agent Features (Higher Tiers)

For department and university tiers, agents may be used for:

- **Grant discovery** — agent actively searches for new opportunities not yet in the database. Exploratory work where the AI decides what to look for.
- **Deep proposal assistance** — agent cross-references multiple publications, funder guidelines, and university strategy docs for comprehensive proposals.

These are opt-in premium features, not part of every pipeline run. Billed at higher tier pricing to cover agent costs.

---

## 6. Staged Rollout

### Stage 1 — Demo (now)

**1a — Deploy (no code changes):**
- Deploy current code to Railway as-is (Agent SDK still in use)
- Set `ANTHROPIC_API_KEY` environment variable
- Mount persistent volume at `/data`
- Result: working app at a Railway URL, no auth yet

**1b — Add auth + tracking:**
- Create Supabase project: auth + basic tables (users, organisations, researcher_sessions, pipeline_runs)
- Add `@supabase/supabase-js` dependency
- Add auth middleware to API routes
- Result: users can sign up, data is isolated per user

### Stage 2 — Cost Reduction

- Replace Agent SDK calls with raw Claude API, one step at a time:
  1. Profile (simplest — single input, structured output)
  2. Match (move to tiered matching, read grants from Supabase)
  3. Propose (single API call with streaming)
- Remove `@anthropic-ai/claude-agent-sdk` dependency
- Add `grants` and `match_results` tables to Supabase

### Stage 3 — Scale

- Build harvester service (API connectors + scrapers)
- Set up cron jobs on Railway for scheduled harvesting
- Add admin dashboard pages (department/university views)
- Add bulk pipeline operations for admins
- Move to job queue for background processing if needed

### Stage 4 — Premium Features

- Agent-powered grant discovery for higher tiers
- Deep proposal assistance
- Reporting and analytics for university admins
- SSO (SAML/OIDC) for university-wide tier

---

## 7. Key Files to Modify

| File | Change |
|---|---|
| `grant-researcher/src/app/api/session/route.ts` | Add Supabase auth check, create session record |
| `grant-researcher/src/app/api/session/[name]/profile/route.ts` | Replace Agent SDK with Claude API call |
| `grant-researcher/src/app/api/session/[name]/scan/route.ts` | Delete (replaced by harvester) |
| `grant-researcher/src/app/api/session/[name]/match/route.ts` | Replace Agent SDK with tiered matching |
| `grant-researcher/src/app/api/session/[name]/propose/route.ts` | Replace Agent SDK with Claude API call |
| `grant-researcher/src/app/api/session/[name]/matches/route.ts` | Read from Supabase instead of filesystem |
| `grant-researcher/src/app/api/session/[name]/status/route.ts` | Read from Supabase instead of filesystem |
| `core/src/prompts/*.ts` | Reuse as system prompts for raw API calls |
| `grant-researcher/package.json` | Add `@anthropic-ai/sdk`, `@supabase/supabase-js` |
| `next.config.mjs` | Add `output: "standalone"` for Railway |
| **New:** `grant-researcher/src/lib/supabase.ts` | Supabase client initialisation |
| **New:** `grant-researcher/src/middleware.ts` | Auth middleware for all API routes |
| **New:** `grant-researcher/src/lib/claude.ts` | Anthropic client + helper for pipeline calls |
| **New:** `core/src/harvester/` | Grant harvester service (connectors + scrapers) |

---

## 8. Verification

### Demo stage

1. Deploy to Railway — app loads at the assigned URL
2. Sign up with email/password via Supabase Auth
3. Upload a CV and run the full pipeline (still Agent SDK)
4. Verify data appears in Supabase tables (session, pipeline_runs)
5. Second user signs up — verify they cannot see first user's data

### After cost reduction

1. Run a pipeline end-to-end using raw Claude API calls
2. Compare output quality against Agent SDK version
3. Verify costs in Anthropic dashboard (~$0.13-0.35 per run)
4. SSE streaming works for profile and propose steps

### After harvester

1. Cron job runs and populates grants table
2. Match step reads from Supabase grants table
3. New grants appear in match results after next harvest
