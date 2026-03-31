# Grant Researcher Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js frontend (`grant-researcher/`) that wraps the `core/` CLI pipeline in a browser UI — CV upload → profile → smart scan → match → propose — with live SSE streaming.

**Architecture:** npm monorepo (`grant-scout-v2/`) with two workspace packages: `core` (existing CLI) and `grant-researcher` (new Next.js app). API routes in `grant-researcher` import `query()` from the Claude Agent SDK directly and import prompt strings from `core` via package exports. Long-running commands stream SSE to the browser so the user sees live tool call output.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, `@anthropic-ai/claude-agent-sdk`, npm workspaces

---

## File Map

| File | Responsibility |
|------|---------------|
| `grant-scout-v2/package.json` | npm workspace root — declares `["core", "grant-researcher"]` |
| `core/package.json` | Add `exports` field so prompts are importable as `grant-scout/prompts/*` |
| `core/src/commands/scan.ts` | Add optional `name` param; include WebSearch when profile exists |
| `core/src/prompts/grant-scanner.ts` | Add smart-scan instructions (WebSearch, disciplines tagging) |
| `core/src/cli.ts` | Update scan subcommand to accept optional `[name]` argument |
| `grant-researcher/package.json` | Next.js app dependencies; references `grant-scout` workspace |
| `grant-researcher/tsconfig.json` | Strict ESM TypeScript for Next.js |
| `grant-researcher/next.config.ts` | Minimal Next.js config |
| `grant-researcher/src/lib/slugify.ts` | `slugify(name): string` — sanitise researcher name to folder slug |
| `grant-researcher/src/lib/parseMatches.ts` | `parseMatches(text): Match[]` — parse matches.md into typed array |
| `grant-researcher/src/lib/sse.ts` | `pipeQueryToSSE(messages, controller)` — stream SDKMessages as SSE |
| `grant-researcher/src/app/api/session/route.ts` | `POST` — save uploaded CV, create researcher folder |
| `grant-researcher/src/app/api/session/[name]/status/route.ts` | `GET` — check which stages are complete via file existence |
| `grant-researcher/src/app/api/session/[name]/profile/route.ts` | `POST` — run profile command, return SSE stream |
| `grant-researcher/src/app/api/session/[name]/scan/route.ts` | `POST` — run smart scan, return SSE stream |
| `grant-researcher/src/app/api/session/[name]/match/route.ts` | `POST` — run match command (no WebFetch/WebSearch), return SSE stream |
| `grant-researcher/src/app/api/session/[name]/matches/route.ts` | `GET` — parse matches.md and return `Match[]` as JSON |
| `grant-researcher/src/app/api/session/[name]/propose/route.ts` | `POST {funder, scheme}` — run propose, return SSE stream |
| `grant-researcher/src/components/CVDropZone.tsx` | File drop + name input |
| `grant-researcher/src/components/PipelineBar.tsx` | Horizontal stage tracker (idle/running/complete/error) |
| `grant-researcher/src/components/StageLog.tsx` | Scrolling terminal-style SSE output log |
| `grant-researcher/src/components/MatchList.tsx` | Clickable match rows grouped by tier |
| `grant-researcher/src/components/ProposalViewer.tsx` | Renders generated `.md` proposal files as `<pre>` blocks with tabs |
| `grant-researcher/src/app/page.tsx` | Screen 1: CV upload landing |
| `grant-researcher/src/app/session/[name]/page.tsx` | Screen 2: pipeline session view |

---

## Task 1: Add core package exports

**Files:**
- Modify: `core/package.json`

- [ ] **Step 1: Add exports field to core/package.json**

Replace the contents of `core/package.json` with:

```json
{
  "name": "grant-scout",
  "version": "0.1.0",
  "description": "AI-powered grant discovery CLI for UK researchers",
  "type": "module",
  "bin": {
    "grant-scout": "./dist/cli.js"
  },
  "exports": {
    "./prompts/profile-builder": "./dist/prompts/profile-builder.js",
    "./prompts/grant-scanner": "./dist/prompts/grant-scanner.js",
    "./prompts/matcher": "./dist/prompts/matcher.js",
    "./prompts/proposal-outliner": "./dist/prompts/proposal-outliner.js",
    "./types": "./dist/types.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.87",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Rebuild core to ensure dist is fresh**

```bash
cd core && npm run build
```

Expected: no errors, `dist/` files updated.

- [ ] **Step 3: Commit**

```bash
cd ..
git add core/package.json
git commit -m "feat(core): add package exports for prompts"
```

---

## Task 2: Set up npm workspace root

**Files:**
- Create: `grant-scout-v2/package.json`

- [ ] **Step 1: Create workspace root package.json**

Create `grant-scout-v2/package.json`:

```json
{
  "name": "grant-scout-v2",
  "private": true,
  "workspaces": ["core", "grant-researcher"]
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add npm workspace root"
```

---

## Task 3: Scaffold grant-researcher package

**Files:**
- Create: `grant-researcher/package.json`
- Create: `grant-researcher/tsconfig.json`
- Create: `grant-researcher/next.config.ts`

- [ ] **Step 1: Create grant-researcher/package.json**

```json
{
  "name": "grant-researcher",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.87",
    "grant-scout": "*",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0"
  }
}
```

- [ ] **Step 2: Create grant-researcher/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create grant-researcher/next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow long-running SSE responses (no timeout)
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create Tailwind config files**

Create `grant-researcher/tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

Create `grant-researcher/postcss.config.mjs`:

```javascript
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};

export default config;
```

- [ ] **Step 5: Create src/app/globals.css**

```bash
mkdir -p grant-researcher/src/app
```

Create `grant-researcher/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Install dependencies from workspace root**

```bash
cd grant-scout-v2
npm install
```

Expected: `node_modules/` created at root. `grant-researcher/node_modules/` symlinks `grant-scout` to `../core`.

- [ ] **Step 7: Commit**

```bash
git add grant-researcher/
git commit -m "feat(grant-researcher): scaffold Next.js package"
```

---

## Task 4: lib/slugify.ts

**Files:**
- Create: `grant-researcher/src/lib/slugify.ts`
- Create: `grant-researcher/src/lib/__tests__/slugify.test.ts`

- [ ] **Step 1: Write the test**

Create `grant-researcher/src/lib/__tests__/slugify.test.ts`:

```typescript
import { slugify } from "../slugify";

