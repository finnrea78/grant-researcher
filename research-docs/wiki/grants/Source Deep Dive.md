# GrantResearcher: Exhaustive Grant Source Map

*Every possible grant source, database, and funding channel — from the obvious to the obscure.*

---

## 1. CORE UK RESEARCH COUNCILS (UKRI)

The seven councils plus Research England and Innovate UK. These are the obvious ones but each has its own portal:

| Council | Focus | Portal |
|---------|-------|--------|
| **AHRC** | Arts & humanities | ukri.org/opportunity |
| **BBSRC** | Biological sciences | " |
| **EPSRC** | Engineering & physical sciences | " |
| **ESRC** | Social sciences & economics | " |
| **MRC** | Medical research | " |
| **NERC** | Environment | " |
| **STFC** | Science & technology facilities | " |
| **Innovate UK** | Industry R&D & commercialisation | " |
| **Research England** | HE institutional funding | " |

**Data access:** Gateway to Research (gtr.ukri.org) has a public API exposing all UKRI-funded projects, outputs, and participants. This is scrapeable/queryable and should be a primary data source.

---

## 2. UK GOVERNMENT GRANTS

- **Find a Grant** (find-government-grants.service.gov.uk) — mandatory portal for all UK exchequer-funded government grants. ~98 schemes, £9.4bn+. Has an API for integration.
- **360Giving / GrantNav** (grantnav.threesixtygiving.org) — 1M+ grants, £265bn+, from 275+ UK funders including 17 central government departments. **Has a REST API** and bulk CSV/JSON downloads under CC-BY-SA. This is the single richest open data source for UK grants.
- **360Giving API** — HTTP/JSON endpoints for grants data and organisation summaries. Free, registration required.
- **Government Grants Register** — available via api.store, historical data on grant schemes by department.
- **Devolved governments:**
  - Scotland: Chief Scientist Office, Scottish Funding Council, Royal Society of Edinburgh
  - Wales: WCVA funding portal
  - Northern Ireland: HSC R&D, NICVA funding, NI Executive grants portal

---

## 3. MAJOR UK TRUSTS & FOUNDATIONS

### Tier 1: Large, cross-disciplinary
- **Leverhulme Trust** — £80M/year. All subjects except medical. Research projects, fellowships, early career, visiting professorships. *Especially important for arts & humanities.*
- **Wellcome Trust** — £29.1bn endowment. Biomedical, medical humanities, public engagement. PhD fellowships, discovery research, career development awards.
- **Nuffield Foundation** — Social policy, education, welfare, justice research.
- **Esmée Fairbairn Foundation** — Arts, children & young people, environment, food, social change.
- **Joseph Rowntree Foundation** — Housing, social care, poverty, social policy.
- **Paul Hamlyn Foundation** — Arts access, education, migration & social justice.

### Tier 2: Discipline-specific / niche
- **John Templeton Foundation** — Science & religion, philosophy, character virtue. Large grants ($$$).
- **Paul Mellon Centre** — British art & architectural history (medieval to present). Fellowships & grants twice yearly.
- **Foyle Foundation** — Performing/visual arts, and learning/education.
- **Wolfson Foundation** — Humanities, science, health, education. Often co-funds with British Academy.
- **Barrow Cadbury Trust** — Criminal justice, migration, civic participation.
- **Alcohol Education & Research Council** — Alcohol-related research.
- **NESTA** — Innovation, technology, creative economy.
- **National Lottery Community Fund** — Health and social research.
- **National Lottery Heritage Fund** — Heritage, culture, community history.

### Tier 3: Smaller / hyper-niche
- **Leverhulme Trade Charities Trust** — Grants for people connected to travelling sales, pharmacy, or grocery trades.
- **Vegetarian Charity** — Small grants (up to £500) for vegetarians/vegans under 26.
- **Sir Richard Stapley Educational Trust** — £400–£1,000 annual grants for any subject.
- **Iolanthe Midwifery Trust** — Awards for midwives and student midwives including research fellowships, Dora Opoku Awards for Black and Brown midwives.
- **RCN Foundation** — Nursing and midwifery education, research, practice development.
- **Nightingale Fund** — Post-registration education for nurses/midwives including PhDs.
- **Barbers' Company Clinical Nursing Scholarship** — Nurses/midwives in clinical practice.
- **Elizabeth Casson Trust** — Occupational therapy grants, doctoral/masters studies.
- **Abbeyfield Research Foundation** — Research on older people.
- **British Geriatrics Society** — Grants/prizes for older people's healthcare research.
- **British Scoliosis Research Foundation** — Scoliosis research grants.
- **Private Physiotherapy Education Foundation** — Research awards for physiotherapy.
- **CIMA** — Management accountancy research projects and conferences.

