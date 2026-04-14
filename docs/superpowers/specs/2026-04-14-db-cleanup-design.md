# Database Cleanup & Schema Improvements

**Date:** 2026-04-14
**Status:** Draft

## Context

The researchers table has accumulated ~30 columns over several migrations. Some are dead (never read), some overlap with `enriched_profile` JSONB, and the slug uniqueness model doesn't account for multiple users sharing a name. The `funding_sources` table was created for a DB-first pipeline migration that was never completed.

## Changes

### 1. Drop dead columns from `researchers`

| Column | Reason |
|---|---|
| `email` | Never written, never read |
| `researcher_id` | Written on intake, never read back |
| `scopus_author_id` | Written on intake, never read back |

**Migration:** Single `ALTER TABLE researchers DROP COLUMN` for each.
**Code:** Remove from `upsertResearcher()` row object in `researcher-store.ts`. Remove from `IntakeData` type if present. Remove from `ResearcherRow` type in `db/src/types.ts`.

### 2. Drop `funding_sources` table

The table, store module, types, and tests exist but have zero consumers. The scan route still uses file-system persistence.

**Migration:** `DROP TABLE funding_sources`.
**Code:** Delete `src/lib/funding-source-store.ts`, its test file, and `FundingSourceRow` from `db/src/types.ts`.

### 3. Scope researcher slugs to user

**Problem:** `slugify("Jane Smith")` is deterministic — two users with the same name produce the same slug. The current `UNIQUE(slug)` constraint plus `upsert(..., { onConflict: "slug" })` means User B overwrites User A's data.

**Fix:**
- Change unique constraint from `(slug)` to `(user_id, slug)`
- Thread `userId` through all researcher store functions that look up by slug
- `upsertResearcher()` changes `onConflict` from `"slug"` to `"user_id,slug"`
- All `.eq("slug", slug)` queries add `.eq("user_id", userId)`
- API routes extract `userId` from `requireUser()` and pass it to store functions

**URL routing unchanged:** `/session/jane-smith` stays the same — the slug is unique within a user's researchers, and every route already calls `requireUser()` to get the authenticated user.

**Affected store functions:** `getResearcherFull`, `getResearcherBySlug`, `getPipelineState`, `updatePipelineState`, `updateResearcherProfile`, `updateProfileEmbedding`, `updatePublicationsMd`, `updateMatchResultsMd`, `updateScholarCandidate`, `updateOrcidData`, `listResearchersWithProfiles`.

### 4. Persist `proposal_intent` as a column

**Problem:** `proposal_intent` is stored ephemerally in `pipeline_state` JSONB and cleared after matching. Users lose their research focus description on each pipeline run.

**Fix:**
- Add `proposal_intent jsonb` column to `researchers`
- On intake (session creation + intake PATCH): write `proposal_intent` to the new column instead of `pipeline_state`
- Remove `proposal_intent: null` clearing from the match route
- Profile and match routes read from `researcher.proposal_intent` column instead of `pipeline_state.proposal_intent`
- Remove `proposal_intent` from `stripEphemeralFields` since it now has a home
- Update `ResearcherRow` type

## Tables kept as-is

| Table | Reason |
|---|---|
| `awarded_grants` | Kept for future use (enriching match context, analytics) |
| `grant_classifications` | Dependent on `awarded_grants` |
| `ingestion_runs` | Active pipeline audit log |
| Remaining `researchers` columns | User sees potential future use when features are built |

## Verification

1. Run `npm run db:push -w db` to apply migration
2. Run `npm run test:all` — all tests pass
3. Create two accounts, create researchers with the same name on each — no collision
4. Run pipeline with proposal_intent, verify it survives after matching
5. Verify existing researchers still load correctly (migration is additive for slug change, since all existing researchers already have unique slugs)
