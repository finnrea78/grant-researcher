# GrantResearcher: Data Sources, APIs & Aggregator Platforms

## TIER 1: FREE APIs & STRUCTURED OPEN DATA

These are the sources GrantResearcher should ingest first. They provide programmatic access to large, structured grant datasets.

### 360Giving (UK)
- **What**: 1M+ grants, £265bn+, from 275+ UK funders including 17 central government departments
- **API**: HTTP/JSON REST API. Endpoints for grants data and org summaries.
- **Bulk**: Full dataset as CSV or JSON (several hundred MB, growing). Updated daily.
- **Datastore**: Direct read-only access available for complex queries.
- **License**: CC-BY-SA (free for any purpose with attribution)
- **URL**: grantnav.threesixtygiving.org, api: 360giving.org/explore/technical/api/
- **Registration**: Required for API access
- **Coverage**: UK trusts, foundations, and government grants. Best source for the long tail of UK charitable funders.

### Gateway to Research (GtR) — UKRI
- **What**: All UKRI-funded research projects, people, organisations, outputs
- **API**: Public REST API
- **URL**: gtr.ukri.org
- **Coverage**: All 7 research councils + Innovate UK + Research England
- **Use for**: Understanding what's been funded (helps with "who funds research like mine?" queries)

### CORDIS (EU)
- **What**: All EU Framework Programme projects (FP1 through Horizon Europe). 56,000+ organisations.
- **API**: REST API via api.store (free). Monthly datasets.
- **Bulk**: Full project data downloadable as CSV/XML from EU Open Data Portal. Includes projects, deliverables, publications, participating organisations, EuroSciVoc classifications.
- **URL**: cordis.europa.eu, data.europa.eu
- **Coverage**: All Horizon Europe, Horizon 2020, FP7 projects
- **Use for**: Grant call matching + consortium partner discovery + precedent analysis

### Grants.gov / Simpler.Grants.gov (US Federal)
- **What**: All US federal grant opportunities across 26 agencies
- **API**: REST API (early development). Search, filter by agency/status/date. API key via web interface.
- **URL**: simpler.grants.gov, wiki.simpler.grants.gov/product/api
- **Coverage**: NSF, NIH, NEH, DOE, DARPA, NASA, DoD, etc.
- **Limitations**: API is under active development, features may change

### Find a Grant (UK GOV)
- **What**: UK government grants. Made mandatory for all departments/ALBs.
- **API**: Available for integration
- **URL**: find-government-grants.service.gov.uk
- **Coverage**: ~98 schemes, £9.4bn+, growing. Target is 100% of eligible government grants.

### UKRI Opportunities Page
- **What**: Current open funding calls from all UKRI councils
- **URL**: ukri.org/opportunity
- **Access**: Web scrape (structured HTML, filterable by council)
- **Coverage**: All open UKRI calls with deadlines, eligibility, amounts

### Charity Commission Register (UK)
- **What**: All registered charities in England & Wales (168,000+)
- **URL**: register-of-charities.charitycommission.gov.uk
- **Access**: Search + data downloads. Can identify grant-making trusts.
- **Use for**: Discovering the 8,800+ grant-making trusts. Cross-reference with 360Giving to find which ones publish grants data.
- **Equivalents**: OSCR (Scotland), CCNI (Northern Ireland)

---

## TIER 2: FREE WEB SOURCES (SCRAPING REQUIRED)

These don't have APIs but have structured, scrapeable websites:

### UK Funders
- AHRC, BBSRC, EPSRC, ESRC, MRC, NERC, STFC — individual opportunity pages
- British Academy — funding schemes page
- Leverhulme Trust — current schemes
- Wellcome Trust — funding schemes
- NIHR — funding opportunities
- Arts Council England — funding finder
- Heritage Fund — open programmes
- Royal Society — grants portfolio
- Royal Academy of Engineering — grants
- Nuffield Foundation — current programmes
- Esmée Fairbairn Foundation
- Paul Hamlyn Foundation

