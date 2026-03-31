# Grant Scout Core -- TypeScript Agent SDK Design

## Context

The user built a grant discovery tool (`funding_finder`) using a markdown-driven agent architecture where Claude Code is the runtime. Agents and commands are `.md` files that Claude reads and follows. The system works well but has no programmatic interface.

This design ports that architecture to TypeScript using the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). Each markdown agent becomes a system prompt. Each command becomes a CLI subcommand that calls `query()`. The goal is a standalone TypeScript CLI package that can later be imported by a Next.js frontend.

## Decisions

- **Runtime:** Claude Agent SDK (spawns Claude Code subprocesses)
- **Location:** `grant-scout-v2/core/` as a standalone package
- **Storage:** File-based (JSON + markdown), same structure as `funding_finder`
- **Interface:** CLI with subcommands (`npx grant-scout profile will-rea`)
- **Orchestration:** Thin -- TypeScript handles CLI parsing and file paths only; Claude does all reasoning and file I/O
- **Web fetching:** Delegated entirely to Claude via the `WebFetch` tool

## Project Structure

```
grant-scout-v2/
├── core/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── cli.ts                 ← CLI entry point (commander-based)
│   │   ├── commands/
│   │   │   ├── profile.ts
│   │   │   ├── scan.ts
│   │   │   ├── match.ts
│   │   │   └── propose.ts
│   │   ├── prompts/
│   │   │   ├── profile-builder.ts
│   │   │   ├── grant-scanner.ts
│   │   │   ├── matcher.ts
│   │   │   └── proposal-outliner.ts
│   │   └── types.ts               ← TypeScript types for ResearcherProfile, FundingSource, etc.
│   └── data/                      ← Copied from funding_finder (same structure)
│       ├── researchers/
│       │   └── will-rea/
│       │       ├── raw/cv.md
│       │       ├── profile.json
│       │       └── publications.md
│       ├── funding-sources/
│       │   ├── _template.md
│       │   ├── _urls.md
│       │   ├── _last-harvested.json
│       │   └── *.md (one per funder)
│       └── outputs/
│           └── <name>/
│               ├── matches.md
│               └── proposals/*.md
└── grant-scout/                   ← Existing Next.js app (untouched)
```

## Command Pattern

Every command follows this pattern:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { AGENT_PROMPT } from "../prompts/agent-name.js";