describe("slugify", () => {
  it("lowercases the name", () => {
    expect(slugify("Will Rea")).toBe("will-rea");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("Dr Will Rea")).toBe("dr-will-rea");
  });

  it("strips title punctuation", () => {
    expect(slugify("Dr. Will Rea")).toBe("dr-will-rea");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("Prof.  Jane Smith")).toBe("prof-jane-smith");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  Will  ")).toBe("will");
  });

  it("handles already-slugged input", () => {
    expect(slugify("will-rea")).toBe("will-rea");
  });
});
```

- [ ] **Step 2: Add jest config to grant-researcher/package.json**

Add to the `package.json` created in Task 3 (merge into existing devDependencies and add jest config):

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1"
    }
  }
}
```

Run `npm install` from the workspace root to pick up new devDependencies:

```bash
cd grant-scout-v2 && npm install
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd grant-researcher && npx jest src/lib/__tests__/slugify.test.ts
```

Expected: `FAIL — Cannot find module '../slugify'`

- [ ] **Step 4: Implement slugify**

Create `grant-researcher/src/lib/slugify.ts`:

```typescript
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest src/lib/__tests__/slugify.test.ts
```

Expected: `PASS — 6 tests`

- [ ] **Step 6: Commit**

```bash
git add grant-researcher/src/lib/slugify.ts grant-researcher/src/lib/__tests__/slugify.test.ts grant-researcher/package.json
git commit -m "feat(grant-researcher): add slugify utility"
```

---

## Task 5: lib/parseMatches.ts

**Files:**
- Create: `grant-researcher/src/lib/parseMatches.ts`
- Create: `grant-researcher/src/lib/__tests__/parseMatches.test.ts`

- [ ] **Step 1: Write the test**

Create `grant-researcher/src/lib/__tests__/parseMatches.test.ts`:

```typescript
import { parseMatches } from "../parseMatches";

const SAMPLE_MATCHES = `
# Grant Matches for Dr. Will Rea

> Generated: 2026-03-31

## Tier 1: Strong Matches (score 7.0+)

### 1. Research Fellowship — Leverhulme Trust
- **Overall score:** 8.4/10
- **Amount:** £30,000–£100,000 | **Deadline:** rolling | **Status:** open
- **Why this matches:**
  - Strong thematic alignment.

### 2. Small Research Grant — British Academy
- **Overall score:** 7.9/10
- **Amount:** up to £10,000 | **Deadline:** 2026-10-01 | **Status:** open

## Tier 2: Worth Exploring (score 4.0–6.9)

### 3. Scholars Program — Getty Foundation
- **Overall score:** 5.2/10
- **Amount:** residential | **Deadline:** 2026-11-15 | **Status:** open
`.trim();

describe("parseMatches", () => {
  it("returns a Match array", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(Array.isArray(matches)).toBe(true);
  });

  it("parses correct number of matches", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches).toHaveLength(3);
  });

  it("extracts scheme and funder", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches[0].scheme).toBe("Research Fellowship");
    expect(matches[0].funder).toBe("Leverhulme Trust");
  });

  it("extracts score as number", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches[0].score).toBe(8.4);
  });

  it("extracts tier", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches[0].tier).toBe(1);
    expect(matches[2].tier).toBe(2);
  });

  it("extracts amount and deadline", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches[0].amount).toBe("£30,000–£100,000");
    expect(matches[0].deadline).toBe("rolling");
  });

  it("returns empty array for empty input", () => {
    expect(parseMatches("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/lib/__tests__/parseMatches.test.ts
```

Expected: `FAIL — Cannot find module '../parseMatches'`

- [ ] **Step 3: Implement parseMatches**

Create `grant-researcher/src/lib/parseMatches.ts`:

```typescript
export interface Match {
  scheme: string;
  funder: string;
  score: number;
  amount: string;
  deadline: string;
  tier: 1 | 2 | 3;
}

export function parseMatches(text: string): Match[] {
  if (!text.trim()) return [];

  const matches: Match[] = [];
  let currentTier: 1 | 2 | 3 = 1;

  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect tier changes
    if (/^## Tier 1/.test(line)) { currentTier = 1; continue; }
    if (/^## Tier 2/.test(line)) { currentTier = 2; continue; }
    if (/^## Tier 3/.test(line)) { currentTier = 3; continue; }

    // Match entry heading: ### N. Scheme Name — Funder Name
    const headingMatch = line.match(/^### \d+\.\s+(.+?)\s+—\s+(.+)$/);
    if (!headingMatch) continue;

    const scheme = headingMatch[1].trim();
    const funder = headingMatch[2].trim();

    // Scan following lines for score/amount/deadline (within next 10 lines)
    let score = 0;
    let amount = "";
    let deadline = "";

    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const detail = lines[j];

      const scoreMatch = detail.match(/\*\*Overall score:\*\*\s*([\d.]+)\/10/);
      if (scoreMatch) score = parseFloat(scoreMatch[1]);

      const amountMatch = detail.match(/\*\*Amount:\*\*\s*([^|]+)/);
      if (amountMatch) amount = amountMatch[1].trim();

      const deadlineMatch = detail.match(/\*\*Deadline:\*\*\s*([^|]+)/);
      if (deadlineMatch) deadline = deadlineMatch[1].trim();

      // Stop at next heading
      if (/^###/.test(detail) && j !== i + 1) break;
    }

    matches.push({ scheme, funder, score, amount, deadline, tier: currentTier });
  }

  return matches;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/lib/__tests__/parseMatches.test.ts
```

Expected: `PASS — 7 tests`

- [ ] **Step 5: Commit**

```bash
git add grant-researcher/src/lib/parseMatches.ts grant-researcher/src/lib/__tests__/parseMatches.test.ts
git commit -m "feat(grant-researcher): add parseMatches utility"
```

---

## Task 6: lib/sse.ts

**Files:**
- Create: `grant-researcher/src/lib/sse.ts`

- [ ] **Step 1: Create lib/sse.ts**

Create `grant-researcher/src/lib/sse.ts`:

