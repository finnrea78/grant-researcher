# Grant Databases — Full Catalogue

> Related: [[00 - Home]] | [[UK Grant Landscape]] | [[Free APIs]] | [[Paid Grant Databases]] | [[OpenAlex]] | [[Pipeline Status]]
> Date: 2026-04-02 (updated 2026-04-06)
> Scope: UK researchers (all UKRI councils + independent UK foundations)
> Purpose: Catalogue of all grant databases and data sources relevant to the grant-researcher app

---

## Critical Distinction: Awarded vs Open Grants

Before reviewing sources, understand this split — it shapes every integration decision:

| Type | What it is | Where it lives |
|---|---|---|
| **Open opportunities** | Grants you can currently apply for | Individual funder websites (HTML only) |
| **Awarded grants** | Historical record of what was funded | GtR API (UKRI), 360Giving API (charities), NIHR API |

The grant-researcher app primarily needs **open opportunities**. The GtR API is a record of 173,000+ past projects — brilliant for understanding funder priorities and enriching match reasoning ("this researcher's profile resembles past AHRC award winners"), but it tells you nothing about what's open to apply for right now. Open calls live only on individual funder websites.

---

## Section 1: UKRI Councils

UKRI (UK Research and Innovation) is the umbrella body for nine UK research councils. All UKRI-funded awarded grants are accessible via the **Gateway to Research (GtR) API**. Open funding calls are listed on the **UKRI Funding Finder**.

### UKRI Funding Finder (Open Opportunities)

| Field | Detail |
|---|---|
| **URL** | https://www.ukri.org/opportunity/ |
| **API** | No — HTML only |
| **Cost** | Free |
| **Coverage** | All currently open UKRI funding calls across all councils (~100 live at any time) |
| **Filter URL pattern** | `/opportunity/?filter_council[]=ahrc` (swap council name) |
| **Sort by closing date** | `/opportunity/?filter_order=closing_date` |
| **Integration** | WebFetch on the listing page — good seed URL for grant scanner |

### Gateway to Research (GtR) — Awarded Grants API

| Field | Detail |
|---|---|
| **URL** | https://gtr.ukri.org |
| **API** | Yes — full REST API, v7 |
| **Base URL** | `https://gtr.ukri.org/gtr/api/` |
| **Authentication** | None |
| **Cost** | Free (Open Government Licence) |
| **Data format** | JSON (`Accept: application/vnd.rcuk.gtr.json-v7`) or XML |
| **Scale** | 173,200+ projects across all UKRI councils |

**Key endpoints:**
```
GET /projects              — paginated list of all awarded projects
GET /projects?ref=AH/T001011/1  — lookup by grant reference
GET /projects/<uuid>       — single project detail
GET /funds                 — funding records
GET /organisations         — research organisations
GET /persons               — principal investigators
```

**Data per project:** grant title, abstract, technical abstract, status (Active/Closed), grant category (Fellowship/Research Grant/etc.), lead funder, PI, lead organisation, publications linked, collaborations, financial value.

**Key limitation:** No keyword search — pagination only. Filter by funder after fetching.

**Councils covered:** AHRC, BBSRC, EPSRC, ESRC, MRC, NERC, STFC, Innovate UK, Research England.

### AHRC (Arts and Humanities Research Council)

| Field | Detail |
|---|---|
| **Open calls URL** | https://www.ukri.org/opportunity/?filter_council[]=ahrc |
| **Awarded grants** | Via GtR API (filter by `leadFunder: AHRC`) |
| **API** | No dedicated API; open calls are HTML only |
| **Application portal** | https://ahrc.ukri.org/funding/ |

### ESRC (Economic and Social Research Council)

| Field | Detail |
|---|---|
| **Open calls URL** | https://www.ukri.org/opportunity/?filter_council[]=esrc |
| **Awarded grants** | Via GtR API |

### MRC (Medical Research Council)

| Field | Detail |
|---|---|
| **Open calls URL** | https://www.ukri.org/opportunity/?filter_council[]=mrc |
| **Awarded grants** | Via GtR API |

### EPSRC (Engineering and Physical Sciences)

| Field | Detail |
|---|---|
| **Open calls URL** | https://www.ukri.org/opportunity/?filter_council[]=epsrc |
| **Legacy grants UI** | https://gow.epsrc.ukri.org (search UI over GtR data — use GtR API directly) |
| **Awarded grants** | Via GtR API |

