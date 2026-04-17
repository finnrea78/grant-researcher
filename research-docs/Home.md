# Grant Researcher — Research Vault

> A persistent wiki for grant data sources, strategy, and technical pipeline notes.
> LLM-maintained. Human responsibility: sourcing and asking questions. LLM responsibility: summarising, cross-referencing, maintenance.

## Entry points

- **[[index]]** — content catalog: all notes by category with one-line summaries (`wiki/index.md`)
- **[[log]]** — append-only activity log: Ingest / Query / Lint (`wiki/log.md`)
- **[[Codebase Index]]** — session-start codebase orienteer (~2 min) (`wiki/codebase/`)

## Vault structure

Project-only wiki. Finn's personal KG (contacts, applications, email threads) lives in a separate private repo: `finn-kg`.

```
research-docs/
├── Home.md          ← you are here
└── wiki/
    ├── index.md     ← master catalog
    ├── log.md       ← append-only activity log
    ├── codebase/    ← architecture, agents, schema, retrieval
    ├── grants/      ← UK landscape, APIs, databases, sources
    ├── strategy/    ← product strategy, AI discovery approaches
    └── feedback/    ← synthesised user feedback
```

## The core gap we're filling

No free, aggregated UK research grants database exists with an API. Grant Researcher is the free alternative to Pivot-RP and Research Professional (£10k+/yr institutional tools).

```
Open opportunities  →  UKRI Funding Finder (scrape)
                    →  Charity funder pages (scrape, ~40–50 schemes total)

Awarded grants      →  OpenAlex API (11.5M grants, free)
                    →  UKRI GtR API (UKRI-specific, flaky but authoritative)

Researcher data     →  OpenAlex authors (ORCID-linkable, publications, topics)
```

## Key decisions

| Decision | Rationale |
|----------|-----------|
| UK grants first | Scope control — UKRI alone has 300+ live opportunities |
| Build own DB | No free aggregated UK research grants DB exists |
| Two-tier scrape | UKRI = high-frequency ETL; charity funders = low-frequency monitor |
| OpenAlex for awarded grants | Free, 11.5M+ grants, links to publications and authors |
