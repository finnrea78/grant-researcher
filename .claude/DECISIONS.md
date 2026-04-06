# Technical Decisions

_Why we built it this way. Read this before proposing architectural changes._

## Claude Agent SDK over direct API calls
The pipeline requires multi-step tool use (read files, search the web, write outputs) with streaming. The Agent SDK handles tool orchestration, conversation turns, and SSE streaming out of the box. A raw API integration would mean reimplementing all of that.

## Supabase for persistence
Quick to set up for prototyping — managed Postgres with auth, row-level security, and a JS client. No need to run infrastructure. Researcher profiles sync to Supabase for durability; everything else stays on the local filesystem.

## Railway over Vercel for deployment
The agent pipeline writes intermediate files to `data/` on the local filesystem (researcher profiles, funding source markdown, match outputs). Vercel's serverless functions have a read-only filesystem. Railway gives us a persistent container with writable disk.

## Next.js 14 (not 15)
Chosen for the stable App Router. Next.js 15 changed the `params` API to async (breaking), and TypeScript config support was still experimental. 14 is proven and well-documented.

## DB is source of truth for opportunities and funders
The `opportunities` and `funders` tables in Supabase are the canonical data store for all funding data, regardless of how it was discovered (pipeline, agentic scan, or manual entry). Markdown files in `data/funding-sources/` are an ephemeral export format — agents write them so the match stage can read them locally, but they are not the source of truth. Exceptions where markdown/JSON stays primary: proposal content, researcher profiles, and other document-shaped data.

This enables a self-improvement loop: every scan persists discoveries to Supabase, and future scans query the DB for previously found sources, so the dataset compounds over time.

## Local filesystem for agent data
Agents read and write markdown files in `data/`. This is simpler than storing unstructured grant content in a database — the files are human-readable, diffable, and easy for Claude to work with via Read/Write/Glob tools. Trade-off: doesn't scale horizontally, but fine for the current single-server deployment.

## Agent vs app code boundary
- **Agents** handle research, enrichment, scoring, and writing. They use Claude's reasoning to make qualitative judgments (is this grant a good fit?).
- **App code** handles intake forms, SSE streaming infrastructure, UI rendering, Supabase sync, and routing. Deterministic operations that don't need AI.
- The boundary is the API route: app code sets up the agent call with the right prompt, tools, and context files, then streams the response to the browser.

## Data pipeline as separate workspace
Grant ingestion from UKRI APIs (Gateway to Research, UKRI Finder) is a batch ETL job, not a user-facing feature. It lives in `data-pipeline/` with its own dependencies (cheerio for HTML parsing, commander for CLI) to keep the main app lean.