---

## Section 2: Independent UK Foundations

These funders are **not** in the GtR API (they are independent charities, not UKRI bodies). Programmatic access is scraping only.

### British Academy

| Field | Detail |
|---|---|
| **Funding pages URL** | https://www.thebritishacademy.ac.uk/funding/ |
| **API** | No |
| **Application portal** | https://britishacademy.flexigrant.com (Flexi-Grant — no public API) |
| **Cost** | Free to browse |
| **Coverage** | Humanities and social sciences. Schemes: Small Research Grants, Mid-Career Fellowships, Postdoctoral Fellowships, International Partnerships. Distributed £50M+ in 2024. |
| **Note** | British Academy IS a UKRI body — awarded grants appear in GtR |
| **Integration** | WebFetch on funding listing page |

### Leverhulme Trust

| Field | Detail |
|---|---|
| **Grant listings URL** | https://www.leverhulme.ac.uk/listings |
| **API** | No — AJAX-based listings (Drupal taxonomy filters) |
| **Filter pattern** | `/listings?field_grant_scheme_target_id=<id>` |
| **Application portal** | https://grants.leverhulme.ac.uk (login required) |
| **Cost** | Free to browse |
| **Coverage** | All disciplines. Independent charity — does NOT appear in GtR. Fellowships, project grants, doctoral scholarships, visiting professorships. Major funder for humanities. |
| **Integration** | WebFetch on listings page; consider per-scheme pages too |
| **Important** | This is one of the most important independent funders for UK humanities researchers — must be in the seed list |

### Wellcome Trust

| Field | Detail |
|---|---|
| **Funding portfolio URL** | https://wellcome.org/grant-funding |
| **API** | No — XLSX bulk download only (16.5 MB, updated periodically) |
| **Download** | Full grants dataset from Oct 2000. Follows 360Giving Data Standard. CC BY 4.0. |
| **Also in** | 360Giving / GrantNav |
| **Cost** | Free |
| **Coverage** | Biomedical and health science, globally. £1.5bn awarded in 2023/24. Some humanities-adjacent (science history, public engagement). |
| **Integration** | WebFetch on grant-funding listing page for open calls |

### Nuffield Foundation

| Field | Detail |
|---|---|
| **Funding URL** | https://www.nuffieldfoundation.org/funding |
| **API** | No |
| **Coverage** | Social science, education, law, justice. UK focus. |
| **Integration** | WebFetch |

### Wolfson Foundation

| Field | Detail |
|---|---|
| **Funding URL** | https://www.wolfson.org.uk/funding/ |
| **API** | No |
| **Coverage** | Arts, humanities, science, health and disability. Capital and revenue grants. |
| **Integration** | WebFetch |

### Paul Mellon Centre for Studies in British Art

| Field | Detail |
|---|---|
| **Grants URL** | https://www.paul-mellon-centre.ac.uk/fellowships-and-grants |
| **API** | No |
| **Coverage** | British art and architectural history specifically. Fellowships, book grants, digital initiatives. |
| **Integration** | WebFetch |

### Henry Moore Foundation

| Field | Detail |
|---|---|
| **Grants URL** | https://www.henry-moore.org/grants |
| **API** | No |
| **Coverage** | Sculpture, visual arts, art history. |
| **Integration** | WebFetch |

### Art Fund

| Field | Detail |
|---|---|
| **Grants URL** | https://www.artfund.org/about-us/for-museums/grants |
| **API** | No |
| **Coverage** | Museum acquisitions and projects. Relevant for museum studies/curatorial researchers. |
| **Integration** | WebFetch |

### National Lottery Heritage Fund

| Field | Detail |
|---|---|
| **Funding URL** | https://www.heritagefund.org.uk/funding |
| **API** | No |
| **Coverage** | Heritage, culture, natural environment. Project grants from £10K to £10M+. |
| **Integration** | WebFetch |

### British Council

| Field | Detail |
|---|---|
| **Funding URL** | https://www.britishcouncil.org/arts/funding |
| **API** | No |
| **Coverage** | International arts/culture exchange. Relevant for researchers with international collaborative work. |
| **Integration** | WebFetch |

---

## Section 3: International Funders

### European Research Council (ERC)