### International
- Gerda Henkel Foundation — grants pages (German/English)
- Getty Foundation — grants and fellowships
- DAAD scholarship database — structured, searchable
- JSPS — funding opportunities
- ARC (Australia) — current opportunities
- NRF (South Africa) — calls
- QNRF (Qatar) — programmes
- Ford Foundation grants database — searchable, public
- Mellon Foundation — recent grants (public)

### Aggregators (free tier)
- EURAXESS (euraxess.org.uk) — 800+ sources, EU + UK focus
- fundit.fr — European grants aggregator
- fundsforNGOs — international grants, free listings
- Opportunity Desk — global fellowships/grants
- scientifyRESEARCH — research grants aggregator
- EUFundingPortal.eu — 549+ EU/international calls (free newsletter, €99/year for full access)

---

## TIER 3: COMMERCIAL/SUBSCRIPTION DATABASES

These are the competitors but also potential data partners or benchmarks:

| Platform | Coverage | Price | Notes |
|----------|----------|-------|-------|
| **Research Professional** | UK, EU, international. All disciplines | Institutional subscription (expensive) | Most widely used by UK universities. Comprehensive alerts. |
| **Pivot (ProQuest)** | International. Funding + collaborator discovery | Institutional subscription | Requires institutional affiliation |
| **GrantForward** | 30,000+ sponsors | Varies by org size (higher end) | AI matching, academic-focused |
| **Instrumentl** | US foundations + federal | ~$179/month | AI matching, 990 data, pipeline management |
| **Foundation Directory Online (Candid)** | 312,000+ grantmakers | ~$219/month Professional | Industry standard for foundation research. Deepest data. |
| **GrantFinder** | UK local/national/international | Subscription | Expert-curated, alerting service |
| **GrantWatch** | 27,000+ active grants | From $18/week | Short-burst research sprints |
| **Grant Gopher** | US nonprofits | Free tier + $9/month Pro | Budget-friendly |
| **Atom Grants** | AI-powered, multi-source | ~$100/year | Semantic search matching |
| **GrantSelect** | Detailed grant records | Subscription | Good metadata per grant |
| **Directory of Social Change (DSC)** | UK trusts/foundations | Subscription | Long-established |

---

## TIER 4: SUPPLEMENTARY DATA

### IRS Form 990s (US)
- All US foundations must file Form 990, which lists every grant awarded.
- Available via ProPublica Nonprofit Explorer (free, API available)
- Can programmatically build a complete picture of what any US foundation funds.

### UK Grantmaking (UKGrantmaking.org)
- Annual collaborative analysis from 360Giving + ACF + others
- Interactive platform with sector-wide data on who makes grants
- Free, updated annually (latest: June 2025, using 2023-24 data)

### NERC Grants on the Web
- gotw.nerc.ac.uk — all NERC-funded projects, searchable
- Legacy system, data may be incomplete post-2024

### Funding Scotland (funding.scot)
- Scotland-specific grants database

### WCVA (Wales Council for Voluntary Action)
- Wales-specific funding portal

### NICVA (Northern Ireland Council for Voluntary Action)
- NI-specific funding database

---

## COMPETITIVE LANDSCAPE FOR GRANTRESEARCHER

### What exists (and what's missing)

**Existing tools serve institutions, not individual researchers.** Research Professional and Pivot are sold to university research offices at institutional prices. Individual researchers have limited access.

**No tool combines:**
1. Comprehensive grant discovery (APIs + scraped + curated)
2. AI-powered matching to a researcher's profile
3. Application assistance (drafting, reviewing)
4. The long tail of 8,800+ UK trusts
5. International sources
6. Discipline-agnostic coverage

**GrantResearcher's unique wedge:**
- Start with the free open data (360Giving, GtR, CORDIS, Grants.gov)
- Layer on AI matching using Claude
- Add the long tail through Charity Commission + curated scraping
- Price for individual researchers (not institutions)
- The agent can explain *why* a grant is relevant and help draft the application

### Data refresh cadence
| Source | Recommended refresh |
|--------|-------------------|
| 360Giving | Daily (they update daily) |
| GtR | Weekly |
| UKRI Opportunities | Daily (calls open/close) |
| CORDIS | Monthly |
| Grants.gov | Daily |
| Funder websites | Weekly-monthly |
| Charity Commission | Quarterly |
| Professional bodies | Monthly |