```typescript
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type SSEEvent =
  | { type: "tool"; name: string }
  | { type: "text"; text: string }
  | { type: "result"; turns: number; cost: number; duration: number }
  | { type: "error"; message: string };

export function formatSSEEvent(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function pipeQueryToSSE(
  messages: AsyncIterable<SDKMessage>,
  controller: ReadableStreamDefaultController<string>
): Promise<void> {
  try {
    for await (const message of messages) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            controller.enqueue(formatSSEEvent({ type: "tool", name: block.name }));
          } else if (block.type === "text" && block.text.trim()) {
            controller.enqueue(formatSSEEvent({ type: "text", text: block.text.trim() }));
          }
        }
      } else if (message.type === "result") {
        if (message.is_error) {
          const msg = "errors" in message ? message.errors.join("; ") : "Unknown error";
          controller.enqueue(formatSSEEvent({ type: "error", message: msg }));
        } else if ("result" in message) {
          controller.enqueue(
            formatSSEEvent({
              type: "result",
              turns: message.num_turns,
              cost: message.total_cost_usd,
              duration: message.duration_ms,
            })
          );
        }
      }
    }
  } finally {
    controller.close();
  }
}

export function sseResponse(stream: ReadableStream<string>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify formatSSEEvent manually**

```bash
node -e "
import('./src/lib/sse.js').then(m => {
  console.log(JSON.stringify(m.formatSSEEvent({ type: 'tool', name: 'Read' })));
});
"
```

Expected output (as a JSON string): `"data: {\"type\":\"tool\",\"name\":\"Read\"}\\n\\n"`

- [ ] **Step 3: Commit**

```bash
git add grant-researcher/src/lib/sse.ts
git commit -m "feat(grant-researcher): add SSE streaming helper"
```

---

## Task 7: Core scan enhancement

**Files:**
- Modify: `core/src/prompts/grant-scanner.ts`
- Modify: `core/src/commands/scan.ts`
- Modify: `core/src/cli.ts`

- [ ] **Step 1: Add smart scan instructions to grant-scanner.ts**

Open `core/src/prompts/grant-scanner.ts`. Find the line `export const GRANT_SCANNER_PROMPT = \``. Replace the opening of the file with the version below — this inserts a new section after `## Modes` and before `## Instructions`:

```typescript
export const GRANT_SCANNER_PROMPT = `
Harvest funding data and write structured markdown files for each funder.

## Modes

### HARVEST mode (default)

Full harvest of all sources. Run this infrequently (monthly or when adding new sources).

### CHECK mode (--check flag)

Lightweight. Only re-fetches sources where _last-harvested.json shows more than 7 days since last harvest. Skip sources that are still fresh.

### FORCE mode (--force flag)

Ignore all timestamps. Re-harvest every source regardless of age.

---

## Smart Scan (when researcher profile is provided)

When a researcher profile is provided in the task prompt, perform a smart scan:

1. Read the researcher's disciplinary fields, research themes, and geographic focus from the provided profile data.
2. Use **WebSearch** to discover grant funding URLs relevant to those specific fields. Search queries should be targeted, for example:
   - "[discipline] research grants UK 2026"
   - "[funder type] funding [research theme]"
   - "[geographic focus] studies fellowship"
3. Combine discovered URLs with the seed list from \`funding-sources/_urls.md\`.
4. Harvest all URLs (discovered + seed) using **WebFetch**.
5. When writing each funder file, add a \`disciplines:\` field listing which research fields this funder covers (e.g. \`disciplines: art-history, african-studies, museum-studies\`).

If no researcher profile is provided, fall back to harvesting the seed URL list only (no WebSearch).

---

## Instructions

### Step 1: Determine Mode

Read which flag was passed via the task prompt:
- No flag → HARVEST mode
- --check → CHECK mode
- --force → FORCE mode

### Step 2: Read the URL List

Read \`funding-sources/_urls.md\`. Build the list of (file, URL) pairs to process.

In CHECK mode: also read \`_last-harvested.json\` and skip any source harvested within the last 7 days.

### Step 3: Harvest Each Source

For each URL to process:

1. Use **WebFetch** to retrieve the page content. Do NOT use WebSearch unless a researcher profile was provided (see Smart Scan above).
2. Extract all available funding schemes from the page:
   - Scheme name
   - Status (open/closed/upcoming/rolling)
   - Deadline
   - Amount/range
   - Duration
   - Career stage eligibility
   - Institutional eligibility
   - Thematic priorities
   - Application process summary
   - Direct URL to the scheme page
3. Write the extracted data to the corresponding \`funding-sources/<funder>.md\` file following the \`_template.md\` schema exactly.
4. If a researcher profile was provided, add \`disciplines: [field1, field2]\` to the funder file header.
5. Update \`_last-harvested.json\` with the current date for this source.

### Step 4: Handle Failures Honestly

If a URL fails to load, returns a redirect, or returns content that does not contain useful funding information:

- Write to the funder file:
  \`\`\`
  > Harvest failed: YYYY-MM-DD — [reason: e.g. "page returned no scheme data", "URL redirected", "timeout"]
  > Manual check required. URL: [url]
  \`\`\`
- Update \`_last-harvested.json\` with the attempt timestamp anyway, so CHECK mode knows not to retry immediately.
- Continue to the next source. Do NOT stop the entire harvest.

### Step 5: Do Not Hallucinate

**Never invent or guess funding information.** If the page does not state a deadline, write "TBC". If the page does not state an amount, write "varies". If the page does not describe eligibility, write "see URL".

### Step 6: Report Completion

After processing all sources, report:
- Sources successfully harvested (count and list)
- Sources that failed (count, file, and reason)
- Sources skipped because still fresh (CHECK mode only)
- Any sources where the URL needs manual attention
- Updated \`_last-harvested.json\` summary

---

## Important Constraints

- Use **WebFetch** on known URLs only unless smart scan is active.
- Use **WebSearch** only when a researcher profile is provided and only to discover relevant URLs — not for general browsing.
- Each URL should map to a specific funder file. Multiple URLs for the same funder should result in merged content in one file.
- Do not remove existing scheme data from a funder file unless you have confirmed the scheme no longer exists on the live page.
- Always update \`_last-harvested.json\` even if the harvest was partial or failed.
`.trim();
```

- [ ] **Step 2: Update core/src/commands/scan.ts**

Replace the entire file with:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { GRANT_SCANNER_PROMPT } from "../prompts/grant-scanner.js";
import { streamToConsole } from "../stream.js";

export interface ScanOptions {
  check?: boolean;
  force?: boolean;
}

export async function scanCommand(
  options: ScanOptions = {},
  name?: string
): Promise<void> {
  const dataDir = resolve(process.cwd(), "data");

  const modeFlag = options.force ? "--force" : options.check ? "--check" : "";
  const modeDescription = options.force
    ? "FORCE mode: re-harvest all sources regardless of timestamps"
    : options.check
    ? "CHECK mode: only re-fetch sources older than 7 days"
    : "HARVEST mode: full harvest of all sources";

  // Build profile context for smart scan
  let profileContext = "";
  const allowedTools: string[] = ["Read", "Write", "Glob", "WebFetch"];

  if (name) {
    const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
    if (existsSync(profilePath)) {
      const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
      profileContext = `