export async function commandName(args: CommandArgs) {
  const dataDir = resolve(process.cwd(), "data");

  for await (const message of query({
    prompt: `<task-specific prompt with concrete file paths>`,
    options: {
      cwd: dataDir,
      systemPrompt: AGENT_PROMPT,
      allowedTools: ["Read", "Write", "Glob"],  // varies per command
      permissionMode: "acceptEdits",
      maxTurns: 20,
    },
  })) {
    if ("result" in message) {
      console.log(message.result);
    }
  }
}
```

## Commands

### `grant-scout profile [name]`

- **Agent prompt:** Ported from `funding_finder/agents/profile-builder.md`
- **Allowed tools:** Read, Write, Glob
- **Input:** `data/researchers/<name>/raw/cv.md`
- **Output:** `data/researchers/<name>/profile.json`, `data/researchers/<name>/publications.md`
- **Default name:** `will-rea`

### `grant-scout scan [--check | --force]`

- **Agent prompt:** Ported from `funding_finder/agents/grant-scanner.md`
- **Allowed tools:** Read, Write, Glob, WebFetch
- **Input:** `data/funding-sources/_urls.md`, `data/funding-sources/_last-harvested.json`
- **Output:** Updated `data/funding-sources/*.md` files and `_last-harvested.json`
- **Modes:** HARVEST (default), CHECK (--check), FORCE (--force)

### `grant-scout match [name]`

- **Agent prompt:** Ported from `funding_finder/agents/matcher.md`
- **Allowed tools:** Read, Write, Glob (NO web access -- hard constraint)
- **Input:** `data/researchers/<name>/profile.json`, all `data/funding-sources/*.md`
- **Output:** `data/outputs/<name>/matches.md`
- **Default name:** `will-rea`

### `grant-scout propose [name] <funder> <scheme>`

- **Agent prompt:** Ported from `funding_finder/agents/proposal-outliner.md`
- **Allowed tools:** Read, Write, Glob
- **Input:** `data/researchers/<name>/profile.json`, `data/funding-sources/<funder>.md`
- **Output:** `data/outputs/<name>/proposals/<funder>-<scheme-slug>.md`
- **Default name:** `will-rea`

## Prompt Files

Each file in `src/prompts/` exports a single string constant. The content is ported directly from the corresponding `funding_finder/agents/*.md` file, with adjustments:

- Remove markdown headers like `# Agent: Profile Builder` (not needed in a system prompt)
- Replace references to `researchers/<name>/` with `{dataDir}/researchers/{name}/` (interpolated at call time via the task prompt, not the system prompt)
- Keep all instructions, schemas, constraints, and output formats verbatim

## Types (src/types.ts)

TypeScript interfaces matching the existing JSON schemas:

- `ResearcherProfile` -- matches `profile.json` structure
- `Publication`, `PriorGrant`, `PhDSupervision` -- nested types
- `HarvestTimestamps` -- matches `_last-harvested.json`

These types are for documentation and future Next.js integration. The thin orchestrator does not validate agent output against them.

## Dependencies

- `@anthropic-ai/claude-agent-sdk` -- agent runtime
- `commander` -- CLI argument parsing
- `typescript` -- dev dependency
- `@types/node` -- dev dependency

## CLI Entry Point (src/cli.ts)

Uses `commander` to define subcommands:

```
grant-scout profile [name]
grant-scout scan [--check] [--force]
grant-scout match [name]
grant-scout propose [name] <funder> <scheme>
```

The `bin` field in `package.json` points to the compiled `cli.js`.

## Hard Constraints (carried from funding_finder)

1. `match` command must NEVER make web calls (enforced via `allowedTools`)
2. `scan` command uses WebFetch on known URLs only (enforced via system prompt)
3. Never hallucinate funding data (enforced via system prompt)
4. All outputs follow their templates (enforced via system prompt)
5. Eligibility checked before scoring (enforced via system prompt)

## Data Migration

Copy these directories from `funding_finder` into `core/data/`:
- `researchers/` (including `will-rea/`)
- `funding-sources/` (all funder files, template, URLs, timestamps)
- `outputs/` (existing matches and proposals)

No format changes needed. The data is identical.

## Verification

1. **Build:** `cd core && npm run build` -- should compile without errors
2. **Profile:** `npx grant-scout profile will-rea` -- should read CV and write profile.json + publications.md
3. **Scan:** `npx grant-scout scan --check` -- should fetch stale URLs and update funder files
4. **Match:** `npx grant-scout match will-rea` -- should produce matches.md with tiered scores
5. **Propose:** `npx grant-scout propose will-rea leverhulme "Research Fellowship"` -- should produce a proposal alignment doc
6. **Constraint check:** `match` must not trigger any WebFetch calls (verify via agent output)

## Files to Create

1. `core/package.json`
2. `core/tsconfig.json`
3. `core/src/cli.ts`
4. `core/src/types.ts`
5. `core/src/commands/profile.ts`
6. `core/src/commands/scan.ts`
7. `core/src/commands/match.ts`
8. `core/src/commands/propose.ts`
9. `core/src/prompts/profile-builder.ts`
10. `core/src/prompts/grant-scanner.ts`
11. `core/src/prompts/matcher.ts`
12. `core/src/prompts/proposal-outliner.ts`

## Existing Files to Reuse

- `funding_finder/agents/profile-builder.md` -- port to `src/prompts/profile-builder.ts`
- `funding_finder/agents/grant-scanner.md` -- port to `src/prompts/grant-scanner.ts`
- `funding_finder/agents/matcher.md` -- port to `src/prompts/matcher.ts`
- `funding_finder/agents/proposal-outliner.md` -- port to `src/prompts/proposal-outliner.ts`
- `funding_finder/funding-sources/_template.md` -- copy to `core/data/funding-sources/`
- `funding_finder/funding-sources/_urls.md` -- copy to `core/data/funding-sources/`
- `funding_finder/researchers/will-rea/` -- copy to `core/data/researchers/`
- All `funding_finder/funding-sources/*.md` -- copy to `core/data/funding-sources/`
- All `funding_finder/outputs/` -- copy to `core/data/outputs/`
