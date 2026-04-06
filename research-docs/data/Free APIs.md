# Free Grant APIs

> Related: [[Home]] | [[UK Grant Landscape]] | [[OpenAlex]] | [[Grant Databases — Full Catalogue]]

APIs with no cost and no (or minimal) authentication. All suitable for ETL integration.

---

## OpenAlex

The most important free API for grant data. Full detail at [[OpenAlex]].

- **Coverage:** 11.5M+ awarded grants, 32,000 funders, 250M+ works
- **UK coverage:** Yes — filter by `country_code:gb`
- **Type:** Awarded grants + researcher profiles
- **Auth:** None (add `?mailto=` for polite pool)
- **Best for:** Matching intelligence, researcher enrichment via ORCID

---

## UKRI Gateway to Research (GtR)

- **Base URL:** `https://gtr.ukri.org/gtr/api/`
- **Auth:** None
- **Format:** JSON (`Accept: application/vnd.rcuk.gtr.json-v7`) or XML
- **Coverage:** All 173,000+ UKRI-funded projects (AHRC, BBSRC, EPSRC, ESRC, MRC, NERC, STFC, Innovate UK, Research England)
- **Type:** Awarded grants only
- **Status:** Officially "unsupported" by UKRI since ~2021 — still works but can be unstable

Key endpoints:
```
GET /projects           # paginated all projects
GET /projects/<uuid>    # single project
GET /funds              # funding records
GET /persons            # principal investigators
```

See [[Pipeline Status]] — the GtR connector has known instability issues.

---

## 360Giving / GrantNav

- **API URL:** `https://api.threesixtygiving.org/api/v1/`
- **Auth:** None
- **Rate limit:** 2 requests/second
- **Format:** JSON (CC-BY-SA licensed data)
- **Coverage:** 200+ UK charity and foundation publishers. 1M+ grants since ~2004. Updated daily.
- **Type:** Awarded grants (charitable giving)

Key endpoints:
```
GET /org/{ORG_ID}/grants_made/      # all grants from a funder
GET /org/{ORG_ID}/grants_received/  # all grants to an org
GET /org/                           # directory of publishers
```

Org ID format: `GB-CHC-1164883` (uses org-id.guide standard)

**Important caveat:** 360Giving covers charitable giving — it includes Wellcome and some foundations, but **major academic research funders (UKRI, Leverhulme) do not publish here**. It's not a substitute for UKRI data, but it fills in some charity funder awarded grant history.

Publishers of note: Wellcome Trust, National Lottery Community Fund, National Lottery Heritage Fund, many local authorities and community foundations.

---

## NIH RePORTER (US)

- **API URL:** `https://api.reporter.nih.gov/`
- **Auth:** None
- **Format:** JSON (POST requests)
- **Rate limit:** 1 request/second recommended; large jobs on weekends or 9pm-5am EST
- **Coverage:** All NIH and HHS-funded projects. Very rich data.
- **Type:** Awarded grants

Search endpoint: `POST https://api.reporter.nih.gov/v2/projects/search`

```json
{
  "criteria": {
    "fiscal_years": [2023, 2024],
    "agencies": ["NIMH"],
    "advanced_text_search": { "query": "machine learning", "operator": "and" }
  },
  "limit": 500,
  "offset": 0
}
```

Returns: project title, abstract, PI, institution, award amount, direct/indirect costs, fiscal year, activity code.

**Relevance for UK researchers:** Low for finding UK grants, but potentially relevant if scope expands internationally or for researchers with US collaborations.

---

## NSF Awards (US)

- **API URL:** `https://api.nsf.gov/services/v1/awards`
- **Auth:** None
- **Format:** JSON or XML
- **Max results:** 3,000 per query
- **Coverage:** All NSF-funded awards since 2007
- **Type:** Awarded grants

```
GET https://api.nsf.gov/services/v1/awards.json?keyword=climate+change&rpp=25
GET https://api.nsf.gov/services/v1/awards/{id}.json
```

Parameters: `keyword`, `rpp` (1-25), `offset`, `awardeeStateCode`, `dateStart`/`dateEnd`, `estimatedTotalAmtFrom`/`To`

**Relevance for UK:** Low unless international scope.

---

## Grants.gov (US Federal)

- **API URL:** `https://api.grants.gov/v1/api/`
- **Auth:** None for search
- **Format:** JSON
- **Coverage:** All US federal grant **opportunities** (open calls) — not awarded grants
- **Type:** Open opportunities

```
POST https://api.grants.gov/v1/api/search2
{ "keyword": "biomedical" }
```

**This is one of the few free APIs for open opportunities (not just awarded grants).** US-only relevance, but the architecture pattern is interesting.

---

## NIHR Open Data (UK)

- **API URL:** `https://nihr.opendatasoft.com/api/explore/v2.1/catalog/datasets/infonihr-open-dataset/records`
- **Auth:** None
- **Format:** JSON (OpenDataSoft platform)
- **Coverage:** All NIHR awards since 2011 — health and care research
- **Type:** Awarded grants, updated quarterly

Low relevance for humanities/social science researchers; useful if scope includes health research.

---

## Wellcome Grants CSV

Not an API, but a free bulk download.

- **URL:** `https://wellcome.org/grant-funding/people-and-projects/grants-awarded`
- **Format:** CSV/XLSX (updated periodically)
- **Coverage:** 4,962 grants since October 2000
- **Fields:** Award amount, key dates, applicants, summaries, programme areas
- **Licence:** CC BY 4.0

Good for bootstrapping historical Wellcome data without scraping. Can be ingested once and then supplemented by [[Free APIs#360Giving|360Giving]] updates.