Researcher profile provided for smart scan:
- Disciplinary fields: ${profile.disciplinary_fields?.join(", ") ?? "unknown"}
- Research themes: ${profile.research_themes?.join(", ") ?? "unknown"}
- Geographic focus: ${profile.geographic_focus?.join(", ") ?? "unknown"}

Use WebSearch to discover additional grant URLs relevant to these fields.`;
      allowedTools.push("WebSearch");
    }
  }

  console.log(
    `Scanning funding sources (${modeDescription})${name ? ` for ${name}` : ""}...`
  );

  await streamToConsole(
    query({
      prompt: `Harvest the funding database. ${modeFlag ? `Flag: ${modeFlag}` : "No flags passed."}

Mode: ${modeDescription}

URL list: ${dataDir}/funding-sources/_urls.md
Template: ${dataDir}/funding-sources/_template.md
Timestamps: ${dataDir}/funding-sources/_last-harvested.json
Funder files directory: ${dataDir}/funding-sources/${profileContext}`,
      options: {
        cwd: dataDir,
        systemPrompt: GRANT_SCANNER_PROMPT,
        allowedTools,
        permissionMode: "acceptEdits",
        maxTurns: 50,
      },
    })
  );
}
```

- [ ] **Step 3: Update core/src/cli.ts scan command**

In `core/src/cli.ts`, find the scan command block and replace it with:

```typescript
program
  .command("scan [name]")
  .description("Harvest or refresh the funding database from known URLs")
  .option("--check", "Only re-fetch sources older than 7 days")
  .option("--force", "Re-harvest everything, ignore timestamps")
  .action(async (name: string | undefined, options: { check?: boolean; force?: boolean }) => {
    await scanCommand(options, name);
  });
```

- [ ] **Step 4: Rebuild core**

```bash
cd core && npm run build
```

Expected: no errors.

- [ ] **Step 5: Smoke test the CLI**

```bash
cd core && node dist/cli.js scan --help
```

Expected output includes `[name]` as optional argument.

- [ ] **Step 6: Commit**

```bash
cd ..
git add core/src/prompts/grant-scanner.ts core/src/commands/scan.ts core/src/cli.ts core/dist/
git commit -m "feat(core): smart scan with WebSearch based on researcher profile"
```

---

## Task 8: API route — POST /api/session (create session)

**Files:**
- Create: `grant-researcher/src/app/api/session/route.ts`

- [ ] **Step 1: Create the directories**

```bash
mkdir -p grant-researcher/src/app/api/session
```

- [ ] **Step 2: Create the route**

Create `grant-researcher/src/app/api/session/route.ts`:

```typescript
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { slugify } from "@/lib/slugify";

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("cv") as File | null;
  const rawName = formData.get("name") as string | null;

  if (!file || !rawName) {
    return Response.json({ error: "cv and name are required" }, { status: 400 });
  }

  const name = slugify(rawName);
  if (!name) {
    return Response.json({ error: "name must contain alphanumeric characters" }, { status: 400 });
  }

  const dataDir = resolve(process.cwd(), "core/data");
  const rawDir = resolve(dataDir, `researchers/${name}/raw`);

  mkdirSync(rawDir, { recursive: true });

  // Determine file extension
  const originalName = file.name;
  const ext = originalName.includes(".")
    ? originalName.split(".").pop() ?? "md"
    : "md";

  const cvPath = resolve(rawDir, `cv.${ext}`);
  const bytes = await file.arrayBuffer();
  writeFileSync(cvPath, Buffer.from(bytes));

  return Response.json({ name, cvPath: `researchers/${name}/raw/cv.${ext}` });
}
```

- [ ] **Step 3: Manual test**

Start the dev server from the project root:

```bash
cd grant-scout-v2 && cd grant-researcher && npm run dev
```

In a second terminal:

```bash
curl -X POST http://localhost:3000/api/session \
  -F "name=Dr. Will Rea" \
  -F "cv=@../core/data/researchers/will-rea/raw/cv.md"
```

Expected: `{"name":"dr-will-rea","cvPath":"researchers/dr-will-rea/raw/cv.md"}`

- [ ] **Step 4: Commit**

```bash
git add grant-researcher/src/app/api/session/route.ts
git commit -m "feat(grant-researcher): add session creation API route"
```

---

## Task 9: API route — GET /api/session/[name]/status

**Files:**
- Create: `grant-researcher/src/app/api/session/[name]/status/route.ts`

- [ ] **Step 1: Create the directories**

```bash
mkdir -p grant-researcher/src/app/api/session/\[name\]/status
```

- [ ] **Step 2: Create the route**

Create `grant-researcher/src/app/api/session/[name]/status/route.ts`:

```typescript
import { existsSync, readdirSync, statSync } from "fs";
import { resolve } from "path";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const dataDir = resolve(process.cwd(), "core/data");

  const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
  const harvestedPath = resolve(dataDir, "funding-sources/_last-harvested.json");
  const matchesPath = resolve(dataDir, `outputs/${name}/matches.md`);
  const proposalsDir = resolve(dataDir, `outputs/${name}/proposals`);

  const scanComplete =
    existsSync(harvestedPath) &&
    Date.now() - statSync(harvestedPath).mtimeMs < SEVEN_DAYS_MS;

  const proposals = existsSync(proposalsDir)
    ? readdirSync(proposalsDir).filter((f) => f.endsWith(".md"))
    : [];

  return Response.json({
    profile: existsSync(profilePath),
    scan: scanComplete,
    match: existsSync(matchesPath),
    proposals,
  });
}
```

- [ ] **Step 3: Manual test**

```bash
curl http://localhost:3000/api/session/will-rea/status
```

Expected (for existing will-rea with profile.json present):
```json
{"profile":true,"scan":false,"match":false,"proposals":[]}
```

- [ ] **Step 4: Commit**

```bash
git add grant-researcher/src/app/api/session/\[name\]/status/route.ts
git commit -m "feat(grant-researcher): add session status API route"
```

---

## Task 10: API routes — profile, scan, match (SSE)

**Files:**
- Create: `grant-researcher/src/app/api/session/[name]/profile/route.ts`
- Create: `grant-researcher/src/app/api/session/[name]/scan/route.ts`
- Create: `grant-researcher/src/app/api/session/[name]/match/route.ts`

