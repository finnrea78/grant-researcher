# OpenAlex

> Related: [[00 - Home]] | [[Free APIs]] | [[UK Grant Landscape]] | [[Pipeline Status]]

## What it is

OpenAlex is a free, open-source scholarly graph — a replacement for Microsoft Academic Graph. It indexes 250M+ academic works and links them to authors, institutions, funders, and now grants/awards.

**Key fact:** Wellcome gave OpenAlex $3.6M specifically to make funding data a first-class part of the open scholarly graph. Awards are now their own entity type with a dedicated API endpoint.

---

## API

| Property | Detail |
|----------|--------|
| Base URL | `https://api.openalex.org` |
| Authentication | None required |
| Rate limit | Polite use; add `?mailto=your@email.com` for priority access ("polite pool") |
| Cost | Free |
| Data licence | CC0 (public domain) |
| Scale | 250M+ works, 32,000 funders, 11.5M+ grants ingested |

---

## Awards Endpoint

`GET https://api.openalex.org/awards`

This is new — awards are now first-class entities (previously grants were only represented as metadata on works).

### Award object fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | OpenAlex ID |
| `display_name` | string | Award title (if available) |
| `awardee_number` | string | Grant number as assigned by funder (e.g. `AH/T001011/1`) |
| `funder` | object | Funder name, ROR ID, OpenAlex ID |
| `funding_type` | string | "grant", "fellowship", etc. |
| `funding_scheme` | string | Programme name (e.g. "Research Project Grants") |
| `start_date` | string | ISO 8601 |
| `end_date` | string | ISO 8601 |
| `funded_outputs` | list | OpenAlex Work IDs linked to this award |
| `landing_page_url` | string | URL at funder website |
| `doi` | string | DOI if registered |

### Useful filter queries

```
# All grants from UK funders
GET /awards?filter=funder.country_code:gb

# Grants from a specific funder (by ROR or OpenAlex ID)
GET /awards?filter=funder.id:https://openalex.org/F4320306076

# Works funded by UKRI/AHRC
GET /works?filter=grants.funder:https://openalex.org/F4320306076

# Awards in a date range
GET /awards?filter=start_date:>2020-01-01
```

---

## Funders Endpoint

`GET https://api.openalex.org/funders`

32,000 funders indexed. Data sourced from Crossref + Wikidata + ROR.

### Filter examples

```
# All UK funders
GET /funders?filter=country_code:gb

# Funders by number of awards
GET /funders?filter=awards_count:>100&sort=awards_count:desc

# Single funder by ROR ID
GET /funders/ror:057ygzn29    # UKRI
```

### Funder object fields

`awards_count`, `works_count`, `cited_by_count`, `h_index`, `i10_index`, `country_code`, `display_name`, `description`, `crossref_id`, `ror_id`, `wikidata_id`

---

## Authors Endpoint (for researcher enrichment)

This is potentially as valuable as the grants data. OpenAlex has rich researcher profiles.

```
# Look up an author by ORCID
GET /authors?filter=orcid:0000-0002-1234-5678

# Author's works
GET /works?filter=author.id:<openalex_author_id>

# Author's funded works
GET /works?filter=author.id:<id>,grants.funder:country_code:gb
```

Author objects include: institutions, topics (AI-assigned), h-index, works count, citation metrics, co-authors, ORCID linkage.

This could directly enrich the `researchers` table in the pipeline — match a researcher's ORCID to their OpenAlex profile and pull in their research topics, past funding, and publication metrics.

---

## How it fits in the pipeline

| Use case | OpenAlex value |
|----------|---------------|
| **Awarded grants enrichment** | 11.5M grants — who got funded, for what, by whom |
| **Matching intelligence** | "Researchers like you (by topic/institution) got funded for X" |
| **Researcher profile enrichment** | Pull topics, metrics, funding history by ORCID |
| **Funder intelligence** | What does a funder typically fund? What topics? What career stage? |
| **Open opportunities** | Not available — OpenAlex only has awarded/historical grants |

---

## Data quality caveats

- Coverage of grant-work links depends on funders registering awards with **Crossref**. Some funders do this well (NIH, Wellcome), others don't (Leverhulme has minimal coverage).
- The `awards` endpoint is new and growing — 11.5M is a large number but not complete coverage of all global grants.
- Funding scheme names (`funding_scheme`) are inconsistently populated.

---

## Comparison to GtR

| Property | OpenAlex | UKRI GtR |
|----------|----------|----------|
| UK UKRI grants | Partial (via Crossref) | Complete, authoritative |
| Non-UKRI UK grants | Yes (Wellcome, etc.) | No |
| International grants | Yes | No |
| Grant reference numbers | Yes | Yes |
| Links to publications | Yes | Yes (within UKRI) |
| Researcher profiles | Rich | Limited |
| API stability | Stable, well-maintained | Marked unsupported, flaky |
| Cost | Free | Free |

**Recommendation:** Use OpenAlex for broad matching intelligence and researcher enrichment. Keep GtR for authoritative UKRI grant reference data (where you need the grant ref number to be canonical).

See [[Pipeline Status]] for the current state of the GtR connector.
