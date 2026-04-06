# Profile & Enrich Cost Reduction — Pickup Context

> **Date:** 2026-04-04
> **Worktree:** `.worktrees/cost-reduction` (branch: `feat/cost-reduction`, based on `origin/main`)
> **PR merged just before this:** #23 (feat/researcher-intake → main, all researcher intake + Supabase storage)

---

## What We Are Doing and Why

Profile run costs ~$0.45 and enrich costs ~$0.55 per researcher — total ~$1.00.
Both use `claude-opus-4-6` (the most expensive model) via the Claude Agent SDK's `query()`.

We are implementing two changes to cut this by ~85%:

**Option A — Model swap for enrich:**
- Keep the agent SDK `query()` for the enrich route.
- Add `model: "claude-sonnet-4-6"` to the `query()` options.
- Reduce `maxTurns: 20` → `maxTurns: 12`.
- Confirmed: `Options` type in `@anthropic-ai/claude-agent-sdk` has `model?: string`.

**Option B — Bypass agent for profile:**
- Replace the `query()` agent call with a direct `anthropic.messages.create()` call.
- Read `intake.json` and CV text directly in the route (Node.js `fs` — no tool calls).
- Single Haiku 4.5 API call: `model: "claude-haiku-4-5-20251001"`, `max_tokens: 8192`.
- The model returns a JSON object with two keys: `profile` (ResearcherProfile) and `publications_md` (string).
- Route parses the response, writes `profile.json` and `publications.md`, syncs to Supabase.
- SSE result event emitted with cost calculated from token usage.

**User requirement:** Keep `publications` array and `prior_grants` array in profile.json — these must be available for grant matching.

---

## Estimated Costs After Changes

| Stage | Before | After |
|-------|--------|-------|
| Profile | ~$0.45 (Opus agent, ~5 turns) | ~$0.02–0.05 (Haiku, 1 API call) |
| Enrich | ~$0.55 (Opus agent, ~10 turns) | ~$0.10–0.15 (Sonnet agent, max 12 turns) |
| **Total** | **~$1.00** | **~$0.12–0.20** |

---

## Files to Change

| File | Change |
|------|--------|
| `src/app/api/session/[name]/profile/route.ts` | Full rewrite — bypass agent, direct Haiku API call |
| `src/app/api/session/[name]/enrich/route.ts` | Add `model: "claude-sonnet-4-6"`, change `maxTurns: 20` → `12` |
| `src/lib/prompts/profile-builder.ts` | Rewrite for embedded-data mode (no file path instructions) |
| `package.json` (root) | Add `"@anthropic-ai/sdk": "^0.74.0"` as explicit dependency |

---

## Key Technical Facts

### SDK `query()` options
Located in `sdk.d.ts` in `@anthropic-ai/claude-agent-sdk`. `model?: string` is in the `Options` type (line ~811+). Usage:
```typescript
query({
  prompt: `...`,
  options: {
    cwd: dataDir,
    systemPrompt: RESEARCHER_ENRICHER_PROMPT,
    allowedTools: ["Read", "Write", "Glob", "WebFetch", "WebSearch"],
    permissionMode: "acceptEdits",
    model: "claude-sonnet-4-6",   // ADD THIS
    maxTurns: 12,                 // CHANGE FROM 20
  },
})
```

### Direct Anthropic API call (for profile route)
`@anthropic-ai/sdk` version `0.74.0` is already installed as a transitive dep of the agent SDK.
Add it as an explicit dep in root `package.json` for clean imports.

```typescript
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic(); // picks up ANTHROPIC_API_KEY from env

const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 8192,
  system: PROFILE_BUILDER_PROMPT,
  messages: [{ role: "user", content: userPrompt }]
});
```

### Cost calculation for SSE result event (profile route)
Haiku 4.5 pricing: input $0.80/M tokens, output $4.00/M tokens.
```typescript
const cost =
  (response.usage.input_tokens / 1_000_000) * 0.80 +
  (response.usage.output_tokens / 1_000_000) * 4.00;
```
The SSE `result` event shape: `{ type: "result", turns: 1, cost, duration }`.

