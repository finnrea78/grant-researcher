# Grant Researcher — Research Vault

> Last updated: 2026-04-14
> Purpose: Research and strategy notes for the grant-researcher app — a free AI-powered grant matching tool for UK researchers.

## What this vault is

Notes from research sessions on grant data sources, APIs, strategy, and the technical pipeline. Use this as the starting point for any new work.

---

## Session Start Protocol

New session? Read [[Codebase Index]] first (~2 min). It gives you full orientation without re-exploring the codebase.

---

## Maps of Content

### Grant Data & Sources
- [[UK Grant Landscape]] — The full picture of UK grant sources and the strategic gap we're filling
- [[Grant Databases — Full Catalogue]] — Every source catalogued: free, paid, API or scrape
- [[Free APIs]] — Programmatic, no-cost data sources (GtR, OpenAlex, NIH, NSF, etc.)
- [[Paid Grant Databases]] — Institutional/licensed options (Pivot-RP, Research Professional, etc.)
- [[OpenAlex]] — Deep dive on the most important free API for awarded grants + researcher data
- [[International]] — EU (Horizon Europe), US, German, and other international funding sources
- [[STEM & Medical]] — Science, tech, engineering, health research funding
- [[Professional Bodies]] — Discipline-specific learned societies and professional associations
- [[Niche & Overlooked]] — The long tail: obscure trusts, niche foundations, and unusual sources
- [[Tech & Corporate]] — Corporate R&D grants and tech company awards

### System & Architecture
- [[Architecture]] — Full agent system design, data architecture, competitive analysis
- [[Pipeline Status]] — What's built, what's working, what's broken
- [[Source Deep Dive]] — Exhaustive grant source map across all categories
- [[Data Sources & APIs]] — API integration details and data access notes

### User Feedback
- [[User Feedback Index]] — All beta test and advisor feedback, plus cross-cutting themes

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| UK grants first, international later | Scope control — UKRI alone has 300+ live opportunities |
| Build our own DB (not rely on paid aggregators) | No free aggregated UK research grants DB exists; Pivot-RP/Research Professional are £10k+/yr |
| Two-tier scrape strategy | UKRI = high-frequency ETL; charity funders = low-frequency monitor of ~40-50 static schemes |
| OpenAlex for awarded grants | Free, 11.5M+ grants, links to publications and authors — better than GtR for matching intelligence |

---

## The Core Gap We're Filling

No free, aggregated UK research grants database exists with an API. The gap is exactly what Pivot-RP and Research Professional fill — at institutional pricing. Grant Researcher is a free alternative.

```
Open opportunities  →  UKRI Funding Finder (scrape)
                    →  Charity funder pages (scrape, ~40-50 schemes total)

Awarded grants      →  OpenAlex API (11.5M grants, free)
                    →  UKRI GtR API (UKRI-specific, flaky but authoritative)

Researcher data     →  OpenAlex authors (ORCID linkable, publications, topics)
```

---

## Session Log

| Date | Topic |
|------|-------|
| 2026-04-02 | Initial grant database catalogue ([[Grant Databases — Full Catalogue]]) |
| 2026-04-06 | Landscape deep-dive: free APIs, paid DBs, OpenAlex, UK strategy |
| 2026-04-11 | DB-first pipeline design: opportunities/funders as Supabase source of truth, retrieval RPCs |
| 2026-04-12 | Fix "Opportunity not found" bug — thread UUID through match → propose pipeline via HTML comments |
| 2026-04-14 | Added user feedback notes (Max Licciardi, Alexandros Zenonos); flattened vault to flat structure |
