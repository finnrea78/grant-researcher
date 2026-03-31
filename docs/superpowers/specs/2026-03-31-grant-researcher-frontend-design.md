# Grant Researcher Frontend — Design Spec

## Context

`core/` is a working TypeScript CLI package that runs a four-stage grant discovery pipeline using the Claude Agent SDK. This spec covers the Next.js frontend (`grant-researcher/`) that wraps that pipeline in a browser UI, plus one enhancement to the `core` scan command.

## Decisions

- **Framework:** Next.js 14+ with App Router, TypeScript
- **Location:** `grant-researcher/` as a sibling to `core/` in the monorepo
- **State:** File-based only — no database. Stage completion determined by file existence.
- **Streaming:** SSE (Server-Sent Events) from Next.js API routes. Each Claude tool call appears in the UI log in real time.
- **Scan enhancement:** Smart scan uses WebSearch to discover field-specific grant URLs based on the researcher's profile. Funder files are tagged with `disciplines:` field.
- **Propose trigger:** User picks from the rendered match list. Clicking a match runs propose for that funder + scheme.

## Monorepo Structure

```
grant-scout-v2/
├── package.json           ← npm workspace root
├── core/                  ← existing CLI package (no changes except scan enhancement)
└── grant-researcher/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    └── src/
        ├── app/
        │   ├── page.tsx                              ← Screen 1: CV upload
        │   ├── session/
        │   │   └── [name]/
        │   │       └── page.tsx                      ← Screen 2: pipeline view
        │   └── api/
        │       ├── session/
        │       │   └── route.ts                      ← POST: create session, save CV
        │       └── session/[name]/
        │           ├── profile/route.ts              ← POST: run profile (SSE)
        │           ├── scan/route.ts                 ← POST: run scan (SSE)
        │           ├── match/route.ts                ← POST: run match (SSE)
        │           ├── matches/route.ts              ← GET: parse matches.md → JSON
        │           └── propose/route.ts              ← POST: run propose (SSE)
        ├── components/
        │   ├── CVDropZone.tsx
        │   ├── PipelineBar.tsx
        │   ├── StageLog.tsx
        │   ├── MatchList.tsx
        │   └── ProposalViewer.tsx
        └── lib/
            ├── sse.ts            ← pipe query() messages → ReadableStream SSE
            └── parseMatches.ts   ← parse matches.md text → Match[] array
```

## Screen 1 — CV Upload

Route: `/`

- CV file drop zone accepting `.md`, `.pdf`, `.txt`
- Researcher name input field (used as folder slug, e.g. `will-rea`)
- Start button → `POST /api/session` → redirects to `/session/<name>`

The API route saves the CV file to `core/data/researchers/<name>/raw/cv.<ext>`.

The researcher name input is sanitized to a slug on submission: lowercased, spaces replaced with hyphens, non-alphanumeric characters stripped (e.g. `"Dr. Will Rea"` → `"dr-will-rea"`). The slug is used as the folder name and URL segment.

## Screen 2 — Pipeline Session

Route: `/session/[name]`

On load, checks file existence to determine which stages are already complete:

| Stage | Complete when |
|-------|--------------|
| Profile | `core/data/researchers/<name>/profile.json` exists |
| Scan | `core/data/funding-sources/_last-harvested.json` updated within 7 days |
| Match | `core/data/outputs/<name>/matches.md` exists |
| Propose | Any file in `core/data/outputs/<name>/proposals/` exists |

### PipelineBar

Four stages in a horizontal row: Profile → Scan → Match → Propose.

- **Pending:** grey, locked
- **Ready:** blue border, shows a "Run" button
- **Running:** blue with animated pulse indicator
- **Complete:** green with checkmark

Stages unlock sequentially. A stage's "Run" button only appears after the previous stage completes.

### StageLog

Scrolling terminal-style output area below the pipeline bar. Displays messages streamed via SSE as Claude works:

- Tool calls: `[WebSearch]`, `[WebFetch]`, `[Read]`, `[Write]` in blue
- Assistant text in grey
- Completion summary (turns, cost, duration) in green

The log is shared across all stages. New output appends at the bottom.

### MatchList

Appears after Match stage completes. Populated by `GET /api/session/<name>/matches` which parses `matches.md` into structured data.