- [ ] **Step 1: Create profile route**

```bash
mkdir -p grant-researcher/src/app/api/session/\[name\]/profile
```

Create `grant-researcher/src/app/api/session/[name]/profile/route.ts`:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { PROFILE_BUILDER_PROMPT } from "grant-scout/prompts/profile-builder";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const dataDir = resolve(process.cwd(), "core/data");

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Build a researcher profile for "${name}".

Read the CV at: ${dataDir}/researchers/${name}/raw/cv.md

Write outputs to:
- ${dataDir}/researchers/${name}/profile.json
- ${dataDir}/researchers/${name}/publications.md`,
          options: {
            cwd: dataDir,
            systemPrompt: PROFILE_BUILDER_PROMPT,
            allowedTools: ["Read", "Write", "Glob"],
            permissionMode: "acceptEdits",
            maxTurns: 20,
          },
        }),
        controller
      );
    },
  });

  return sseResponse(stream);
}
```

- [ ] **Step 2: Create scan route**

```bash
mkdir -p grant-researcher/src/app/api/session/\[name\]/scan
```

Create `grant-researcher/src/app/api/session/[name]/scan/route.ts`:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { GRANT_SCANNER_PROMPT } from "grant-scout/prompts/grant-scanner";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const dataDir = resolve(process.cwd(), "core/data");

  // Build profile context for smart scan
  let profileContext = "";
  const allowedTools = ["Read", "Write", "Glob", "WebFetch"];

  const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
  if (existsSync(profilePath)) {
    const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
    profileContext = `

Researcher profile provided for smart scan:
- Disciplinary fields: ${(profile.disciplinary_fields ?? []).join(", ")}
- Research themes: ${(profile.research_themes ?? []).join(", ")}
- Geographic focus: ${(profile.geographic_focus ?? []).join(", ")}

Use WebSearch to discover additional grant URLs relevant to these fields.`;
    allowedTools.push("WebSearch");
  }

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Harvest the funding database. No flags passed.

Mode: HARVEST mode: full harvest of all sources

URL list: ${dataDir}/funding-sources/_urls.md
Template: ${dataDir}/funding-sources/_template.md
Timestamps: ${dataDir}/funding-sources/_last-harvested.json
Funder files directory: ${dataDir}/funding-sources/${profileContext}`,
          options: {
            cwd: dataDir,
            systemPrompt: GRANT_SCANNER_PROMPT,
            allowedTools,
            permissionMode: "acceptEdits",
            maxTurns: 50,
          },
        }),
        controller
      );
    },
  });

  return sseResponse(stream);
}
```

- [ ] **Step 3: Create match route**

```bash
mkdir -p grant-researcher/src/app/api/session/\[name\]/match
```

Create `grant-researcher/src/app/api/session/[name]/match/route.ts`:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { MATCHER_PROMPT } from "grant-scout/prompts/matcher";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const dataDir = resolve(process.cwd(), "core/data");

  // Ensure outputs directory exists
  mkdirSync(resolve(dataDir, `outputs/${name}`), { recursive: true });

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Score and rank all funding opportunities for researcher "${name}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Funding sources directory: ${dataDir}/funding-sources/ (read all *.md files that do NOT start with _)
Write output to: ${dataDir}/outputs/${name}/matches.md

Remember: make ZERO web calls. All matching is based solely on local files.`,
          options: {
            cwd: dataDir,
            systemPrompt: MATCHER_PROMPT,
            // NO WebFetch or WebSearch — hard constraint
            allowedTools: ["Read", "Write", "Glob"],
            permissionMode: "acceptEdits",
            maxTurns: 30,
          },
        }),
        controller
      );
    },
  });

  return sseResponse(stream);
}
```

- [ ] **Step 4: Commit**

```bash
git add grant-researcher/src/app/api/session/\[name\]/profile/ \
        grant-researcher/src/app/api/session/\[name\]/scan/ \
        grant-researcher/src/app/api/session/\[name\]/match/
git commit -m "feat(grant-researcher): add profile, scan, match SSE API routes"
```

---

## Task 11: API routes — matches (GET) and propose (POST SSE)

**Files:**
- Create: `grant-researcher/src/app/api/session/[name]/matches/route.ts`
- Create: `grant-researcher/src/app/api/session/[name]/propose/route.ts`

- [ ] **Step 1: Create matches route**

```bash
mkdir -p grant-researcher/src/app/api/session/\[name\]/matches
```

Create `grant-researcher/src/app/api/session/[name]/matches/route.ts`:

```typescript
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { parseMatches } from "@/lib/parseMatches";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const matchesPath = resolve(process.cwd(), `core/data/outputs/${name}/matches.md`);

  if (!existsSync(matchesPath)) {
    return Response.json({ matches: [] });
  }

  const text = readFileSync(matchesPath, "utf-8");
  return Response.json({ matches: parseMatches(text) });
}
```

- [ ] **Step 2: Create propose route**

```bash
mkdir -p grant-researcher/src/app/api/session/\[name\]/propose
```

Create `grant-researcher/src/app/api/session/[name]/propose/route.ts`:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { PROPOSAL_OUTLINER_PROMPT } from "grant-scout/prompts/proposal-outliner";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const { funder, scheme } = (await req.json()) as { funder: string; scheme: string };

  if (!funder || !scheme) {
    return Response.json({ error: "funder and scheme are required" }, { status: 400 });
  }

  const dataDir = resolve(process.cwd(), "core/data");
  const proposalsDir = resolve(dataDir, `outputs/${name}/proposals`);
  mkdirSync(proposalsDir, { recursive: true });

  const schemeSlug = scheme
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Draft a strategic alignment document for researcher "${name}" applying to the "${scheme}" scheme from "${funder}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Funder file: ${dataDir}/funding-sources/${funder}.md
Target scheme: "${scheme}"
Write output to: ${dataDir}/outputs/${name}/proposals/${funder}-${schemeSlug}.md`,
          options: {
            cwd: dataDir,
            systemPrompt: PROPOSAL_OUTLINER_PROMPT,
            allowedTools: ["Read", "Write", "Glob"],
            permissionMode: "acceptEdits",
            maxTurns: 20,
          },
        }),
        controller
      );
    },
  });

  return sseResponse(stream);
}
```

- [ ] **Step 3: Commit**