| Field | Detail |
|---|---|
| **Open calls URL** | https://erc.europa.eu/apply-grant/open-calls |
| **API** | No documented public API for open calls |
| **Coverage** | ERC Starting Grants (early career), Consolidator Grants (mid), Advanced Grants (established). EU-based. Post-Brexit UK researchers can apply. |
| **Integration** | WebFetch |
| **Note** | High prestige, very competitive, long timelines |

### Marie Skłodowska-Curie Actions (MSCA)

| Field | Detail |
|---|---|
| **URL** | https://marie-sklodowska-curie-actions.ec.europa.eu/calls |
| **API** | No |
| **Coverage** | Fellowships and researcher mobility. Post-Brexit UK researchers eligible for some schemes. |

### Andrew W. Mellon Foundation

| Field | Detail |
|---|---|
| **Grants URL** | https://www.mellon.org/grants |
| **API** | No |
| **Coverage** | Arts, humanities, higher education globally. US foundation but funds UK/European institutions significantly. |
| **Integration** | WebFetch |

### Getty Foundation

| Field | Detail |
|---|---|
| **Grants URL** | https://www.getty.edu/foundation/initiatives/ |
| **API** | No |
| **Coverage** | Visual arts, conservation, art history, museum practice. US but funds internationally. |
| **Integration** | WebFetch |

### Fulbright Commission (UK)

| Field | Detail |
|---|---|
| **Awards URL** | https://www.fulbright.org.uk/applying-for-a-fulbright-award/ |
| **API** | No |
| **Coverage** | US-UK academic exchange. Scholars and students. |
| **Integration** | WebFetch |

---

## Section 4: APIs with Structured Data

These offer machine-readable data, no scraping required.

### Gateway to Research API (GtR)

_(Described in full in Section 1 above)_

**Use for:** Understanding what similar researchers have been funded for; enriching match reasoning; verifying researcher track record claims against public data.

**Not for:** Finding open calls to apply to.

### 360Giving / GrantNav API

| Field | Detail |
|---|---|
| **API base URL** | https://api.threesixtygiving.org/api/v1/ |
| **Authentication** | None |
| **Cost** | Free (Creative Commons licensed data) |
| **Rate limit** | 2 requests/second per IP |
| **Data format** | JSON |
| **Coverage** | 200+ UK charity and foundation publishers. Wellcome Trust, National Lottery Community Fund, local authorities. Grants from ~2004 onwards. Updated daily. |

**Key endpoints:**
```
GET /org/{ORG_ID}/grants_received/    — grants received by an organisation
GET /org/{ORG_ID}/grants_made/        — all grants made by a funder
GET /org/                             — organisation directory
```

**Fields per grant:** `title`, `description`, `amountAwarded`, `awardDate`, `grantProgramme`, `fundingOrganization`, `recipientOrganization`, `classifications`, `fundingType`

**Key limitation:** Oriented around org lookups, not keyword search. Search is UI-only via GrantNav. Data is charitable giving, not academic research grants (though Wellcome and some foundations publish here).

**Org ID format:** `GB-CHC-1164883` (follows org-id.guide standard)

### NIHR Open Data API

| Field | Detail |
|---|---|
| **API URL** | https://nihr.opendatasoft.com/api/explore/v2.1/catalog/datasets/infonihr-open-dataset/records |
| **Authentication** | None |
| **Cost** | Free |
| **Data format** | JSON (OpenDataSoft platform) |
| **Coverage** | All NIHR (National Institute for Health Research) awards since 2011. Health and care research. Updated quarterly. |
| **Key limitation** | Health/biomedical only — low relevance for humanities/social science researchers |

### OpenAlex

| Field | Detail |
|---|---|
| **API URL** | https://api.openalex.org |
| **Authentication** | API key required (from openalex.org/settings/api) |
| **Cost** | Free tier: $1/day credit; list queries $0.0001 each |
| **Data format** | JSON |
| **Coverage** | 32,000+ funders globally. Academic *works* linked to funder grants via CrossRef metadata. |

**Key endpoints for grant data:**
```
GET /funders?filter=country_code:gb          — UK funders
GET /funders/<id>                            — single funder detail
GET /works?filter=grants.funder:<funder_id>  — works funded by a specific funder
```

