# Researcher Intake — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Approach:** A — Expanded IntakeData

---

## Problem

The current intake pipeline is CV-first. The researcher uploads a CV and Claude extracts everything. This works well for complete, current CVs — but fails when:

- A senior researcher has an outdated CV
- A researcher doesn't want to share their CV
- Structured data (collaboration style, funding goals, eligibility constraints) can't be reliably inferred from a CV

**Goal:** Make CV optional. The intake form itself captures a complete researcher profile. The CV becomes a shortcut to auto-fill fields, not a requirement.

---

## Decision

**Approach A — Extend `IntakeData`.**

The profile-builder prompt merges form data + CV (if provided) into the same `ResearcherProfile` shape. Form data takes precedence over CV-extracted data when both are present.

---

## New IntakeData Schema

```typescript
// src/lib/types.ts

export interface ResearcherIdentifiers {
  orcid?: string;                     // "0000-0000-0000-0000"
  google_scholar_url?: string;
  researcher_id?: string;             // Clarivate ResearcherID
  scopus_author_id?: string;
  institutional_profile_url?: string;
}

export interface EligibilityConstraints {
  employment_type?: 'permanent' | 'fixed_term' | 'independent' | 'postdoc' | 'phd_student';
  phd_year?: number;                  // derive years_since_phd at match time
  nationality?: string[];             // ISO 3166-1 alpha-2 codes
  institution_country?: string;       // ISO 3166-1 alpha-2
  institution_type?: 'university' | 'research_institute' | 'hospital' | 'ngo' | 'industry';
}

export interface FundingGoals {
  intended_use?: (
    | 'phd_students'
    | 'postdocs'
    | 'equipment'
    | 'travel'
    | 'research_time'
    | 'collaboration'
    | 'public_engagement'
  )[];
  budget_range?: { min?: number; max?: number; currency?: string };
  preferred_duration_months?: number;
  open_to_consortium?: boolean;
}

export interface CollaborationProfile {
  open_to_collaboration?: boolean;
  collaboration_types?: ('industry' | 'academic' | 'international' | 'public_sector' | 'ngo')[];
  preferred_roles?: ('PI' | 'Co-I' | 'partner')[];
}

export interface IntakeData {
  // Core identity
  name?: string;
  identifiers?: ResearcherIdentifiers;

  // Career
  institution?: string;
  department?: string;
  institution_country?: string;
  career_stage?: 'phd_student' | 'postdoc' | 'early_career' | 'mid_career' | 'senior';

  // Research
  research_themes?: string[];
  research_keywords?: string[];
  disciplinary_fields?: string[];
  geographic_focus?: string[];
  future_research?: string;           // kept for backwards compat
  research_trajectory?: string;       // 3-5 year vision

  // Funding
  funding_goals?: FundingGoals;

  // Collaboration
  collaboration?: CollaborationProfile;

  // Eligibility (factual only)
  eligibility?: EligibilityConstraints;

  // Optional CV — kept as escape hatch, no longer required
  cv_text?: string;                   // extracted text from uploaded file
}
```

---

## ResearcherProfile Extensions

Add these fields to `ResearcherProfile` so the matcher can use them:

```typescript
// Additional fields on ResearcherProfile (append to existing type)
  orcid?: string;
  funding_goals?: FundingGoals;
  collaboration?: CollaborationProfile;
  eligibility?: EligibilityConstraints;
  research_trajectory?: string;
```

---

## Form UX — Smart Progressive Wizard

The form is a 7-step wizard. Steps 2–3 may be pre-filled after step 1.

| Step | Section | Auto-populate source |
|------|---------|---------------------|
| 1 | Identifiers — ORCID, Scholar URL | — triggers auto-populate |
| 2 | Career — name, institution, career stage, employment type | ORCID |
| 3 | Research — themes, keywords, fields, trajectory | ORCID + Scholar |
| 4 | Funding — intended use, budget range, duration | — |
| 5 | Collaboration — open to collab, types, preferred role | — |
| 6 | Eligibility — nationality, institution type, PhD year | ORCID |
| 7 | CV upload *(optional)* — fills any remaining gaps | — |

### Progressive disclosure rules

- Step 1 is always shown first.
- After ORCID/Scholar URL is entered, fetch data and pre-fill steps 2–3.
- Pre-filled fields are shown with a "Auto-filled — click to edit" badge.
- Steps 4–6 are always manual — no external data source covers them.
- Step 7 (CV) is explicitly optional. Show: "Have a CV? Upload it to fill any gaps automatically."

---

## ORCID Auto-populate

**ORCID public API** — no auth required for public records.

Endpoint: `https://pub.orcid.org/v3.0/{orcid}/record`
Response content-type: `application/json` (set `Accept: application/json`)

Fields to extract and map:

| ORCID field | IntakeData field |
|-------------|-----------------|
| `person.name` | `name` |
| `activities-summary.employments` | `institution`, `department`, `institution_country` |
| `activities-summary.educations` (most recent PhD) | `eligibility.phd_year` |
| `activities-summary.works` | feeds `research_themes` keywords heuristic |

ORCID fetch happens client-side (Next.js route handler at `/api/orcid?id=...`) to avoid CORS issues.

---

## Profile-Builder Prompt Changes

The profile-builder currently assumes a CV is the primary input. With Approach A, it must handle three input modes:

1. **Form only** — no CV, build profile purely from `IntakeData`
2. **CV only** — existing behaviour (backwards compat for old sessions)
3. **Form + CV** — merge, with form data taking precedence

Key prompt instruction to add:

> "You will receive structured intake data and optionally a CV. When both are present, treat structured intake fields as ground truth — use the CV only to fill fields not covered by the intake form. Never override an intake field with CV-extracted data."

---

## Pipeline Integration Points

| File | Change |
|------|--------|
| `src/lib/types.ts` | Expand `IntakeData`, add sub-interfaces, extend `ResearcherProfile` |
| `src/components/IntakeForm.tsx` | Replace with multi-step `ResearcherIntakeWizard` |
| `src/lib/prompts/profile-builder.ts` | Handle form-only and form+CV modes |
| `src/app/api/orcid/route.ts` | New — ORCID proxy route handler |
| `src/app/api/build/route.ts` | Pass full `IntakeData` to profile-builder instead of just two fields |

---

## Out of Scope (this iteration)

- Google Scholar scraping (ORCID covers the high-value fields)
- Saving/resuming a partial intake form
- Researcher accounts or profiles stored server-side
- PDF parsing for non-CV documents (institutional profile pages etc.)
