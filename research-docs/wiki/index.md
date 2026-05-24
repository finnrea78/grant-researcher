# index.md

> Master content catalog. One-line summary per note, organized by category.
> Last updated: 2026-05-17

## Codebase (`wiki/codebase/`)

- [[Codebase Index]] — Session-start orienteer: architecture, key paths, hard constraints (~2 min)
- [[Architecture]] — Full agent system design, data architecture, competitive analysis
- [[Pipeline Agents]] — The 5 Claude agents (profile → enrich → scan → match → propose)
- [[Grant Ingestion CLI]] — data-pipeline workspace: fetchers, normalisers, loaders
- [[Database Schema]] — Supabase tables, RLS, pgvector embeddings
- [[Retrieval Strategy]] — Hybrid pgvector + tsvector retrieval, 150 candidate pre-filter
- [[Pipeline Status]] — What's built, what's working, what's broken

## Architecture Review (`wiki/architecture/`)

- [[Architecture Review Index]] — May 2026 review: the headline decisions and how the notes connect (start here)
- [[Codebase Assessment]] — Vibe-coded but good bones; decision: strangler refactor, not a v2 rewrite
- [[Security Findings]] — Prioritised P0/P1/P2 with file:line (incl. a real cross-tenant IDOR)
- [[Data Model & Typed DB Spine]] — No ORM, types already drifting; the three-partition data model
- [[Cost Architecture]] — Decouple expensive shared-data production from cheap per-user consumption
- [[Deployment & Observability]] — Railway stays; the gap is in-app observability, not the platform
- [[AI Pipeline Design]] — It's a typed pipeline, not "agents"; eval harness; taint boundary
- [[Refactor Plan — Steel Thread]] — Target structure + the shippable thread sequence

## Grants Landscape (`wiki/grants/`)

- [[UK Grant Landscape]] — The full picture of UK grant sources and the strategic gap we're filling
- [[Grant Databases — Full Catalogue]] — Every source catalogued: free, paid, API or scrape
- [[Free APIs]] — Programmatic, no-cost data sources (GtR, OpenAlex, NIH, NSF)
- [[Paid Grant Databases]] — Institutional/licensed options (Pivot-RP, Research Professional)
- [[OpenAlex]] — Deep dive on the most important free API for awarded grants + researcher data
- [[International]] — EU (Horizon Europe), US, German, and other international funding
- [[STEM & Medical]] — Science, tech, engineering, health research funding
- [[Professional Bodies]] — Discipline-specific learned societies and professional associations
- [[Niche & Overlooked]] — The long tail: obscure trusts, niche foundations, unusual sources
- [[Tech & Corporate]] — Corporate R&D grants and tech company awards
- [[Data Sources & APIs]] — API integration details and data access notes
- [[Source Deep Dive]] — Exhaustive grant source map across all categories

## Strategy (`wiki/strategy/`)

- [[Claude-Powered Grant Discovery]] — AI extraction loop as alternative to hardcoded scrapers

## User Feedback (`wiki/feedback/`)

- [[User Feedback Index]] — All beta test and advisor feedback, cross-cutting themes
- [[Max Licciardi Feedback]] — Beta feedback: UX pain points and feature requests
- [[Alexandros Zenonos Feedback]] — Beta feedback: researcher workflow and matching quality

---

> **Personal KG** (contacts, applications, email threads) lives in a separate private repo: `finn-kg`. This vault is project-only.