**Key limitation:** This indexes funded *academic outputs* (papers, books), not grant opportunities. Coverage of grant-work links is incomplete — depends on funders registering awards with CrossRef.

**Polite pool tip:** Add `?mailto=your@email.com` to requests for priority rate-limit access.

---

## Section 5: Commercial / Paywalled Sources

These exist and are worth being aware of, but are not viable for programmatic integration without a paid subscription.

### GrantFinder (grantfinder.co.uk)

| Field | Detail |
|---|---|
| **URL** | https://grantfinder.co.uk / https://search.mygrantfinder.co.uk |
| **API** | No public API |
| **Cost** | Paid subscription (Idox commercial product) |
| **Coverage** | Business grants, charity/community funding, national and international sources — broad UK coverage |
| **Integration** | Not viable — paywalled, no API, scraping likely prohibited by ToS |
| **Note** | This is the most convenient aggregator but completely closed. Universities often subscribe institutionally. |

### Research Professional / Pivot-RP

| Field | Detail |
|---|---|
| **URL** | https://www.researchprofessional.com |
| **API** | No public API |
| **Cost** | Institutional subscription (very expensive) |
| **Coverage** | Comprehensive global funding opportunities — most complete dataset available |
| **Note** | Most UK universities subscribe. If Grant Researcher is deployed within a university, there may be a licensing pathway. |

### Dimensions (Digital Science)

| Field | Detail |
|---|---|
| **URL** | https://app.dimensions.ai |
| **API** | Yes — but paid |
| **Cost** | Paid institutional subscription |
| **Coverage** | Global grants database with semantic search. Highly accurate. |
| **Note** | Has a limited free tier for individuals; institutional license needed for bulk access |

---

## Section 6: Recommended _urls.md Seed List

Based on the above research, these URLs should be in `data/funding-sources/_urls.md` for the grant scanner:

```markdown
# Grant Funding Seed URLs

## UKRI / Government
- https://www.ukri.org/opportunity/
- https://www.ukri.org/opportunity/?filter_council[]=ahrc
- https://www.ukri.org/opportunity/?filter_council[]=esrc
- https://www.ukri.org/opportunity/?filter_council[]=mrc

## Major Independent UK Foundations
- https://www.leverhulme.ac.uk/listings
- https://www.thebritishacademy.ac.uk/funding/
- https://wellcome.org/grant-funding
- https://www.nuffieldfoundation.org/funding
- https://www.wolfson.org.uk/funding/
- https://www.heritagefund.org.uk/funding

## Arts & Humanities Specialist
- https://www.paul-mellon-centre.ac.uk/fellowships-and-grants
- https://www.henry-moore.org/grants
- https://www.artfund.org/about-us/for-museums/grants
- https://www.britishcouncil.org/arts/funding

## International
- https://erc.europa.eu/apply-grant/open-calls
- https://www.mellon.org/grants
- https://www.getty.edu/foundation/initiatives/
- https://www.fulbright.org.uk/applying-for-a-fulbright-award/
```

---

## Section 7: Potential Future Integrations

| Integration | Effort | Value | Notes |
|---|---|---|---|
| GtR API — awarded grants enrichment | Medium | High | Use to explain *why* a funder is a good match ("AHRC has funded 47 similar projects") |
| 360Giving API — foundation grants | Medium | Medium | Useful for arts/heritage foundations; data is awarded grants not open calls |
| UKRI Funding Finder scrape | Low | High | Already possible with WebFetch; ~100 live opportunities at any time |
| Research Professional API | High | Very High | Requires institutional licensing; most complete dataset |
| Dimensions API | High | Very High | Paid; semantic search quality is excellent |
| NIHR Open Data API | Low | Low | Health-only; low relevance unless scope expands |

---

## Summary

The grant data landscape splits cleanly:

- **Free APIs (awarded grants):** GtR (UKRI), 360Giving (charities), NIHR (health)
- **HTML scraping required (open calls):** UKRI Funding Finder, Leverhulme, British Academy, Wellcome, and all other individual funder pages
- **Paywalled (best coverage):** Research Professional, Dimensions, GrantFinder

The grant-researcher app's scan-then-match architecture is well-suited to the scraping approach — it fetches once, stores locally, and matches offline. The main action item is populating `_urls.md` with the seed list above. A future GtR API integration would add significant matching intelligence by grounding match explanations in real awarded grant data.