### Discovery method: 360Giving + Charity Commission
There are **8,800+ grant-making trusts and foundations** in the UK providing ~£2.1bn/year. The Charity Commission register (register-of-charities.charitycommission.gov.uk) combined with 360Giving data is the best way to programmatically discover them.

---

## 4. UK LEARNED SOCIETIES & NATIONAL ACADEMIES

- **British Academy** — £50M+ in 2024. Postdoctoral fellowships, mid-career fellowships, senior fellowships, BA/Leverhulme small research grants (up to £7,500), skills acquisition awards, international mobility schemes.
- **Royal Society** — Science fellowships, research grants, industry fellowships, international exchanges.
- **Royal Academy of Engineering** — Engineering research, academia-industry links.
- **Academy of Medical Sciences** — Biomedical career development, grant schemes, mentoring.
- **Royal Society of Edinburgh** — Scotland's national academy. Research grants, fellowships for cultural/economic/social wellbeing of Scotland.
- **Institute of Historical Research** — Fellowships for historians at all career stages, annual awards and bursaries.
- **Royal Society of Medicine** — Maternity and Newborn Forum awards open to midwives.

---

## 5. EUROPEAN FUNDING (UK now fully associated with Horizon Europe)

### Horizon Europe (€95.5bn, 2021–2027)
- **Pillar I — Excellent Science:**
  - European Research Council (ERC) — Starting, Consolidator, Advanced, Synergy grants. UK hosted 18 Synergy projects, 2nd highest in Europe.
  - Marie Skłodowska-Curie Actions (MSCA) — Fellowships, doctoral networks, staff exchanges.
- **Pillar II — Global Challenges:** Thematic clusters including Health, Digital & Space, Climate & Mobility, Culture/Creativity/Inclusive Society.
- **Pillar III — Innovative Europe:** European Innovation Council (EIC).

**Data access:**
- **EU Funding & Tenders Portal** (ec.europa.eu/info/funding-tenders) — Has APIs for programmatic search of open calls.
- **CORDIS** (cordis.europa.eu) — 56,000+ organisations across all Framework Programmes. Full open datasets downloadable as CSV/XML from EU Open Data Portal. Monthly updates. REST API available via api.store. Keyword-based search across project titles, acronyms, objectives.
- **CORDIS Horizon Europe API** — Structured datasets including projects, deliverables, publications, participating organisations.
- **Horizon Dashboard** — Public statistics on proposals, funded projects, results.

### European Space Agency (ESA)
- **ESA Co-funded Research** — Up to 50%, up to €90,000 for PhD (3 years) or postdoc (2 years). Novel space-related research. Applications via Open Space Innovation Platform (OSIP) year-round.
- **ESA Post-Graduate Research Grant Programme** — €5,000 grants for history/social science/humanities research on ESA history. Open to postgrads and early-career academics. Archival research at Historical Archives of the European Union (HAEU) in Florence.
- **ESA Academy** — Conference sponsorship, short course scholarships, academic scholarships.
- **EU Agency for Space Programme (EUSPA)** — Grants for space-enabled services in higher education, fisheries, agriculture, etc.

### Other European
- **European University Institute** — Administers ESA grants and other archival research grants.
- **EUFundingPortal.eu** — Independent searchable database of 549+ EU/international calls.

---

## 6. GERMAN FOUNDATIONS (open to international applicants)

- **Gerda Henkel Foundation** — Major funder for historical humanities. Research scholarships (€2,760/month postdoc, €3,720/month senior), research projects, PhD scholarships. Open to any nationality. Disciplines: archaeology, art history, historical Islamic studies, history, history of science, history of law, prehistory. Special programmes: Democracy, Forced Migration, Lost Cities, Patrimonies (cultural heritage in crisis regions). **Lisa Maskell Fellowships** — supporting young humanities scholars in Africa since 2014.
- **Volkswagen Foundation (VolkswagenStiftung)** — One of Europe's largest private science funders. Various programmes including "Challenges for Europe", humanities/social sciences.
- **Alexander von Humboldt Foundation** — Research fellowships for experienced researchers of any nationality to work in Germany. Prestigious.
- **DAAD** (German Academic Exchange Service) — Extensive database of scholarships. Many open to UK-based researchers.
- **Fritz Thyssen Foundation** — History, language & culture, philosophy & theology, social sciences.

---

## 7. US FOUNDATIONS & AGENCIES (accessible to UK researchers)

