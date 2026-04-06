# Proposal Intent Step — Design Spec

**Date:** 2026-04-06
**Status:** Draft

## Problem

Researchers need to describe the project they want to propose so the matching pipeline can score funding opportunities against their specific intent — not just their general profile. However, proposal descriptions are sensitive IP (unpublished research direction) and should not be persisted long-term alongside the relatively benign CV/ORCID data.

## Solution

Add a structured "Proposal" step (new step 4) to the intake wizard, with an ephemeral file lifecycle that keeps proposal data available during the pipeline run but cleans it up after matching completes.

## Data Model

New interface in `src/lib/types.ts`:

```typescript
interface ProposalIntent {
  project_title?: string;
  description?: string;
  target_discipline?: string;
  methodology?: string;
}
```

Added to `IntakeData` as `proposal_intent?: ProposalIntent`. All fields optional.

**Not added** to `ResearcherProfile` — the profile-builder agent extracts relevant bits into existing fields (`current_projects`, `key_strengths`).

## Wizard Step

- **Position:** New step 4 (after Research), bumps TOTAL_STEPS 7 → 8
- **Title:** "Project Proposal"
- **Fields:** project_title (text input), description (textarea ~500 words), target_discipline (text input), methodology (textarea)
- **All optional**, step is skippable (same pattern as steps 1, 3-7)
- **No Supabase sync** — `proposal_intent` stripped before `upsertResearcher()`

## Ephemeral File Lifecycle

1. **Write:** `POST /api/session` writes `data/researchers/{slug}/proposal-intent.json` (separate from `intake.json`)
2. **Read:** Profile-builder and matcher agents read it as optional additional context
3. **Delete:** Match route cleans up `proposal-intent.json` after `pipeQueryToSSE` resolves (wrapped in try/finally)
4. **Strip:** `proposal_intent` removed from intake before Supabase upsert via `stripEphemeralFields()`

## Agent Integration

- **Profile-builder:** Optional input — informs `current_projects`, `research_themes`, `key_strengths`
- **Matcher:** Sharpens Dimension 2 (Thematic Alignment) and Dimension 4 (Strategic Fit) scoring
- **No changes** to enricher, scanner, or proposal-outliner

## Files Modified

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `ProposalIntent`, update `IntakeData` |
| `src/lib/stripEphemeral.ts` | New — strips `proposal_intent` from intake |
| `src/lib/proposalIntent.ts` | New — `writeProposalIntent()`, `cleanupProposalIntent()` |
| `src/components/ResearcherIntakeWizard.tsx` | New step 4, TOTAL_STEPS 7→8, renumber steps |
| `src/app/api/session/route.ts` | Write proposal file, strip before Supabase |
| `src/app/api/session/[name]/match/route.ts` | Cleanup proposal file after matching |
| `src/lib/prompts/profile-builder.ts` | Mention proposal-intent.json |
| `src/lib/prompts/matcher.ts` | Mention proposal-intent.json |

## Privacy Design

- Proposal text never reaches Supabase
- Written to isolated file (not embedded in intake.json on disk)
- Deleted after matching completes
- On Railway/AWS, container filesystem is already ephemeral
- Only the derived insights (in profile.json fields) persist
