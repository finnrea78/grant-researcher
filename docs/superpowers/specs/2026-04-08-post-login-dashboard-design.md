# Post-Login Dashboard

## Context

Auth is wired (Supabase email/password, RLS on `researchers.user_id`). But after login, users always land on the intake wizard — even if they have existing researchers with completed pipelines. The "resume" dropdown is easy to miss. We need a dashboard that shows the user their researchers and lets them jump back in or start fresh.

## Design

### Home page (`src/app/page.tsx`) becomes a dashboard

**Two states based on whether the user has any researchers:**

**Empty state** — No researchers for this user. Show the `ResearcherIntakeWizard` inline, exactly as today. Identical UX for first-time users.

**Populated state** — One or more researchers exist:
- Header: "Grant Scout" title + sign-out button (top-right, already exists)
- List/grid of researcher cards
- "+ New researcher" button → navigates to `/new`

### Researcher cards

Each card shows:
- **Researcher name**
- **Pipeline status label** — a short string like:
  - "Profile building..." (has row but no enriched_profile)
  - "Ready to enrich" / "Ready to match" / etc. (next stage to run)
  - "N matches found" (match complete)
  - "N proposals generated" (propose complete)
- **Click action** → POST `/api/session/hydrate` with the slug, then navigate to `/session/{slug}`

### New researcher page (`src/app/new/page.tsx`)

Hosts the existing `ResearcherIntakeWizard` component. Form POSTs to `/api/session` as today. On success, redirects to `/session/{slug}`.

### API changes

**`GET /api/researchers`** — currently calls `listResearchersWithProfiles` which filters `enriched_profile IS NOT NULL`. Needs to return ALL researchers for the user (not just enriched ones), plus pipeline stage info.

Change `listResearchersWithProfiles` (or create new function) to:
- Remove the `enriched_profile IS NOT NULL` filter
- Select additional columns: `enriched_profile` (as boolean), `enriched_at`
- Return: `{ slug, name, hasProfile: boolean }`

Pipeline stage beyond "has profile" is filesystem-based and not available from DB alone. For the dashboard card labels, we derive status from what the DB knows:
- `enriched_profile` is null → "Getting started"
- `enriched_profile` is not null → "Profile complete"

This is sufficient for prototype. Richer status (match count, proposal count) can be added later by querying the `researcher_proposals` table or adding columns.

### File changes

| File | Change |
|------|--------|
| `src/app/page.tsx` | Replace with dashboard (empty state = wizard, populated = cards) |
| `src/app/new/page.tsx` | New — hosts `ResearcherIntakeWizard`, form handler, redirect |
| `src/lib/researcher-store.ts` | Update `listResearchersWithProfiles` to return all researchers + hasProfile |
| `src/app/api/researchers/route.ts` | No change (already calls the function with RLS client) |

### Not changed

- `src/components/ResearcherIntakeWizard.tsx` — reused as-is in both locations
- `src/app/session/[name]/page.tsx` — pipeline UI unchanged
- `src/app/api/session/hydrate/route.ts` — hydration logic unchanged
- `src/app/api/session/route.ts` — session creation unchanged

## Verification

1. Log in with no researchers → see intake wizard (empty state)
2. Create a researcher via wizard → lands on `/session/{slug}`
3. Navigate back to `/` → see dashboard with one card showing "Getting started" or "Profile complete"
4. Click the card → hydrates and navigates to session page at correct stage
5. Click "+ New researcher" → intake wizard on `/new`
6. Create second researcher → dashboard shows two cards
7. Sign out, sign in as different user → see only their own researchers
