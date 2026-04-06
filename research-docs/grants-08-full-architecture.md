# GrantResearcher: Full Agent System Architecture

## THE VISION

An AI agent system that takes a researcher from "I need funding" to "here's your best shot at getting it" — across every grant source globally, with intelligence drawn from what's been funded before and why.

---

## SYSTEM FLOW

```
┌─────────────────────────────────────────────────────┐
│                 RESEARCHER INPUT                     │
│                                                      │
│  ORCID ─── CV ─── Google Scholar ─── Stated Goals   │
│                                                      │
│  "What I'm working on now"                          │
│  "What I want to do next"                           │
│  "Career stage / constraints"                       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            AGENT 1: PROFILE BUILDER                  │
│                                                      │
│  • Pull publications, grants, affiliations from      │
│    ORCID API (works, funding, employment)            │
│  • Parse CV for career stage, skills, methods        │
│  • Pull citation metrics from Google Scholar         │
│  • Extract research themes via semantic analysis     │
│  • Capture: current projects, future ambitions,      │
│    geographic constraints, discipline, career stage   │
│                                                      │
│  OUTPUT: Structured Researcher Profile               │
│  {disciplines, methods, themes, career_stage,        │
│   institution, country, past_grants, publications,   │
│   h_index, collaborators, stated_goals}              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│          AGENT 2: OPPORTUNITY MATCHER                │
│                                                      │
│  Searches across the full opportunity database:      │
│                                                      │
│  TIER 1 (API feeds, daily refresh):                  │
│   • 360Giving (1M+ UK grants)                       │
│   • Gateway to Research (all UKRI)                   │
│   • CORDIS (all EU projects)                         │
│   • Grants.gov (all US federal)                      │
│   • Find a Grant (UK gov)                            │
│   • UKRI Opportunities                               │
│                                                      │
│  TIER 2 (scraped, weekly):                           │
│   • 100+ key funder websites                         │
│   • British Academy, Leverhulme, Wellcome, etc.      │
│   • NIHR, Arts Council, Heritage Fund                │
│   • Getty, Gerda Henkel, Mellon, Ford                │
│   • JSPS, DAAD, ARC, NRF                            │
│                                                      │
│  TIER 3 (curated, monthly):                          │
│   • 8,800+ UK trusts (Charity Commission + AI)       │
│   • Professional body grants                         │
│   • Tech company awards                              │
│   • Niche/obscure sources                            │
│                                                      │
│  MATCHING: Semantic similarity between researcher    │
│  profile and grant descriptions + hard eligibility    │
│  filtering (career stage, nationality, discipline,   │
│  institution type)                                    │
│                                                      │
│  OUTPUT: Ranked opportunity list with match scores    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│         AGENT 3: ELIGIBILITY CHECKER                 │
│                                                      │
│  For each matched opportunity, validates:            │
│                                                      │
│  • Career stage requirements (ECR, mid-career, etc.) │
│  • Nationality/residency requirements                │
│  • Institutional eligibility (is their uni eligible?) │
│  • Discipline fit (within remit?)                    │
│  • Prior funding constraints (can't hold >1 of X)    │
│  • Timing (can they start in the right window?)      │
│  • Collaboration requirements (consortium needed?)    │
│  • Budget limits (does their idea fit the scale?)    │
│                                                      │
│  Flags: ✅ Eligible | ⚠️ Check | ❌ Ineligible       │
│                                                      │
│  OUTPUT: Filtered, eligibility-checked shortlist     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│       AGENT 4: INTELLIGENCE & STRATEGY               │
│                                                      │
│  For each shortlisted opportunity, provides:         │
│                                                      │
│  A. HISTORICAL ANALYSIS                              │
│  • Who has this funder funded before? (from GtR,     │
│    CORDIS, 360Giving, IRS 990s)                     │
│  • What topics/methods were successful?              │
│  • What's the typical award size & duration?          │
│  • What's the success rate (if known)?               │
│  • Who are the panel members / reviewers?            │
│                                                      │
│  B. PROPOSAL INTELLIGENCE                            │
│  • What makes a good proposal for THIS funder?       │
│  • Common reasons for rejection (from published      │
│    funder guidance, reviewer reports, community       │
│    knowledge)                                         │
│  • Funder-specific formatting/style preferences      │
│  • How to frame impact for this specific scheme      │
│  • Budget norms (what's typical, what's too much)    │
│                                                      │
│  C. COMPETITIVE LANDSCAPE                            │
│  • How many people typically apply?                   │
│  • What's the researcher's competitive position?     │
│  • Are there similar funded projects they should      │
│    differentiate from?                                │
│                                                      │
│  OUTPUT: Strategic briefing per opportunity           │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│        AGENT 5: PROPOSAL ASSISTANT                   │
│                                                      │
│  When the researcher decides to apply:               │
│                                                      │
│  • Generates proposal outline matched to funder's    │
│    structure/requirements                             │
│  • Drafts sections with funder-appropriate language   │
│  • Checks against eligibility/compliance rules       │
│  • Reviews for common pitfalls                       │
│  • Simulates reviewer perspective                    │
│  • Suggests improvements based on funded exemplars    │
│                                                      │
│  OUTPUT: Draft proposal + review feedback             │
└─────────────────────────────────────────────────────┘
```