```bash
git add grant-researcher/src/app/api/session/\[name\]/matches/ \
        grant-researcher/src/app/api/session/\[name\]/propose/
git commit -m "feat(grant-researcher): add matches and propose API routes"
```

---

## Task 12: Components — CVDropZone and PipelineBar

**Files:**
- Create: `grant-researcher/src/components/CVDropZone.tsx`
- Create: `grant-researcher/src/components/PipelineBar.tsx`

- [ ] **Step 1: Create CVDropZone.tsx**

```bash
mkdir -p grant-researcher/src/components
```

Create `grant-researcher/src/components/CVDropZone.tsx`:

```typescript
"use client";

import { useRef, useState } from "react";

interface CVDropZoneProps {
  onSubmit: (file: File, name: string) => void;
  loading?: boolean;
}

export function CVDropZone({ onSubmit, loading = false }: CVDropZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file && name.trim()) onSubmit(file, name.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-full max-w-md">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragging ? "border-blue-400 bg-blue-950" : "border-slate-600 hover:border-slate-400"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".md,.pdf,.txt"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="text-3xl mb-2">📄</div>
        {file ? (
          <p className="text-slate-300 text-sm">{file.name}</p>
        ) : (
          <>
            <p className="text-slate-400 text-sm">Drop your CV here</p>
            <p className="text-slate-600 text-xs mt-1">.md, .pdf, or .txt</p>
          </>
        )}
      </div>

      <input
        type="text"
        placeholder="Your name (e.g. will-rea)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 text-sm text-center placeholder-slate-500 focus:outline-none focus:border-blue-400"
      />

      <button
        type="submit"
        disabled={!file || !name.trim() || loading}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-8 py-2 rounded-lg text-sm transition-colors"
      >
        {loading ? "Starting…" : "Start →"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create PipelineBar.tsx**

Create `grant-researcher/src/components/PipelineBar.tsx`:

```typescript
export type StageStatus = "idle" | "running" | "complete" | "error";

export interface StageState {
  profile: StageStatus;
  scan: StageStatus;
  match: StageStatus;
  propose: StageStatus;
}

interface PipelineBarProps {
  stages: StageState;
  onRun: (stage: keyof StageState) => void;
}

const STAGE_LABELS: Record<keyof StageState, string> = {
  profile: "Profile",
  scan: "Scan",
  match: "Match",
  propose: "Propose",
};

const STAGE_ORDER: Array<keyof StageState> = ["profile", "scan", "match", "propose"];

function isReady(stage: keyof StageState, stages: StageState): boolean {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === 0) return stages[stage] === "idle" || stages[stage] === "error";
  const prev = STAGE_ORDER[idx - 1];
  return stages[prev] === "complete" && (stages[stage] === "idle" || stages[stage] === "error");
}