Renders two sections:
- **Tier 1 — Strong Matches (7.0+):** each row shows scheme name, funder, amount, deadline, and score badge. Clickable — clicking triggers Propose.
- **Tier 2 — Worth Exploring (4.0–6.9):** same format, dimmer styling.

Clicking a match sends `POST /api/session/<name>/propose` with `{ funder, scheme }` and streams SSE output to the StageLog.

### ProposalViewer

After Propose completes, renders the generated `.md` file as HTML below the match list. If the user proposes for multiple schemes in one session, all generated proposal files are listed as tabs (one per scheme). The most recently generated proposal is shown by default.

## Streaming Architecture

Every command API route returns a `ReadableStream` formatted as SSE:

```
POST /api/session/<name>/profile
→ Content-Type: text/event-stream
→ data: {"type":"tool","name":"Read"}\n\n
→ data: {"type":"text","text":"Reading CV..."}\n\n
→ data: {"type":"result","turns":8,"cost":0.031,"duration":47300}\n\n
```

The frontend connects with `fetch()` and reads the stream with a `ReadableStreamDefaultReader`. Each event updates the StageLog and, on `type: "result"`, marks the stage complete.

`grant-researcher/src/lib/sse.ts` exports `pipeQueryToSSE(messages, controller)` — takes the `query()` async iterator and a `ReadableStreamDefaultController`, formats each `SDKMessage` as an SSE event.

**Path resolution:** API routes resolve `core/data/` using `path.resolve(process.cwd(), 'core/data')`. The dev server must be started from the monorepo root (`grant-scout-v2/`) for this to work. The `package.json` dev script enforces this.

## Core Enhancement — Smart Scan

`core/src/commands/scan.ts` gains an optional `name` parameter:

```typescript
export async function scanCommand(options: ScanOptions = {}, name?: string): Promise<void>
```

When `name` is provided:
1. Reads `data/researchers/<name>/profile.json`
2. Extracts `disciplinary_fields`, `research_themes`, `geographic_focus`
3. Passes these to the scan task prompt
4. Adds `WebSearch` to `allowedTools`

`core/src/prompts/grant-scanner.ts` gains instructions for when a researcher profile is provided:
- Use `WebSearch` to find grant URLs relevant to the researcher's field before fetching
- Tag every written funder file with a `disciplines: [...]` field listing which research fields it covers
- Use the existing `_urls.md` as a seed list, not the complete list

The CLI `grant-scout scan` gains an optional `[name]` argument:

```
grant-scout scan [name] [--check] [--force]
```

## Dependencies

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "@types/node": "^22",
    "@types/react": "^18",
    "@types/react-dom": "^18"
  }
}
```

`core` is referenced as a local workspace package — no publishing required.

## npm Workspace Root

`grant-scout-v2/package.json`:

```json
{
  "name": "grant-scout-v2",
  "private": true,
  "workspaces": ["core", "grant-researcher"]
}
```

## File-Based State Rules

- Stages check file existence on every page load.
- A researcher can close and reopen the browser. Their pipeline state is fully recoverable from the file system.
- Re-running a stage overwrites its output file. This resets all downstream stages (their output files become stale but are not deleted — they remain readable).
- There is no "reset" button in this version. Users delete output files manually if they want to re-run from scratch.

## Hard Constraints (carried from core)

1. Match stage API route must never include `WebFetch` or `WebSearch` in its `allowedTools`.
2. Scan uses `WebSearch` only when a researcher profile is provided. Without a profile, it falls back to `_urls.md` only.
3. Never render hallucinated funding data. If a stage errors, show the error in the StageLog. Do not fabricate output.

## Verification

1. `npm install` at root installs all workspaces
2. `cd grant-researcher && npm run dev` starts dev server
3. Drop a CV → enter name → hit Start → lands on session page
4. Run Profile → log shows Read/Write tool calls → profile.json created
5. Run Scan (with researcher name) → log shows WebSearch calls for their field → funder files created with `disciplines:` tags
6. Run Match → log shows no WebFetch/WebSearch → matches.md created
7. Click a Tier 1 match → Propose runs → proposal doc appears below
8. Refresh page → all completed stages shown as green (recovered from file system)
