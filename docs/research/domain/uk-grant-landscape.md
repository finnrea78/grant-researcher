# UK Grant Landscape

> Related: [[00 - Home]] | [[Grant Databases — Full Catalogue]] | [[Free APIs]] | [[Paid Grant Databases]]

## The Core Finding

**There is no free, aggregated UK research grants database.** Every funder operates its own silo. The institutional databases that aggregate them ([[Paid Grant Databases#Research Professional|Research Professional]], [[Paid Grant Databases#Pivot-RP|Pivot-RP]]) cost £10-20k/yr. Grant Researcher is building the free equivalent.

---

## UK Grant Sources — Tier 1: High-volume, API-accessible

These require real ETL pipelines because volume is high and data changes frequently.

| Source | Type | Method | Volume | Status |
|--------|------|--------|--------|--------|
| **UKRI Funding Finder** | Open opportunities | Scrape HTML | ~300+ rolling | Built — `ukri-finder.ts` |
| **UKRI GtR** | Awarded grants | REST API | 173,000+ projects | Built — `gtr.ts` (flaky, see [[Pipeline Status]]) |

UKRI is the dominant source. Nine research councils + Innovate UK all funnel through the same Funding Finder listing page.

---

## UK Grant Sources — Tier 2: Low-volume, scrape only

These funders have a small number of **standing schemes** (5-15 each) that change on annual cycles. Collectively ~40-50 schemes across all of them.

| Funder | Active Schemes (approx) | Discipline Focus | Update Frequency |
|--------|------------------------|------------------|-----------------|
| Wellcome Trust | 5-8 | Biomedical, health, some humanities | Annual cycle |
| Leverhulme Trust | 6 | All disciplines (independent) | Annual cycle |
| British Academy | 8-10 | Humanities, social sciences | Annual cycle |
| Royal Society | ~10 | Sciences | Annual cycle |
| Cancer Research UK | ~5 | Cancer biology/clinical | Rolling |
| NIHR | 20-30 | Health research | Monthly |
| Nuffield Foundation | ~6 | Social science, education, law | Annual |
| National Lottery Heritage Fund | Rolling | Heritage, culture | Rolling |

**Key insight:** Because these are small and static, they could be curated manually or scraped once a month. The scraping complexity is low per-funder. See [[Grant Databases — Full Catalogue#Section 2 Independent UK Foundations]] for URLs and details.

---

## Why charity funders aren't in GtR

The UKRI Gateway to Research API only covers grants made by **UKRI bodies** (the 9 research councils + Innovate UK). Independent charities — Wellcome, Leverhulme, Nuffield, etc. — are separate legal entities that don't report to GtR.

For awarded grants from these funders, the options are:
- **Wellcome**: Downloadable CSV (4,962 grants since 2000) + [[Free APIs#360Giving|360Giving API]]
- **Leverhulme**: No structured data at all — website only
- **British Academy**: Some data via [[Free APIs#360Giving|360Giving]]
- **Others**: [[Free APIs#OpenAlex|OpenAlex]] picks up some via Crossref funding metadata

---

## What doesn't exist (and why we're building it)

| Feature | Pivot-RP | Research Professional | Grant Researcher |
|---------|----------|-----------------------|-----------------|
| UK open opportunities | Yes | Yes (UK focus) | Building |
| Charity funders | Yes | Yes | Building |
| AI matching to researcher profile | Yes (Funding Advisor) | No | Yes |
| API access | No | Yes (for institutions) | Yes (open) |
| Cost | £10-20k/yr institutional | Institutional | Free |

---

## Strategic Recommendation: Two-Tier Architecture

```
Tier 1 — High-frequency (daily/weekly)
  UKRI Funding Finder → ETL pipeline → opportunities table
  (already built, ~300+ live opps at any time)

Tier 2 — Low-frequency (monthly)
  Wellcome, Leverhulme, British Academy, Royal Society, etc.
  → lightweight scraper per funder → opportunities table
  (~40-50 schemes total, mostly static)

Awarded grants (for matching intelligence)
  OpenAlex API → separate enrichment job
  (11.5M grants, links to papers + authors + ORCID)
```

See [[OpenAlex]] for why this is the best source for awarded grants data.
