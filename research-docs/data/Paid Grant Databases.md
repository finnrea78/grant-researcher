# Paid Grant Databases

> Related: [[Home]] | [[UK Grant Landscape]] | [[Free APIs]]

Institutional and commercial databases. None have free public APIs (with one exception). All require institutional subscription or significant individual spend.

---

## Institutional Subscriptions (university pays)

### Research Professional

- **URL:** researchprofessional.com
- **UK focus:** Yes — built for the UK academic market
- **Coverage:** Comprehensive UK, EU, and international funding opportunities
- **API:** Yes — some UK universities have used the API to build internal matching tools
- **Cost:** Institutional pricing only (quote-based, ~£10k+/yr)
- **Users:** Cambridge, Oxford, York, Reading, many Russell Group universities
- **Features:** Keyword search, discipline filter, career stage, closing date alerts, weekly email digests

**Relevant note:** If Grant Researcher is deployed within a university that subscribes, there may be a licensing pathway to use their API as a data source. This would give a single clean feed of normalised UK opportunities without maintaining per-funder scrapers.

---

### ResearchConnect (Funding Institutional)

- **URL:** myresearchconnect.com
- **UK focus:** Yes — "unrivalled Enterprise dataset for UK-based universities"
- **Coverage:** 23,000+ active opportunities from UK, EU, international funders; 8M+ awarded grants from 15,000 funders
- **API:** Yes — enables direct integration into institutional systems
- **Cost:** Institutional only
- **Users:** Aberdeen, many Russell Group universities

This is arguably the most directly comparable product to what Grant Researcher is building. It has an API which is unusual in this space.

---

### Pivot-RP (Clarivate)

- **URL:** clarivate.com/pivot-rp
- **Coverage:** 34,000+ active opportunities worth $86B+, 5M+ historical awarded grants, 20,000+ global funders
- **API:** No public API — web portal only
- **Cost:** ~$700/yr individual; institutional pricing on request
- **Users:** MIT, Brown, UCSB, many top US/UK universities
- **Features:** AI-powered "Funding Advisor" (opportunity matching), semantic search, saved searches

Previously ProQuest COS Pivot, acquired by Clarivate. Most well-known in the US market.

---

### GrantForward (ProQuest)

- **URL:** grantforward.com
- **Coverage:** 89,000+ grants from 20,000+ sponsors, updated daily. Covers full cycle: sponsors → pre-solicitations → active grants → awarded
- **API:** No public API
- **Cost:** Tiered by institution size (based on headcount + research expenditure)
- **Users:** Illinois, UND, RIT, many US research universities
- **UK relevance:** Mostly US-focused

10-11x larger database than competitors (by their own claim).

---

### SPIN (InfoEd)

- **URL:** spin.infoedglobal.com
- **Coverage:** Global funding opportunities
- **API:** No public API
- **Cost:** Institutional subscription
- **Notes:** Older product, less AI capability, used at some traditional research universities

---

## Individual/Org Subscriptions

### Dimensions.ai (Digital Science)

- **URL:** dimensions.ai
- **Coverage:** 6M+ grants linked to 200M+ publications, patents, clinical trials
- **API:** Yes — full REST API with semantic search
- **Cost:** Free for non-commercial scientometrics research (apply, takes ~1 month); otherwise institutional/paid
- **Free tier eligibility:** Must be time-limited, non-commercial, publish results in peer-reviewed journal
- **Notes:** Best-in-class for linking grants → publications → citations → patents. Part of Digital Science portfolio (same parent as Altmetric, Figshare, Symplectic).

This is the closest thing to a paid OpenAlex. If free tier eligibility fits, this is worth applying for — the API quality is excellent.

---

### Instrumentl

- **URL:** instrumentl.com
- **Coverage:** US nonprofit and foundation grants primarily
- **API:** No
- **Cost:** $179-499/month
- **UK relevance:** Low — US nonprofit focus, not academic research

---

## Summary: Build vs Buy

| Option | Pros | Cons |
|--------|------|------|
| **Build scrapers** (what we're doing) | Own the data, no dependencies, free | Maintenance burden per funder, scraping can break |
| **Research Professional API** | Single source, normalised, maintained | Institutional licence needed, can't redistribute |
| **ResearchConnect API** | Same as above, UK-focused | Same constraints |
| **Dimensions API** | Excellent quality, rich links | Paid; free tier has strict eligibility |
| **OpenAlex** | Free, open, 11.5M grants | Awarded only, not open opportunities |

**Conclusion:** For open opportunities, we build scrapers (no alternative exists for free). For awarded grants intelligence, [[OpenAlex]] is the right free choice. If a university deployment is planned, negotiating access to Research Professional or ResearchConnect's API would eliminate most of the scraper maintenance burden.
