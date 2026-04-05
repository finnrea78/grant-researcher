# Context — Grant Researcher

_Update this file each sprint. It tells Claude where the product is right now._

## What is this
AI-powered grant discovery and proposal support for UK academics. A researcher uploads their CV, and a five-stage Claude agent pipeline builds their profile, enriches it from the web, scans funding sources, scores and ranks grant matches, and drafts proposal alignment documents.

## Target user
UK arts and humanities academics — starting with Will as the first design partner. The tool is built for research administrators and academics who currently discover grants through word-of-mouth, mailing lists, and manual searching.

## Go-to-market
Land-and-expand: prove value with a single researcher (Will), then expand to departmental use, then institutional licensing. The product must earn trust by never showing irrelevant or ineligible grants.

## Pipeline
```
CV upload → Profile → Enrich → Scan → Match → Propose
```
1. **Profile** — parse CV into structured researcher profile (themes, track record, career stage, gaps)
2. **Enrich** — web research to fill gaps (Google Scholar, institutional pages, ORCID)
3. **Scan** — harvest funding source data from known URLs into `data/funding-sources/`
4. **Match** — score every funding scheme against the profile (5 dimensions, weighted), output tiered ranked list
5. **Propose** — draft strategic alignment document for a selected grant

## Current state
- Pipeline stages all functional end-to-end via the web UI
- Researcher profiles stored in Supabase + local filesystem
- Funding sources harvested from UKRI and stored as markdown
- Data pipeline workspace (`data-pipeline/`) for bulk grant ingestion from UKRI GtR and Finder APIs

## Open product questions
- **Eligibility filtering** — must not show grants the researcher is ineligible for (career stage, institution type). Core trust-builder.
- **Smaller grants** — surface overlooked funding beyond UKRI (ESA, charity grants, sector-specific schemes)
- **FEC splits** — display the real funder value, not the headline FEC amount
- **Success likelihood** — show estimated success rates; let researchers rank proposals against each other
- **Learning from outcomes** — study successful UKRI awards and collect outcome data from researchers to improve matching over time
- **Prompt injection** — security audit needed before public deployment (see GitHub issue #16)