### Major foundations
- **Getty Foundation / Getty Research Institute** — Scholars programme (residential), library research grants, Connecting Art Histories initiative (funded research seminars globally including Africa & South Asia), African American Art History Initiative. Grants range from $5,000 to $240,000+.
- **Andrew W. Mellon Foundation** — Humanities, arts, higher education. Conservation Initiative in African Art ($1.5M grants). Major global humanities funder.
- **Ford Foundation** — Social justice, arts & culture, civic engagement. Has funded Museum for African Art, Museum of West African Art (Benin artefacts digitisation).
- **National Endowment for the Humanities (NEH)** — US federal agency but funds international collaborative projects.
- **Fulbright Commission** — UK-US research exchanges.
- **Social Science Research Council (SSRC)** — Various fellowship programmes.

### US federal (some accessible to UK collaborators)
- **Grants.gov / Simpler.Grants.gov** — All US federal grants. Has a REST API with programmatic search. 26 federal agencies.
- **NIH** (National Institutes of Health) — 27 institutes. Funds international collaborations.
- **NSF** (National Science Foundation) — Some international partnership programmes.

---

## 8. HEALTH & MEDICAL (UK-SPECIFIC)

- **NIHR** (National Institute for Health & Care Research) — Major UK health research funder. Fellowships, project grants, programme grants. Special calls for nurses and midwives (RfPB programme — £3M across 16 projects in recent round).
- **Wellbeing of Women / RCM** — Entry Level Scholarships up to £20,000 for midwife-led research.
- **Association of Medical Research Charities (AMRC)** — 100+ member charities. Searchable database.
- **Cancer Research UK, British Heart Foundation, Parkinson's UK** — Disease-specific research charities.
- **Harkness Fellowships** — Health care policy and practice, mid-career professionals.

---

## 9. ARTS-SPECIFIC

- **Arts Council England** — Champions arts, museums, libraries. University applications must benefit wider community.
- **Creative Scotland** — Scotland's arts development agency.
- **Arts Council of Wales / Arts Council of Northern Ireland**
- **Heritage Fund** — National heritage projects connecting people and communities.
- **British Council** — International arts and cultural exchange. Various grant programmes.

---

## 10. INTERNATIONAL / DEVELOPMENT / AFRICA-SPECIFIC

Especially relevant for Will's African art history work:

- **Getty Connecting Art Histories** — Funded "Black Mediterranean" research at I Tatti (postdoc fellowships for scholars from Africa), "Modern Art Histories in and across Africa" at Cornell.
- **Gerda Henkel Lisa Maskell Fellowships** — Young humanities scholars in Africa.
- **Ford Foundation** — African art, culture, policy. Funded Museum of West African Art.
- **Mellon Foundation** — Conservation Initiative in African Art.
- **British Academy International programmes** — Various schemes for UK-international collaboration.
- **AHRC Global Challenges Research Fund (GCRF)** — £1.5bn for research addressing challenges faced by developing countries.
- **Newton Fund** — Science and innovation partnerships with developing countries.
- **SOAS (institutional)** — Various small grants for Africa/Asia research.

---

## 11. AGGREGATOR DATABASES & PLATFORMS

### Free / Open
| Platform | Coverage | API/Data Access |
|----------|----------|----------------|
| **360Giving GrantNav** | 1M+ UK grants, 275+ funders | REST API, bulk CSV/JSON |
| **CORDIS** | All EU Framework Programme projects | Open datasets, API via api.store |
| **Gateway to Research** | All UKRI-funded research | Public API |
| **Grants.gov / Simpler.Grants.gov** | All US federal grants | REST API (early dev) |
| **Find a Grant (GOV.UK)** | UK government grants | API available |
| **NERC Grants on the Web** | NERC-funded projects | Web interface |
| **Charity Commission Register** | 8,800+ UK grant-making trusts | Searchable, data downloads |
| **UKGrantmaking.org** | Annual sector analysis | Interactive platform |

### Subscription / Commercial
| Platform | Coverage | Notes |
|----------|----------|-------|
| **Research Professional** | UK, EU, international. All disciplines | Widely used by universities. Comprehensive alerts |
| **Pivot (ProQuest)** | International funding + collaborator discovery | Institutional subscription only |
| **GrantForward** | 30,000+ sponsors | Academic-focused, AI matching |
| **Instrumentl** | US foundations + federal | AI matching, 990 data |
| **Foundation Directory Online (Candid)** | 312,000+ grantmakers | Industry standard for foundation research |
| **GrantFinder** | UK local/national/international | Expert-curated, alerts |
| **GrantWatch** | 27,000+ active grants | Weekly/monthly subscription |
| **Grant Gopher** | US nonprofits | Free tier + $9/month Pro |
| **Atom Grants** | AI-powered, multi-source | Semantic search matching |
| **GrantSelect** | Detailed grant records | Individual/institutional subscriptions |