---

## DATA ARCHITECTURE

### Researcher Profile Store
```
researcher {
  orcid_id
  name, institution, country
  career_stage (PhD student | ECR | mid-career | senior | emeritus)
  disciplines[] (using EuroSciVoc or similar taxonomy)
  research_themes[] (extracted from publications)
  methods[] (qualitative, quantitative, fieldwork, lab, computational...)
  publications[] {title, journal, year, citations, coauthors}
  past_grants[] {funder, title, amount, year, role}
  h_index, citation_count
  collaborator_network[]
  current_projects[]
  future_goals[] (free text, structured by agent)
  constraints {geography, timing, FTE_available}
}
```

### Opportunity Database
```
opportunity {
  id, source_db (360giving | gtr | cordis | scraped | curated)
  funder_name, funder_type (government | charity | foundation | corporate)
  title, description
  disciplines[] 
  eligibility {
    career_stages[], nationalities[], institution_types[]
    discipline_restrictions, other_constraints
  }
  amount {min, max, currency}
  duration {min_months, max_months}
  deadline, rolling_or_fixed
  url
  last_updated
  
  // enrichment from historical data
  historical_awards[] {recipient, institution, amount, year, project_title}
  avg_success_rate
  typical_award_size
  panel_info
}
```

### Funded Projects Database (the intelligence layer)
```
funded_project {
  source (gtr | cordis | 360giving | 990 | scraped)
  funder, scheme
  pi_name, pi_institution, pi_orcid
  title, abstract
  amount, duration, start_date
  disciplines[], themes[]
  outputs[] {publications, datasets, impacts}
}
```

This is built from:
- **Gateway to Research**: All UKRI-funded projects with abstracts, PIs, amounts, outputs
- **CORDIS**: All EU-funded projects with objectives, consortia, deliverables
- **360Giving**: 1M+ UK grants with recipients, amounts, dates
- **IRS 990s** (US): All foundation grants with recipients and amounts
- **Funder annual reports**: Scraped for additional context

---

## ORCID API INTEGRATION

ORCID provides structured researcher data via public API:

```
GET https://pub.orcid.org/v3.0/{orcid-id}/record
```

Returns:
- **Works**: Publications with titles, DOIs, journals, dates
- **Funding**: Past grants with funder name, grant number, title, amount
- **Employment**: Current and past affiliations with dates
- **Education**: Degrees, institutions, dates
- **Peer Review**: Review activity (signals seniority)