### Profile builder prompt changes
The current prompt says "Read intake data from: ${path}" and "Write outputs to: ${path}".
In the new non-agent mode, the model receives all data embedded in the user message.
The prompt must:
1. Remove all file I/O instructions (no "Read", "Write" steps).
2. Tell the model data is provided in the user message.
3. Tell the model to respond with JSON: `{ "profile": {...}, "publications_md": "..." }`.
4. Keep all extraction guidance (career_stage, research_keywords, publications, prior_grants, etc.).

### User message structure for profile call
```typescript
function buildProfilePrompt(name: string, intake: IntakeData | null, cvText: string | null): string {
  return `Build a researcher profile for "${name}".

## Intake Form Data
${intake ? JSON.stringify(intake, null, 2) : "No intake data provided."}

## CV Text
${cvText ?? "No CV uploaded."}

Respond with a JSON object (no markdown fences) with exactly two keys:
- "profile": the complete ResearcherProfile JSON following the schema in the system prompt
- "publications_md": the publications.md markdown string following the format in the system prompt

If both intake data and CV are available, treat intake fields as ground truth and use the CV only for publications, prior grants, and fields not in the intake.`;
}
```

### CV reading in route
```typescript
import { globSync } from "fs";  // Node 22+ has globSync, or use glob package
// OR use a simple manual check:
const cvExtensions = [".md", ".txt", ".pdf"];
let cvText: string | null = null;
for (const ext of cvExtensions) {
  const cvPath = resolve(researcherDir, `raw/cv${ext}`);
  if (existsSync(cvPath)) {
    if (ext === ".pdf") {
      cvText = "[PDF CV — extracted text not available in non-agent mode]";
    } else {
      cvText = readFileSync(cvPath, "utf-8");
    }
    break;
  }
}
```

### ResearcherProfile type (src/lib/types.ts)
Key fields that must appear in profile.json (for grant matching):
- `publications: Publication[]` — array with title, year, type, journal_or_publisher, themes
- `prior_grants: PriorGrant[]` — array with funder, scheme, amount_gbp, year, role, project_title
- `research_themes: string[]`
- `research_keywords: string[]`
- `key_strengths: string[]`
- `potential_gaps: string[]`

### Parsing JSON from Haiku response
The model may wrap its JSON in markdown code fences. Strip them:
```typescript
function parseProfileResponse(text: string): { profile: ResearcherProfile; publications_md: string } {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(cleaned);
}
```

---

## Existing Files — Reference Shapes

### Current profile route (src/app/api/session/[name]/profile/route.ts)
Uses `query()` from agent SDK. After rewrite, it should:
1. Read `intake.json` with `readFileSync` (already done for Supabase sync).
2. Find CV with `existsSync` loop over extensions.
3. Call `anthropic.messages.create()`.
4. Parse response.
5. Write `profile.json` and `publications.md` with `writeFileSync`.
6. Sync to Supabase via `updateResearcherProfile()`.
7. Stream SSE `result` event.

### Current enrich route (src/app/api/session/[name]/enrich/route.ts)
Only two changes needed:
1. `model: "claude-sonnet-4-6"` in options.
2. `maxTurns: 12` (was 20).

### SSE event format (src/lib/sse.ts)
```typescript
type SSEEvent =
  | { type: "tool"; name: string }
  | { type: "text"; text: string }
  | { type: "result"; turns: number; cost: number; duration: number }
  | { type: "error"; message: string };
```

---

## Workflow State

- [x] Merged PR #23 (researcher-intake → main)
- [x] Created worktree `.worktrees/cost-reduction` from `origin/main`
- [x] Tests passing (7/7)
- [x] Confirmed `model?: string` in agent SDK `Options` type
- [ ] Plan written
- [ ] Implementation
- [ ] Review + Simplify
- [ ] Commit & PR
- [ ] Finish Branch

---

## Implementation Order

1. Add `@anthropic-ai/sdk` to root `package.json` → run `npm install`
2. Rewrite `profile-builder.ts` prompt for embedded-data mode
3. Rewrite `profile/route.ts` — direct Haiku call
4. Update `enrich/route.ts` — add model + reduce maxTurns
5. Run `npm test --workspace=data-pipeline` — verify 7/7 still pass
6. Manual smoke test (optional): `npm run dev` + submit intake form

---

## To Continue in a New Session

1. `cd /home/finn/Developer/grant-researcher/.worktrees/cost-reduction`
2. Read this file.
3. Run `npm test --workspace=data-pipeline` to verify baseline still clean.
4. Start with Task 1 (add SDK dep to package.json).