---

## 12. OPEN DATA SOURCES FOR BUILDING THE PRODUCT

These are the **programmatically accessible** sources GrantResearcher should ingest:

### Priority 1 (free, API/bulk access, UK-focused)
1. **360Giving API** — HTTP/JSON. Grants data + org summaries. Daily updates.
2. **Gateway to Research API** — UKRI projects, people, outputs.
3. **UKRI Opportunities page** — Scrape open funding calls.
4. **Find a Grant API** — UK government grants.
5. **CORDIS open datasets** — EU projects CSV/XML. Monthly updates.
6. **EU Funding & Tenders Portal APIs** — Open calls for Horizon Europe etc.

### Priority 2 (free, scraping required)
7. **British Academy funding pages** — Scheme details, deadlines.
8. **Leverhulme Trust** — Current schemes and deadlines.
9. **Wellcome Trust** — Funding schemes.
10. **Charity Commission register** — Identify grant-making trusts.
11. **NIHR funding opportunities** — Health research calls.
12. **Arts Council England** — Arts funding.

### Priority 3 (international, niche, manual curation needed)
13. **Getty Foundation** — Arts/humanities grants.
14. **Gerda Henkel Foundation** — Historical humanities.
15. **Mellon Foundation** — Humanities.
16. **Ford Foundation grants database** — Searchable, public.
17. **ESA OSIP** — Space research opportunities.
18. **EUSPA grants** — Space programme grants.
19. **Professional body websites** — RCM, RCN, CIMA, BPS, etc.

---

## 13. WEIRD & WONDERFUL: THE LONG TAIL

These illustrate the sheer breadth of what exists:

- **ESA Post-Graduate History Grant** — €5,000 to research the history of European space exploration in Florence archives
- **Iolanthe Midwifery Trust Dora Opoku Awards** — Specifically for Black and Brown midwives
- **Vegetarian Charity** — Up to £500 for vegetarian/vegan researchers under 26
- **Leverhulme Trade Charities Trust** — Must be connected to travelling sales, pharmacy, or grocery
- **Barbers' Company Scholarship** — For clinical nurses/midwives
- **Nightingale Fund** — Named after Florence Nightingale, for nursing education
- **Kings College Hospital Nurses' League** — CPD grants for league members
- **Alcohol Education & Research Council** — Alcohol-related research only
- **British Scoliosis Research Foundation** — Scoliosis only
- **Abbeyfield Research Foundation** — Older people research (last call 2020, dormant?)
- **Wellbeing of Women / RCM Entry Level Scholarship** — Up to £20,000, midwives only
- **Whitney & Lee Kaplan African American Visual Culture Collection Grant** — Getty, for research using a specific collection
- **Anne Willan & Mark Cherniavsky Gastronomy Collection Grant** — Getty, for culinary history research
- **Human Frontier Science Program** — Interdisciplinary life sciences, international

---

## 14. KEY INSIGHT FOR PRODUCT STRATEGY

The grant landscape is essentially a **power law distribution**:

- **~10 sources** (UKRI, Horizon Europe, Wellcome, Leverhulme, British Academy, NIHR, Nuffield, Esmée Fairbairn, Mellon, Getty) cover maybe **60-70%** of what a typical UK academic would be eligible for.
- The **next 50-100 sources** (trusts, foundations, professional bodies, international agencies) cover another **20-25%**.
- The **remaining 8,700+ grant-making trusts** form a massive long tail where individual grants are small but collectively significant, and where **discovery is the hardest problem**.

**GrantResearcher's competitive advantage is in the long tail.** Anyone can find AHRC calls. The value is in surfacing that the Gerda Henkel Foundation funds African art history at €2,760/month, or that the Iolanthe Trust has awards for midwifery research, or that ESA has a €5,000 humanities grant.

### Recommended data architecture
1. **Structured feeds** from APIs (360Giving, GtR, CORDIS, Grants.gov, Find a Grant)
2. **Scheduled scraping** of ~100 key funder websites
3. **AI-powered discovery** from the Charity Commission register (identifying which of 8,800 trusts are relevant to a given researcher's profile)
4. **Community/manual curation** for the most niche sources (professional bodies, international foundations)
5. **Researcher profile matching** using semantic similarity between research interests and grant descriptions

The agent should be able to say: *"Based on your work in African art history, I found 47 potential funding sources you probably haven't considered, including 3 from German foundations, 2 from US museums, and 12 UK trusts that have funded similar work in the last 3 years."*
