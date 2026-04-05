# Grant Landscape — Domain Knowledge

_Stable reference for the grant discovery domain. Enrich this as you learn more from researchers and funders._

## UK funding landscape

### UKRI (UK Research and Innovation)
The primary public funder for UK academic research, made up of seven research councils plus Innovate UK and Research England:
- **AHRC** — Arts and Humanities Research Council (primary for our target users)
- **ESRC** — Economic and Social Research Council
- **EPSRC** — Engineering and Physical Sciences
- **BBSRC, MRC, NERC, STFC** — life sciences, medical, natural environment, science & technology
- **Innovate UK** — industry-facing innovation funding
- **Research England** — block grants to institutions

Each council runs its own funding schemes with different eligibility rules, deadlines, and expectations.

### Beyond UKRI
Many grants are invisible in mainstream databases:
- **Leverhulme Trust** — major charity funder for humanities and social sciences
- **British Academy** — fellowships, small grants, international partnerships
- **Wellcome Trust** — primarily biomedical but expanding into humanities intersections
- **European Space Agency** — has grant programmes often missed by UK academics
- Sector-specific and niche funders (e.g., TV production companies funding relevant research)
- University-internal funds, learned societies, and professional bodies

Surfacing these overlooked opportunities is a key differentiator.

## How academics talk about grants vs how funders describe them

Researchers describe their work in terms of **research questions, methodologies, and intellectual contributions**. Funders describe schemes in terms of **strategic priorities, impact pathways, and capacity building**. The matcher agent must bridge this vocabulary gap — translating a researcher's track record into the language funders use to evaluate fit.

Example: A researcher studying "digital archives of medieval manuscripts" maps to AHRC's strategic theme of "digital humanities and cultural heritage preservation."

## Key metadata for matching

### Eligibility (binary gate)
- Career stage (early career, mid-career, established)
- Institution type (HEI, independent research org, charity)
- Nationality/residency requirements
- Whether the scheme requires a co-investigator or partner institution
- Whether the researcher has already held a grant from this funder

### Thematic alignment (heaviest weight)
- Research themes vs funder priority areas
- Methodological fit (e.g., practice-based research, interdisciplinary)
- How the researcher's publications map to the funder's portfolio

### Track record
- Publication record relative to career stage
- Prior grants held (size, funder, completion)
- Supervision and leadership experience
- International collaboration history

### Practical factors
- Deadline proximity
- Application complexity and effort required
- Historical success rates for the scheme
- Grant size and duration

## FEC (Full Economic Costing)

UK university grants use FEC — the total cost of a project including overheads. Funders typically pay 80% of FEC; the university covers the remaining 20%.

Example: A grant listed at "£800k FEC (80/20)" means:
- Total project cost: £800k
- Funder pays: £640k
- University co-funds: £160k

This is **not** a £1M grant. The app must display the correct split so researchers understand the real funder contribution.

## Scoring model

Matches are scored using a weighted rubric (defined in `src/lib/prompts/matcher.ts`):

| Dimension | Weight | What it measures |
|---|---|---|
| Eligibility | Gate | Binary — ineligible = score 0 regardless |
| Thematic alignment | 3x | Research themes vs funder priorities |
| Track record fit | 2x | Publications, prior grants vs scheme expectations |
| Strategic fit | 1x | How much this grant advances the researcher's career |
| Practical factors | 1x | Deadline, complexity, success rate |

**Overall** = (thematic x 3 + track_record x 2 + strategic x 1 + practical x 1) / 7

Tiers: **Strong Matches (7+)**, **Worth Exploring (4–6.9)**, **Long Shots (<4)**

## UKRI Gateway to Research (GtR)

The GtR API holds 173,000+ past funded projects. This data is useful for:
- Understanding what a funder has historically prioritised
- Enriching match reasoning ("this profile resembles past AHRC award winners")
- Training/validating the scoring model

But GtR records **what was already funded**, not what is currently open. Open calls live on individual funder websites — the scan agent harvests those from seed URLs in `data/funding-sources/_urls.md`.

## Funding source data model

Each funding source is stored as a markdown file in `data/funding-sources/`. Files follow the template at `_template.md` and contain:
- Funder name and scheme name
- Eligibility criteria
- Funding amount and duration
- Deadline and application process
- Strategic priorities and thematic areas
- URL to the original listing

The scan agent creates and updates these files. The match agent reads them.