export function PipelineBar({ stages, onRun }: PipelineBarProps) {
  return (
    <div className="flex w-full">
      {STAGE_ORDER.map((stage, idx) => {
        const status = stages[stage];
        const ready = isReady(stage, stages);

        const borderColor =
          status === "complete" ? "border-green-500" :
          status === "running" ? "border-blue-500" :
          status === "error" ? "border-red-500" :
          "border-slate-700";

        const bgColor =
          status === "complete" ? "bg-green-950" :
          status === "running" ? "bg-blue-950" :
          status === "error" ? "bg-red-950" :
          "bg-slate-900";

        const textColor =
          status === "complete" ? "text-green-400" :
          status === "running" ? "text-blue-400" :
          status === "error" ? "text-red-400" :
          "text-slate-500";

        const label =
          status === "complete" ? `✓ ${STAGE_LABELS[stage].toUpperCase()}` :
          status === "running" ? `● ${STAGE_LABELS[stage].toUpperCase()}` :
          status === "error" ? `✗ ${STAGE_LABELS[stage].toUpperCase()}` :
          `○ ${STAGE_LABELS[stage].toUpperCase()}`;

        const roundedLeft = idx === 0 ? "rounded-l-lg" : "";
        const roundedRight = idx === STAGE_ORDER.length - 1 ? "rounded-r-lg" : "";

        return (
          <div
            key={stage}
            className={`flex-1 border ${borderColor} ${bgColor} ${roundedLeft} ${roundedRight} px-3 py-3 text-center`}
          >
            <div className={`text-xs font-bold ${textColor}`}>{label}</div>
            {ready && stage !== "propose" && (
              <button
                onClick={() => onRun(stage)}
                className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Run
              </button>
            )}
            {status === "running" && (
              <div className="mt-1 text-xs text-blue-500 animate-pulse">running…</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add grant-researcher/src/components/CVDropZone.tsx grant-researcher/src/components/PipelineBar.tsx
git commit -m "feat(grant-researcher): add CVDropZone and PipelineBar components"
```

---

## Task 13: Components — StageLog, MatchList, ProposalViewer

**Files:**
- Create: `grant-researcher/src/components/StageLog.tsx`
- Create: `grant-researcher/src/components/MatchList.tsx`
- Create: `grant-researcher/src/components/ProposalViewer.tsx`

- [ ] **Step 1: Create StageLog.tsx**

Create `grant-researcher/src/components/StageLog.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import type { SSEEvent } from "@/lib/sse";

interface LogEntry {
  event: SSEEvent;
  id: number;
}

interface StageLogProps {
  entries: LogEntry[];
}

export function StageLog({ entries }: StageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-48 flex items-center justify-center">
        <p className="text-slate-600 text-sm">Stage output will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-48 overflow-y-auto font-mono text-xs">
      {entries.map(({ event, id }) => {
        if (event.type === "tool") {
          return (
            <div key={id} className="text-blue-400 mb-1">[{event.name}]</div>
          );
        }
        if (event.type === "text") {
          return (
            <div key={id} className="text-slate-400 mb-1">{event.text}</div>
          );
        }
        if (event.type === "result") {
          return (
            <div key={id} className="text-green-400 mb-1 mt-2">
              ✓ Done in {(event.duration / 1000).toFixed(1)}s · {event.turns} turns · ${event.cost.toFixed(4)}
            </div>
          );
        }
        if (event.type === "error") {
          return (
            <div key={id} className="text-red-400 mb-1">✗ Error: {event.message}</div>
          );
        }
        return null;
      })}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 2: Create MatchList.tsx**

Create `grant-researcher/src/components/MatchList.tsx`:

```typescript
import type { Match } from "@/lib/parseMatches";

interface MatchListProps {
  matches: Match[];
  onPropose: (funder: string, scheme: string) => void;
  proposing: boolean;
}

export function MatchList({ matches, onPropose, proposing }: MatchListProps) {
  const tier1 = matches.filter((m) => m.tier === 1);
  const tier2 = matches.filter((m) => m.tier === 2);
  const tier3 = matches.filter((m) => m.tier === 3);

  if (matches.length === 0) return null;

  function MatchRow({ match }: { match: Match }) {
    return (
      <button
        onClick={() => onPropose(match.funder, match.scheme)}
        disabled={proposing}
        className="w-full text-left bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg px-4 py-3 mb-2 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-slate-200 text-sm font-medium">{match.scheme}</div>
            <div className="text-slate-500 text-xs mt-0.5">
              {match.funder} · {match.amount} · {match.deadline}
            </div>
          </div>
          <div className="ml-4 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-300 text-xs font-bold shrink-0">
            {match.score.toFixed(1)}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="mt-6">
      {tier1.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 font-bold uppercase mb-2">
            Tier 1 — Strong Matches · click to propose
          </div>
          {tier1.map((m, i) => <MatchRow key={i} match={m} />)}
        </div>
      )}
      {tier2.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 font-bold uppercase mb-2">
            Tier 2 — Worth Exploring
          </div>
          {tier2.map((m, i) => <MatchRow key={i} match={m} />)}
        </div>
      )}
      {tier3.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 font-bold uppercase mb-2">
            Tier 3 — Long Shots
          </div>
          {tier3.map((m, i) => <MatchRow key={i} match={i} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ProposalViewer.tsx**

Create `grant-researcher/src/components/ProposalViewer.tsx`:

```typescript
"use client";

import { useState } from "react";

interface Proposal {
  filename: string;
  content: string;
}

interface ProposalViewerProps {
  proposals: Proposal[];
}

export function ProposalViewer({ proposals }: ProposalViewerProps) {
  const [activeIdx, setActiveIdx] = useState(proposals.length - 1);

  if (proposals.length === 0) return null;

  const active = proposals[activeIdx];

  return (
    <div className="mt-6">
      <div className="text-xs text-slate-500 font-bold uppercase mb-3">
        Proposal Alignments
      </div>

      {proposals.length > 1 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {proposals.map((p, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`text-xs px-3 py-1 rounded border transition-colors
                ${i === activeIdx
                  ? "border-blue-500 text-blue-400 bg-blue-950"
                  : "border-slate-700 text-slate-500 hover:border-slate-500"
                }`}
            >
              {p.filename.replace(".md", "")}
            </button>
          ))}
        </div>
      )}

      <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-300 text-xs overflow-auto whitespace-pre-wrap leading-relaxed max-h-96">
        {active.content}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add grant-researcher/src/components/StageLog.tsx \
        grant-researcher/src/components/MatchList.tsx \
        grant-researcher/src/components/ProposalViewer.tsx
git commit -m "feat(grant-researcher): add StageLog, MatchList, ProposalViewer components"
```

---

## Task 14: Screen 1 — Landing page

**Files:**
- Create: `grant-researcher/src/app/layout.tsx`
- Create: `grant-researcher/src/app/page.tsx`

- [ ] **Step 1: Create layout.tsx**

Create `grant-researcher/src/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grant Researcher",
  description: "AI-powered grant discovery for researchers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create page.tsx (landing)**

Create `grant-researcher/src/app/page.tsx`:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CVDropZone } from "@/components/CVDropZone";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(file: File, name: string) {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("cv", file);
      formData.append("name", name);

      const res = await fetch("/api/session", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create session");
        return;
      }

      router.push(`/session/${data.name}`);
    } catch (err) {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Grant Scout</h1>
      <p className="text-slate-500 text-sm mb-10">Find funding for your research</p>

      <CVDropZone onSubmit={handleSubmit} loading={loading} />

      {error && (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Manual test**

Visit `http://localhost:3000`. You should see the upload form. Drop a file and enter a name. Clicking Start should redirect to `/session/<slug>` (which will 404 until Task 15).

- [ ] **Step 4: Commit**

```bash
git add grant-researcher/src/app/layout.tsx grant-researcher/src/app/page.tsx
git commit -m "feat(grant-researcher): add landing page"
```

---

## Task 15: Screen 2 — Pipeline session page

**Files:**
- Create: `grant-researcher/src/app/session/[name]/page.tsx`
- Create: `grant-researcher/src/app/api/session/[name]/proposal/route.ts`

- [ ] **Step 1: Create proposal content API route**

This serves the raw text of a generated proposal file.

```bash
mkdir -p grant-researcher/src/app/api/session/\[name\]/proposal
```

Create `grant-researcher/src/app/api/session/[name]/proposal/route.ts`:

```typescript
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const proposalsDir = resolve(process.cwd(), `core/data/outputs/${name}/proposals`);

  if (!existsSync(proposalsDir)) {
    return Response.json({ proposals: [] });
  }

  const files = readdirSync(proposalsDir).filter((f) => f.endsWith(".md"));
  const proposals = files.map((filename) => ({
    filename,
    content: readFileSync(resolve(proposalsDir, filename), "utf-8"),
  }));

  return Response.json({ proposals });
}
```

- [ ] **Step 2: Create the session page**

```bash
mkdir -p grant-researcher/src/app/session/\[name\]
```

Create `grant-researcher/src/app/session/[name]/page.tsx`:

```typescript
"use client";

import { useEffect, useReducer, useRef } from "react";
import { use } from "react";
import { PipelineBar, type StageState, type StageStatus } from "@/components/PipelineBar";
import { StageLog } from "@/components/StageLog";
import { MatchList } from "@/components/MatchList";
import { ProposalViewer } from "@/components/ProposalViewer";
import type { SSEEvent } from "@/lib/sse";
import type { Match } from "@/lib/parseMatches";

interface LogEntry { event: SSEEvent; id: number; }
interface Proposal { filename: string; content: string; }

interface PageState {
  stages: StageState;
  log: LogEntry[];
  matches: Match[];
  proposals: Proposal[];
  logCounter: number;
}

type Action =
  | { type: "INIT"; profile: boolean; scan: boolean; match: boolean; proposals: Proposal[]; matches: Match[] }
  | { type: "START"; stage: keyof StageState }
  | { type: "COMPLETE"; stage: keyof StageState }
  | { type: "ERROR"; stage: keyof StageState }
  | { type: "LOG"; event: SSEEvent }
  | { type: "SET_MATCHES"; matches: Match[] }
  | { type: "SET_PROPOSALS"; proposals: Proposal[] };

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        stages: {
          profile: action.profile ? "complete" : "idle",
          scan: action.scan ? "complete" : "idle",
          match: action.match ? "complete" : "idle",
          propose: action.proposals.length > 0 ? "complete" : "idle",
        },
        matches: action.matches,
        proposals: action.proposals,
      };
    case "START":
      return { ...state, stages: { ...state.stages, [action.stage]: "running" as StageStatus } };
    case "COMPLETE":
      return { ...state, stages: { ...state.stages, [action.stage]: "complete" as StageStatus } };
    case "ERROR":
      return { ...state, stages: { ...state.stages, [action.stage]: "error" as StageStatus } };
    case "LOG":
      return {
        ...state,
        log: [...state.log, { event: action.event, id: state.logCounter }],
        logCounter: state.logCounter + 1,
      };
    case "SET_MATCHES":
      return { ...state, matches: action.matches };
    case "SET_PROPOSALS":
      return { ...state, proposals: action.proposals };
    default:
      return state;
  }
}

const INITIAL_STATE: PageState = {
  stages: { profile: "idle", scan: "idle", match: "idle", propose: "idle" },
  log: [],
  matches: [],
  proposals: [],
  logCounter: 0,
};

export default function SessionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const runningRef = useRef(false);

  // Load initial state on mount
  useEffect(() => {
    async function loadStatus() {
      const [statusRes, proposalRes] = await Promise.all([
        fetch(`/api/session/${name}/status`),
        fetch(`/api/session/${name}/proposal`),
      ]);
      const status = await statusRes.json();
      const { proposals } = await proposalRes.json();

      let matches: Match[] = [];
      if (status.match) {
        const matchesRes = await fetch(`/api/session/${name}/matches`);
        const data = await matchesRes.json();
        matches = data.matches ?? [];
      }

      dispatch({ type: "INIT", ...status, proposals, matches });
    }
    loadStatus();
  }, [name]);

  async function runStage(stage: keyof StageState, url: string, body?: object) {
    if (runningRef.current) return;
    runningRef.current = true;
    dispatch({ type: "START", stage });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            dispatch({ type: "LOG", event });
            if (event.type === "error") {
              dispatch({ type: "ERROR", stage });
              runningRef.current = false;
              return;
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      dispatch({ type: "COMPLETE", stage });

      // After stage completes, load any new data
      if (stage === "match") {
        const matchesRes = await fetch(`/api/session/${name}/matches`);
        const { matches } = await matchesRes.json();
        dispatch({ type: "SET_MATCHES", matches });
      }
      if (stage === "propose") {
        const proposalRes = await fetch(`/api/session/${name}/proposal`);
        const { proposals } = await proposalRes.json();
        dispatch({ type: "SET_PROPOSALS", proposals });
      }
    } catch (err) {
      dispatch({ type: "LOG", event: { type: "error", message: String(err) } });
      dispatch({ type: "ERROR", stage });
    } finally {
      runningRef.current = false;
    }
  }

  function handleRun(stage: keyof StageState) {
    const urls: Record<keyof StageState, string> = {
      profile: `/api/session/${name}/profile`,
      scan: `/api/session/${name}/scan`,
      match: `/api/session/${name}/match`,
      propose: `/api/session/${name}/propose`,
    };
    runStage(stage, urls[stage]);
  }

  function handlePropose(funder: string, scheme: string) {
    runStage("propose", `/api/session/${name}/propose`, { funder, scheme });
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Grant Scout</h1>
        <p className="text-slate-500 text-sm mt-1">{name}</p>
      </div>

      <PipelineBar stages={state.stages} onRun={handleRun} />

      <div className="mt-4">
        <StageLog entries={state.log} />
      </div>

      {state.matches.length > 0 && (
        <MatchList
          matches={state.matches}
          onPropose={handlePropose}
          proposing={state.stages.propose === "running"}
        />
      )}

      {state.proposals.length > 0 && (
        <ProposalViewer proposals={state.proposals} />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Fix MatchList tier3 bug**

In `grant-researcher/src/components/MatchList.tsx`, find the tier3 row render (last map call) and fix the incorrect `key={i}` on the second argument:

```typescript
{tier3.map((m, i) => <MatchRow key={i} match={m} />)}
```

(Remove the incorrect `match={i}` that was written as `match={i}` — change to `match={m}`.)

- [ ] **Step 4: Manual end-to-end test**

With the dev server running (`cd grant-researcher && npm run dev` from monorepo root):

1. Visit `http://localhost:3000`
2. Drop `core/data/researchers/will-rea/raw/cv.md`, enter `will-rea`, click Start
3. On session page, click Run under Profile → watch log fill with `[Read]`, `[Write]` calls
4. After profile completes (green), click Run under Scan → watch `[WebSearch]` calls appear
5. After scan completes, click Run under Match → verify NO `[WebFetch]` or `[WebSearch]` in log
6. Match list appears → click a Tier 1 row → Propose runs → proposal appears below
7. Refresh page → all four stages show green (recovered from files)

- [ ] **Step 5: Commit**

```bash
git add grant-researcher/src/app/session/ \
        grant-researcher/src/app/api/session/\[name\]/proposal/
git commit -m "feat(grant-researcher): add pipeline session page"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| CV drop + name → create session | Task 8, Task 14 |
| Profile stage SSE | Task 10 |
| Smart scan (WebSearch by field) | Task 7, Task 10 |
| Match stage (no web) | Task 10 |
| User picks match → propose | Task 11, Task 13, Task 15 |
| Live log with tool calls | Task 6, Task 13, Task 15 |
| File-based stage recovery on refresh | Task 9, Task 15 |
| Proposal tabs for multiple proposals | Task 13 |
| Name slug sanitization | Task 4 |
| Path resolution from monorepo root | Tasks 8–11 |
| disciplines: tag in funder files | Task 7 |

All requirements covered. ✓

**Placeholder scan:** No TBDs found. All code steps include actual implementation. ✓

**Type consistency check:**
- `SSEEvent` defined in `lib/sse.ts` Task 6, used in `StageLog` Task 13 and session page Task 15 ✓
- `Match` defined in `lib/parseMatches.ts` Task 5, used in `MatchList` Task 13 and session page Task 15 ✓
- `StageState` / `StageStatus` defined in `PipelineBar` Task 12, used in session page Task 15 ✓
- `Proposal` interface defined locally in session page Task 15 and `ProposalViewer` Task 13 — consistent ✓