ORCID also has a member API for writing data back (e.g., adding newly won grants to a researcher's record — could be a differentiator).

### Google Scholar Integration
- No official API, but libraries exist (scholarly, serpapi)
- Pull: h-index, i10-index, citation count, publication list with citations
- Useful for: assessing research impact, identifying key themes

### Semantic Scholar API
- Free, structured API for publications
- Better metadata than Google Scholar
- Author profiles, citation graphs, research topics

---

## COMPETITIVE ANALYSIS

### Grantium.ai (SoftSim Technologies, Montreal)
- **Coverage**: 90+ programmes across 15+ funders. Small.
- **ORCID**: Yes, integrated for collaborator discovery
- **Profile**: AI auto-fills from CV + uploads
- **Eligibility**: AI checking before you apply
- **Proposal**: AI-assisted writing, compliance checking
- **Review sim**: AI simulates peer review, predicts scoring
- **Post-award**: Full lifecycle management
- **Gap**: Tiny funder database. No UK long tail. No historical intelligence.
- **Launched**: ~2025-26. Early stage.

### GrantFlux
- **Coverage**: Unclear size, but includes private foundations + international
- **ORCID**: Yes, immediate expertise analysis
- **Profile**: Peer modelling — finds researchers with similar profiles who got funded
- **Matching**: Prioritised opportunities with success probabilities
- **Proposal**: AI-suggested edits
- **Literature**: AI literature review tool
- **Gap**: Seems more analytics/discovery focused, less proposal depth. No UK-specific depth.

### Granted AI
- **Coverage**: 85,000+ grants from 144 sources, 15+ countries. 133,000 foundation profiles from 990s.
- **Matching**: Plain-language project description → AI matching + real-time LLM
- **Profile**: Opportunity Feed with weekly digests, urgency flags
- **Proposal**: Full RFP analysis → section-by-section drafting
- **Review sim**: 6 independent AI reviewers per grant type (domain expert, biostatistician, programme officer, equity reviewer, budget analyst, sceptic). Deliberation → consensus findings. One-click revision.
- **Compliance**: Automated IRS verification. Grant-Ready Badges.
- **Analytics**: Sector dashboards, foundation giving patterns, state-level drill-down, developer API
- **Gap**: US-centric (990s, federal grants). No UK/EU depth. No ORCID integration mentioned.
- **Strongest competitor for the "proposal intelligence" piece.

### Grantable
- **Coverage**: 130,000+ foundations via GrantGraph™ (990s + public records + web)
- **Matching**: Mission/geography/grant-size alignment scoring
- **Proposal**: Persistent AI "coworker" that remembers your org + past proposals
- **Pipeline**: Deadline management, team collaboration
- **Gap**: Nonprofit/charity focused, not academic researchers. US-centric.

### Atom Grants
- **Coverage**: Large, multi-source. AI matching.
- **Clients**: 50+ universities (NYU Langone, Auburn, Memphis)
- **Matching**: AI-powered, profile-based. Deep Research agent.
- **Gap**: Institutional product (sold to research offices, not individual researchers). No proposal writing.

### Research Professional (existing dominant player)
- **Coverage**: Comprehensive UK, EU, international. All disciplines.
- **Gap**: No AI matching. No proposal assistance. Expensive institutional subscription. Search-based, not agent-based.

---

## WHERE GRANTRESEARCHER WINS

None of the competitors combine ALL of:

1. **Global + UK long-tail coverage** — 360Giving's 1M+ grants + 8,800 UK trusts + CORDIS + Grants.gov + professional bodies + niche sources. No one else has the long tail.

2. **ORCID/Scholar-powered profiling** — Automated, not manual. Agent builds your profile from your actual research output.

3. **Eligibility-first filtering** — Hard eligibility check before you waste time. Career stage, nationality, discipline, institutional type.

4. **Historical intelligence** — "This funder awarded 12 grants in your area last year, average £85K, to ECRs at Russell Group universities. Here are the funded project abstracts so you can differentiate."

5. **Funder-specific proposal intelligence** — Not generic AI writing. "The Leverhulme Trust values curiosity-driven research and dislikes overly applied framing. Here's how successful Leverhulme proposals read vs. EPSRC proposals for similar topics."

6. **Individual researcher product** — Not sold to research offices. Priced for individual academics. This is the Spotify vs. radio play.

7. **Agent-based architecture** — Not a search engine. An agent that actively works for you, discovers things you didn't know existed, and tells you why they matter.

---

## MOATS & DIFFERENTIATION

### Data moat
- 360Giving + GtR + CORDIS + Charity Commission = massive open data advantage
- Historical funded project corpus → unique intelligence layer
- Professional body grants → curated by hand, no one else tracks these

### Intelligence moat
- Funded project analysis → "what works for this funder" → hard to replicate without the historical data
- Eligibility reasoning → requires deep understanding of each funder's rules
- Funder-specific tone/style guidance → requires training on actual funded proposals

### Distribution moat
- Individual researchers as customers (not institutions)
- Word of mouth in academic networks
- Land with researchers, expand to departments, then institutions

---

## MVP SCOPE

### V1: Discovery Agent
- ORCID + stated goals → profile
- Match against 360Giving + UKRI Opportunities + British Academy + Leverhulme + Wellcome
- Eligibility check
- Basic historical context ("this funder funded X similar projects")
- Output: ranked shortlist with explanations

### V2: Add proposal intelligence
- Historical funded project analysis
- Funder-specific writing guidance
- Proposal outline generation

### V3: Full lifecycle
- Proposal drafting + review simulation
- Deadline management
- Application tracking
- CORDIS + Grants.gov + international sources

---

## TECHNICAL STACK (from existing GrantResearcher plan)

- **Frontend**: Next.js
- **Backend/DB**: Supabase
- **AI**: Claude Agent SDK (long-running agent tasks)
- **Payments**: Stripe
- **Hosting**: Fly.io / Render / Railway (for agent workers)
- **Data pipeline**: Scheduled scraping + API polling → Supabase
- **Search**: Supabase pgvector for semantic matching, or dedicated vector DB
