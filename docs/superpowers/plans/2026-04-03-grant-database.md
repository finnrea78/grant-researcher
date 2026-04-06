# Grant Database & Ingestion Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a Supabase Postgres database for grant data and build a CLI-driven ingestion pipeline that pulls from the GtR API and UKRI Funding Finder.

**Architecture:** New `data-pipeline/` workspace package in the monorepo. Supabase stores funders, schemes, classifications, and ingestion audit logs. CLI commands trigger source-specific connectors that fetch, transform, and upsert data.

**Tech Stack:** TypeScript, @supabase/supabase-js, Commander CLI, Cheerio (HTML parsing), tsx (runner)

**Spec:** `docs/superpowers/specs/2026-04-03-grant-database-design.md`

---

## File Structure

```
data-pipeline/
  package.json
  tsconfig.json
  supabase/
    migrations/
      001_grant_schema.sql
  src/
    db.ts                    # Supabase client singleton
    types.ts                 # NormalisedScheme, GtR response types, etc.
    cli.ts                   # Commander entry point
    sources/
      gtr.ts                 # GtR API fetcher
      ukri-finder.ts         # UKRI Funding Finder HTML scraper
    transforms/
      slugify.ts             # String → URL-safe slug
      parse-amounts.ts       # "Up to £2.5m" → { min, max, currency }
      parse-dates.ts         # "8 May 2026, 4pm" → Date | null
      normalise-gtr.ts       # GtR project → NormalisedScheme
      normalise-ukri.ts      # UKRI opportunity → NormalisedScheme
    loaders/
      upsert-funder.ts       # Upsert a funder row
      upsert-schemes.ts      # Upsert scheme rows + classifications
      log-run.ts             # Write ingestion_runs record
  tests/
    transforms/
      parse-amounts.test.ts
      parse-dates.test.ts
      slugify.test.ts
      normalise-gtr.test.ts
    loaders/
      upsert-schemes.test.ts
```

**Root modifications:**
- `package.json` — add `"workspaces": ["data-pipeline"]`

---

### Task 1: Workspace Setup and Dependencies

**Files:**
- Modify: `package.json` (root)
- Create: `data-pipeline/package.json`
- Create: `data-pipeline/tsconfig.json`

- [ ] **Step 1: Add workspaces to root package.json**

Add a `workspaces` field to the root `package.json`:

```json
"workspaces": ["data-pipeline"]
```

Add it after the `"private": true` line. The rest of the file stays unchanged.

- [ ] **Step 2: Create data-pipeline/package.json**

```json
{
  "name": "data-pipeline",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "ingest": "tsx src/cli.ts",
    "test": "jest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0",
    "cheerio": "^1.0.0",
    "commander": "^13.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "roots": ["<rootDir>/tests"]
  }
}
```

- [ ] **Step 3: Create data-pipeline/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Install dependencies**

Run from the monorepo root:

```bash
npm install
```

Expected: `node_modules` updated, `data-pipeline/node_modules` symlinked.

- [ ] **Step 5: Verify workspace resolution**

```bash
npm run -w data-pipeline test -- --passWithNoTests
```

Expected: Jest runs with "No tests found" or passes with no tests.

- [ ] **Step 6: Commit**

```bash
git add package.json data-pipeline/package.json data-pipeline/tsconfig.json package-lock.json
git commit -m "chore: add data-pipeline workspace with dependencies"
```

---

### Task 2: SQL Migration — Grant Schema

**Files:**
- Create: `data-pipeline/supabase/migrations/001_grant_schema.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 001_grant_schema.sql
-- Grant database schema for storing funder and scheme data from multiple sources.

-- Funders: funding bodies (AHRC, Leverhulme, Wellcome, etc.)
CREATE TABLE funders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  website text,
  type text,
  disciplines text[] DEFAULT '{}',
  source_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Schemes: individual funding opportunities or awarded grants
CREATE TABLE schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_id uuid NOT NULL REFERENCES funders(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  status text,
  deadline_raw text,
  deadline_date date,
  amount_raw text,
  amount_min integer,
  amount_max integer,
  amount_currency text DEFAULT 'GBP',
  duration text,
  career_stage text,
  institutional_eligibility text,
  thematic_priorities text,
  application_process text,
  url text,
  grant_reference text UNIQUE,
  source text NOT NULL,
  source_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(funder_id, slug)
);

CREATE INDEX idx_schemes_funder_id ON schemes(funder_id);
CREATE INDEX idx_schemes_status ON schemes(status);
CREATE INDEX idx_schemes_deadline_date ON schemes(deadline_date);
CREATE INDEX idx_schemes_source ON schemes(source);

-- Classifications: research subjects/topics from GtR
CREATE TABLE scheme_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  type text NOT NULL,
  name text NOT NULL,
  percentage integer
);

CREATE INDEX idx_scheme_classifications_scheme_id ON scheme_classifications(scheme_id);

-- Ingestion runs: audit trail
CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  funder_slug text,
  status text NOT NULL DEFAULT 'running',
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- RLS: public read on grant tables, no frontend writes
ALTER TABLE funders ENABLE ROW LEVEL SECURITY;
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read funders" ON funders FOR SELECT USING (true);
CREATE POLICY "Public read schemes" ON schemes FOR SELECT USING (true);
CREATE POLICY "Public read classifications" ON scheme_classifications FOR SELECT USING (true);
-- ingestion_runs: no public access (service role only)

-- Auto-update updated_at on funders and schemes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER funders_updated_at
  BEFORE UPDATE ON funders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER schemes_updated_at
  BEFORE UPDATE ON schemes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: Commit**

```bash
git add data-pipeline/supabase/migrations/001_grant_schema.sql
git commit -m "feat: add SQL migration for grant database schema"
```

**Manual step (user):** Run this SQL in the Supabase dashboard SQL Editor, or via `supabase db push` if using the Supabase CLI locally.

---

### Task 3: Supabase Client and Shared Types

**Files:**
- Create: `data-pipeline/src/db.ts`
- Create: `data-pipeline/src/types.ts`

- [ ] **Step 1: Create the Supabase client**

```typescript
// data-pipeline/src/db.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  );
}

export const supabase = createClient(url, key);
```

- [ ] **Step 2: Create shared types**

```typescript
// data-pipeline/src/types.ts

/** Shape written to the schemes table. All source connectors produce this. */
export interface NormalisedScheme {
  funder_slug: string;
  name: string;
  slug: string;
  status: string | null;
  deadline_raw: string | null;
  deadline_date: string | null; // ISO date string or null
  amount_raw: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string;
  duration: string | null;
  career_stage: string | null;
  institutional_eligibility: string | null;
  thematic_priorities: string | null;
  application_process: string | null;
  url: string | null;
  grant_reference: string | null;
  source: "gtr" | "ukri_funding_finder" | "web_scrape";
  source_metadata: Record<string, unknown>;
  classifications: Classification[];
}

export interface Classification {
  type: string;
  name: string;
  percentage: number | null;
}

/** Shape of a funder row for upsert. */
export interface FunderRow {
  slug: string;
  name: string;
  website: string | null;
  type: string | null;
  disciplines: string[];
  source_metadata: Record<string, unknown>;
}

/** Counters tracked during an ingestion run. */
export interface RunCounters {
  created: number;
  updated: number;
  skipped: number;
}

/** Raw GtR search API response shape (subset of fields we use). */
export interface GtrSearchResponse {
  searchResult: {
    results: {
      projectOverview?: GtrProjectOverview[];
    };
  };
}

export interface GtrProjectOverview {
  projectComposition: {
    project: {
      title: string;
      status: string;
      grantCategory: string;
      abstractText?: string;
      technicalSummary?: string;
      potentialImpactText?: string;
      fund: {
        funder: { name: string };
        valuePounds: number;
        start?: string;
        end?: string;
        type?: string;
      };
      researchSubjects?: GtrClassification[];
      researchTopics?: GtrClassification[];
      healthCategories?: GtrClassification[];
      rcukProgrammes?: GtrClassification[];
      identifiers?: { identifier: { value: string; type: string } }[];
    };
    leadResearchOrganisation?: { name: string };
    personRoles?: {
      personRole: {
        firstName?: string;
        surname?: string;
        roles?: { role: { name: string } }[];
      }[];
    };
  };
}

export interface GtrClassification {
  classification?: {
    text: string;
    percentage?: number;
  }[];
}
```

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/src/db.ts data-pipeline/src/types.ts
git commit -m "feat: add Supabase client and shared types for data pipeline"
```

---

### Task 4: Transform Utilities — slugify, parse-amounts, parse-dates

**Files:**
- Create: `data-pipeline/src/transforms/slugify.ts`
- Create: `data-pipeline/src/transforms/parse-amounts.ts`
- Create: `data-pipeline/src/transforms/parse-dates.ts`
- Test: `data-pipeline/tests/transforms/slugify.test.ts`
- Test: `data-pipeline/tests/transforms/parse-amounts.test.ts`
- Test: `data-pipeline/tests/transforms/parse-dates.test.ts`

- [ ] **Step 1: Write slugify tests**

```typescript
// data-pipeline/tests/transforms/slugify.test.ts
import { slugify } from "../../src/transforms/slugify";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Early Career Fellowships")).toBe("early-career-fellowships");
  });

  it("strips special characters", () => {
    expect(slugify("AHRC (Arts & Humanities)")).toBe("ahrc-arts-humanities");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("Foo  --  Bar")).toBe("foo-bar");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify(" -Hello World- ")).toBe("hello-world");
  });
});
```

- [ ] **Step 2: Write slugify implementation**

```typescript
// data-pipeline/src/transforms/slugify.ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

- [ ] **Step 3: Run slugify tests**

```bash
npm run -w data-pipeline test -- tests/transforms/slugify.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Write parse-amounts tests**

```typescript
// data-pipeline/tests/transforms/parse-amounts.test.ts
import { parseAmount } from "../../src/transforms/parse-amounts";

describe("parseAmount", () => {
  it("parses simple GBP amount", () => {
    expect(parseAmount("£250,000")).toEqual({
      min: 25000000,
      max: 25000000,
      currency: "GBP",
    });
  });

  it("parses range", () => {
    expect(parseAmount("£3,000-£24,000")).toEqual({
      min: 300000,
      max: 2400000,
      currency: "GBP",
    });
  });

  it("parses 'Up to' as max only", () => {
    expect(parseAmount("Up to £1.5 million")).toEqual({
      min: null,
      max: 150000000,
      currency: "GBP",
    });
  });

  it("parses EUR amounts", () => {
    expect(parseAmount("EUR 2.5 million")).toEqual({
      min: 250000000,
      max: 250000000,
      currency: "EUR",
    });
  });

  it("parses integer pence from GtR valuePounds", () => {
    expect(parseAmount(250000, "GBP")).toEqual({
      min: 25000000,
      max: 25000000,
      currency: "GBP",
    });
  });

  it("returns nulls for unparseable text", () => {
    expect(parseAmount("varies")).toEqual({
      min: null,
      max: null,
      currency: "GBP",
    });
  });

  it("returns nulls for TBC", () => {
    expect(parseAmount("TBC")).toEqual({
      min: null,
      max: null,
      currency: "GBP",
    });
  });
});
```

- [ ] **Step 5: Write parse-amounts implementation**

```typescript
// data-pipeline/src/transforms/parse-amounts.ts

export interface ParsedAmount {
  min: number | null;
  max: number | null;
  currency: string;
}

/**
 * Parse a grant amount string or number into structured pence values.
 * Amounts are stored in pence (integer) to avoid floating point issues.
 * If given a number (e.g. from GtR valuePounds), treat it as whole pounds.
 */
export function parseAmount(
  input: string | number | null | undefined,
  defaultCurrency = "GBP"
): ParsedAmount {
  if (input == null) return { min: null, max: null, currency: defaultCurrency };

  // Numeric input (GtR valuePounds is in whole pounds)
  if (typeof input === "number") {
    const pence = Math.round(input * 100);
    return { min: pence, max: pence, currency: defaultCurrency };
  }

  const text = input.trim();
  if (!text || /^(varies|tbc|tba|n\/a)$/i.test(text)) {
    return { min: null, max: null, currency: defaultCurrency };
  }

  // Detect currency
  let currency = defaultCurrency;
  if (/EUR|€/.test(text)) currency = "EUR";
  else if (/USD|\$/.test(text)) currency = "USD";
  else if (/£|GBP/.test(text)) currency = "GBP";

  const toPence = (raw: string): number | null => {
    // Remove currency symbols, commas, spaces
    let cleaned = raw.replace(/[£€$,\s]/g, "");
    let multiplier = 100; // pence
    if (/million/i.test(text)) {
      // "2.5 million" → parse "2.5", multiply by 1_000_000 * 100
      cleaned = cleaned.replace(/million/i, "").trim();
      multiplier = 100_000_000;
    } else if (/k$/i.test(cleaned)) {
      cleaned = cleaned.replace(/k$/i, "");
      multiplier = 100_000;
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.round(num * multiplier);
  };

  // Range: "£3,000-£24,000" or "£3,000 - £24,000"
  const rangeMatch = text.match(
    /([£€$]?[\d,.]+(?:\s*(?:million|k))?)\s*[-–]\s*([£€$]?[\d,.]+(?:\s*(?:million|k))?)/i
  );
  if (rangeMatch) {
    return { min: toPence(rangeMatch[1]), max: toPence(rangeMatch[2]), currency };
  }

  // "Up to X" or "up to X"
  const upToMatch = text.match(/up\s+to\s+([£€$]?[\d,.]+(?:\s*(?:million|k))?)/i);
  if (upToMatch) {
    return { min: null, max: toPence(upToMatch[1]), currency };
  }

  // Single value: "£250,000" or "EUR 2.5 million"
  const singleMatch = text.match(/([£€$]?\s*[\d,.]+(?:\s*(?:million|k))?)/i);
  if (singleMatch) {
    const val = toPence(singleMatch[1]);
    return { min: val, max: val, currency };
  }

  return { min: null, max: null, currency };
}
```

- [ ] **Step 6: Run parse-amounts tests**

```bash
npm run -w data-pipeline test -- tests/transforms/parse-amounts.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 7: Write parse-dates tests**

```typescript
// data-pipeline/tests/transforms/parse-dates.test.ts
import { parseDate } from "../../src/transforms/parse-dates";

describe("parseDate", () => {
  it("parses 'DD Month YYYY' format", () => {
    expect(parseDate("8 May 2026")).toBe("2026-05-08");
  });

  it("parses 'DD Month YYYY, time' and ignores time", () => {
    expect(parseDate("8 May 2026, 4pm")).toBe("2026-05-08");
  });

  it("parses ISO date strings", () => {
    expect(parseDate("2026-05-08")).toBe("2026-05-08");
  });

  it("parses 'Month YYYY' as first of month", () => {
    expect(parseDate("January 2027")).toBe("2027-01-01");
  });

  it("returns null for TBC", () => {
    expect(parseDate("TBC")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseDate(null)).toBeNull();
  });
});
```

- [ ] **Step 8: Write parse-dates implementation**

```typescript
// data-pipeline/src/transforms/parse-dates.ts

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/**
 * Parse a date string into ISO format (YYYY-MM-DD) or null.
 * Handles: "8 May 2026", "8 May 2026, 4pm", "2026-05-08", "January 2027".
 */
export function parseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input.trim();
  if (!text || /^(tbc|tba|n\/a|varies|rolling)$/i.test(text)) return null;

  // ISO format already
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // "DD Month YYYY" with optional trailing text (time, etc.)
  const dayMonthYear = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase()];
    if (month) {
      const day = dayMonthYear[1].padStart(2, "0");
      return `${dayMonthYear[3]}-${month}-${day}`;
    }
  }

  // "Month YYYY" → first of month
  const monthYear = text.match(/^(\w+)\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    if (month) return `${monthYear[2]}-${month}-01`;
  }

  return null;
}
```

- [ ] **Step 9: Run parse-dates tests**

```bash
npm run -w data-pipeline test -- tests/transforms/parse-dates.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 10: Commit**

```bash
git add data-pipeline/src/transforms/ data-pipeline/tests/transforms/
git commit -m "feat: add transform utilities — slugify, parse-amounts, parse-dates"
```

---

### Task 5: Loaders — Upsert Funders, Upsert Schemes, Log Runs

**Files:**
- Create: `data-pipeline/src/loaders/upsert-funder.ts`
- Create: `data-pipeline/src/loaders/upsert-schemes.ts`
- Create: `data-pipeline/src/loaders/log-run.ts`

- [ ] **Step 1: Create upsert-funder loader**

```typescript
// data-pipeline/src/loaders/upsert-funder.ts
import { supabase } from "../db.js";
import type { FunderRow } from "../types.js";

/**
 * Upsert a funder by slug. Returns the funder's UUID.
 */
export async function upsertFunder(funder: FunderRow): Promise<string> {
  const { data, error } = await supabase
    .from("funders")
    .upsert(funder, { onConflict: "slug" })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to upsert funder ${funder.slug}: ${error.message}`);
  return data.id;
}
```

- [ ] **Step 2: Create upsert-schemes loader**

```typescript
// data-pipeline/src/loaders/upsert-schemes.ts
import { supabase } from "../db.js";
import type { NormalisedScheme, RunCounters } from "../types.js";
import { upsertFunder } from "./upsert-funder.js";

/**
 * Upsert a batch of normalised schemes into the database.
 * Resolves funder_id from funder_slug, inserts classifications.
 */
export async function upsertSchemes(
  schemes: NormalisedScheme[],
  funderMap: Map<string, { id: string; name: string }>
): Promise<RunCounters> {
  const counters: RunCounters = { created: 0, updated: 0, skipped: 0 };

  for (const scheme of schemes) {
    const funderInfo = funderMap.get(scheme.funder_slug);
    if (!funderInfo) {
      console.warn(`Skipping scheme "${scheme.name}": unknown funder slug "${scheme.funder_slug}"`);
      counters.skipped++;
      continue;
    }

    const row = {
      funder_id: funderInfo.id,
      name: scheme.name,
      slug: scheme.slug,
      status: scheme.status,
      deadline_raw: scheme.deadline_raw,
      deadline_date: scheme.deadline_date,
      amount_raw: scheme.amount_raw,
      amount_min: scheme.amount_min,
      amount_max: scheme.amount_max,
      amount_currency: scheme.amount_currency,
      duration: scheme.duration,
      career_stage: scheme.career_stage,
      institutional_eligibility: scheme.institutional_eligibility,
      thematic_priorities: scheme.thematic_priorities,
      application_process: scheme.application_process,
      url: scheme.url,
      grant_reference: scheme.grant_reference,
      source: scheme.source,
      source_metadata: scheme.source_metadata,
    };

    // Upsert the scheme. Use grant_reference for GtR, (funder_id, slug) for others.
    let result;
    if (scheme.grant_reference) {
      result = await supabase
        .from("schemes")
        .upsert(row, { onConflict: "grant_reference" })
        .select("id, created_at, updated_at")
        .single();
    } else {
      result = await supabase
        .from("schemes")
        .upsert(row, { onConflict: "funder_id,slug" })
        .select("id, created_at, updated_at")
        .single();
    }

    if (result.error) {
      console.error(`Failed to upsert scheme "${scheme.name}": ${result.error.message}`);
      counters.skipped++;
      continue;
    }

    const schemeId = result.data.id;
    const wasCreated = result.data.created_at === result.data.updated_at;
    if (wasCreated) counters.created++;
    else counters.updated++;

    // Upsert classifications: delete existing, re-insert
    if (scheme.classifications.length > 0) {
      await supabase
        .from("scheme_classifications")
        .delete()
        .eq("scheme_id", schemeId);

      const classRows = scheme.classifications.map((c) => ({
        scheme_id: schemeId,
        type: c.type,
        name: c.name,
        percentage: c.percentage,
      }));

      const { error: classError } = await supabase
        .from("scheme_classifications")
        .insert(classRows);

      if (classError) {
        console.error(`Failed to insert classifications for "${scheme.name}": ${classError.message}`);
      }
    }
  }

  return counters;
}
```

- [ ] **Step 3: Create log-run loader**

```typescript
// data-pipeline/src/loaders/log-run.ts
import { supabase } from "../db.js";
import type { RunCounters } from "../types.js";

/** Start a new ingestion run. Returns the run ID. */
export async function startRun(source: string, funderSlug?: string): Promise<string> {
  const { data, error } = await supabase
    .from("ingestion_runs")
    .insert({
      source,
      funder_slug: funderSlug ?? null,
      status: "running",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to start run: ${error.message}`);
  return data.id;
}

/** Complete an ingestion run with final status and counters. */
export async function completeRun(
  runId: string,
  status: "success" | "failed" | "partial",
  counters: RunCounters,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from("ingestion_runs")
    .update({
      status,
      records_created: counters.created,
      records_updated: counters.updated,
      records_skipped: counters.skipped,
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) console.error(`Failed to complete run ${runId}: ${error.message}`);
}
```

- [ ] **Step 4: Commit**

```bash
git add data-pipeline/src/loaders/
git commit -m "feat: add loaders — upsert funders, upsert schemes, log ingestion runs"
```

---

### Task 6: GtR Source Connector and Normaliser

**Files:**
- Create: `data-pipeline/src/sources/gtr.ts`
- Create: `data-pipeline/src/transforms/normalise-gtr.ts`
- Test: `data-pipeline/tests/transforms/normalise-gtr.test.ts`

- [ ] **Step 1: Write normalise-gtr test**

```typescript
// data-pipeline/tests/transforms/normalise-gtr.test.ts
import { normaliseGtrProject } from "../../src/transforms/normalise-gtr";
import type { GtrProjectOverview } from "../../src/types";

const sampleProject: GtrProjectOverview = {
  projectComposition: {
    project: {
      title: "Digital Heritage Mapping",
      status: "Active",
      grantCategory: "Research Grant",
      abstractText: "A study of digital heritage...",
      technicalSummary: "Using GIS and 3D modelling...",
      potentialImpactText: "Museums and galleries will benefit...",
      fund: {
        funder: { name: "AHRC" },
        valuePounds: 250000,
        start: "2024-01-01",
        end: "2027-01-01",
        type: "INCOME_ACTUAL",
      },
      researchSubjects: {
        classification: [
          { text: "Art History", percentage: 60 },
          { text: "Digital Humanities", percentage: 40 },
        ],
      },
      researchTopics: { classification: [] },
      identifiers: {
        identifier: [{ value: "AH/T001011/1", type: "RCUK" }],
      },
    },
    leadResearchOrganisation: { name: "University of Exeter" },
    personRoles: {
      personRole: [
        {
          firstName: "Jane",
          surname: "Smith",
          roles: { role: [{ name: "PRINCIPAL_INVESTIGATOR" }] },
        },
      ],
    },
  },
};

describe("normaliseGtrProject", () => {
  it("maps title and grant reference", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.name).toBe("Digital Heritage Mapping");
    expect(result.grant_reference).toBe("AH/T001011/1");
  });

  it("sets source to gtr", () => {
    expect(normaliseGtrProject(sampleProject).source).toBe("gtr");
  });

  it("maps Active status to active_award", () => {
    expect(normaliseGtrProject(sampleProject).status).toBe("active_award");
  });

  it("parses fund amount in pence", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.amount_min).toBe(25000000);
    expect(result.amount_max).toBe(25000000);
  });

  it("extracts classifications with percentages", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.classifications).toEqual([
      { type: "research_subject", name: "Art History", percentage: 60 },
      { type: "research_subject", name: "Digital Humanities", percentage: 40 },
    ]);
  });

  it("stores PI and org in source_metadata", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.source_metadata).toMatchObject({
      pi_name: "Jane Smith",
      lead_organisation: "University of Exeter",
      abstract: "A study of digital heritage...",
    });
  });

  it("maps funder name to slug", () => {
    expect(normaliseGtrProject(sampleProject).funder_slug).toBe("ahrc");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run -w data-pipeline test -- tests/transforms/normalise-gtr.test.ts
```

Expected: FAIL — "Cannot find module '../../src/transforms/normalise-gtr'"

- [ ] **Step 3: Write normalise-gtr implementation**

```typescript
// data-pipeline/src/transforms/normalise-gtr.ts
import type { GtrProjectOverview, NormalisedScheme, Classification } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

/** Map UKRI council names to slugs. */
const COUNCIL_SLUGS: Record<string, string> = {
  AHRC: "ahrc",
  BBSRC: "bbsrc",
  EPSRC: "epsrc",
  ESRC: "esrc",
  MRC: "mrc",
  NERC: "nerc",
  STFC: "stfc",
  "Innovate UK": "innovate-uk",
  "Research England": "research-england",
};

function mapStatus(gtrStatus: string): string {
  if (/active/i.test(gtrStatus)) return "active_award";
  return "closed_award";
}

function extractGrantRef(project: GtrProjectOverview["projectComposition"]["project"]): string | null {
  const ids = project.identifiers;
  if (!ids) return null;
  // Handle both array and single identifier shapes from GtR
  const idList = Array.isArray(ids) ? ids : ids.identifier ? [ids.identifier].flat() : [];
  for (const id of idList) {
    const entry = "value" in id ? id : (id as { identifier: { value: string; type: string } }).identifier;
    if (entry && entry.type === "RCUK") return entry.value;
  }
  return null;
}

function extractClassifications(
  data: GtrProjectOverview["projectComposition"]["project"],
  type: string,
  field: "researchSubjects" | "researchTopics" | "healthCategories" | "rcukProgrammes"
): Classification[] {
  const container = data[field];
  if (!container || !container.classification) return [];
  const items = Array.isArray(container.classification) ? container.classification : [container.classification];
  return items
    .filter((c) => c.text)
    .map((c) => ({
      type,
      name: c.text,
      percentage: c.percentage ?? null,
    }));
}

function extractPI(personRoles: GtrProjectOverview["projectComposition"]["personRoles"]): string | null {
  if (!personRoles?.personRole) return null;
  const roles = Array.isArray(personRoles.personRole)
    ? personRoles.personRole
    : [personRoles.personRole];
  for (const pr of roles) {
    const roleList = pr.roles?.role
      ? Array.isArray(pr.roles.role) ? pr.roles.role : [pr.roles.role]
      : [];
    const isPI = roleList.some((r) => r.name === "PRINCIPAL_INVESTIGATOR");
    if (isPI && pr.firstName && pr.surname) {
      return `${pr.firstName} ${pr.surname}`;
    }
  }
  return null;
}

export function normaliseGtrProject(overview: GtrProjectOverview): NormalisedScheme {
  const proj = overview.projectComposition.project;
  const funderName = proj.fund.funder.name;
  const funderSlug = COUNCIL_SLUGS[funderName] ?? slugify(funderName);
  const amount = parseAmount(proj.fund.valuePounds, "GBP");

  const classifications: Classification[] = [
    ...extractClassifications(proj, "research_subject", "researchSubjects"),
    ...extractClassifications(proj, "research_topic", "researchTopics"),
    ...extractClassifications(proj, "health_category", "healthCategories"),
    ...extractClassifications(proj, "rcuk_programme", "rcukProgrammes"),
  ];

  return {
    funder_slug: funderSlug,
    name: proj.title,
    slug: slugify(proj.title),
    status: mapStatus(proj.status),
    deadline_raw: proj.fund.end ?? null,
    deadline_date: proj.fund.end ?? null,
    amount_raw: proj.fund.valuePounds ? `£${proj.fund.valuePounds.toLocaleString()}` : null,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    duration: null,
    career_stage: proj.grantCategory ?? null,
    institutional_eligibility: null,
    thematic_priorities: null,
    application_process: null,
    url: null,
    grant_reference: extractGrantRef(proj),
    source: "gtr",
    source_metadata: {
      abstract: proj.abstractText ?? null,
      technical_summary: proj.technicalSummary ?? null,
      impact_text: proj.potentialImpactText ?? null,
      grant_category: proj.grantCategory,
      fund_start: proj.fund.start ?? null,
      fund_type: proj.fund.type ?? null,
      pi_name: extractPI(overview.projectComposition.personRoles),
      lead_organisation: overview.projectComposition.leadResearchOrganisation?.name ?? null,
    },
    classifications,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run -w data-pipeline test -- tests/transforms/normalise-gtr.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Write GtR source connector**

```typescript
// data-pipeline/src/sources/gtr.ts
import type { GtrProjectOverview } from "../types.js";

const BASE_URL = "https://gtr.ukri.org/search/project";
const DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GtrFetchOptions {
  council?: string;
  term?: string;
  limit?: number;
}

/**
 * Fetch projects from the GtR Search API.
 * Paginates through results, yielding batches of project overviews.
 */
export async function* fetchGtrProjects(
  opts: GtrFetchOptions
): AsyncGenerator<GtrProjectOverview[]> {
  const fetchSize = 100;
  let page = 1;
  let fetched = 0;
  const limit = opts.limit ?? Infinity;
  const term = opts.term ?? opts.council ?? "";

  while (fetched < limit) {
    const url = `${BASE_URL}?term=${encodeURIComponent(term)}&page=${page}&fetchSize=${fetchSize}`;
    console.log(`  Fetching GtR page ${page}: ${url}`);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) break; // No more results
      throw new Error(`GtR API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const results = json?.searchResult?.results?.projectOverview;

    if (!results || results.length === 0) break;

    const batch = results.slice(0, limit - fetched);
    yield batch;

    fetched += batch.length;
    page++;

    // Respect rate etiquette
    await sleep(DELAY_MS);
  }

  console.log(`  Fetched ${fetched} projects from GtR`);
}
```

- [ ] **Step 6: Commit**

```bash
git add data-pipeline/src/sources/gtr.ts data-pipeline/src/transforms/normalise-gtr.ts data-pipeline/tests/transforms/normalise-gtr.test.ts
git commit -m "feat: add GtR API connector and normaliser with tests"
```

---

### Task 7: UKRI Funding Finder Source Connector

**Files:**
- Create: `data-pipeline/src/sources/ukri-finder.ts`
- Create: `data-pipeline/src/transforms/normalise-ukri.ts`

- [ ] **Step 1: Write the UKRI Funding Finder scraper**

```typescript
// data-pipeline/src/sources/ukri-finder.ts
import * as cheerio from "cheerio";

const BASE_URL = "https://www.ukri.org/opportunity/";

export interface RawUkriOpportunity {
  title: string;
  url: string;
  council: string | null;
  closingDate: string | null;
  fundingAmount: string | null;
  status: string | null;
}

/**
 * Fetch and parse the UKRI Funding Finder listing page.
 * Optionally filter by council slug (e.g. "ahrc", "epsrc").
 */
export async function fetchUkriOpportunities(
  council?: string
): Promise<RawUkriOpportunity[]> {
  let url = BASE_URL;
  if (council) {
    url += `?filter_council[]=${encodeURIComponent(council)}`;
  }

  console.log(`  Fetching UKRI Funding Finder: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`UKRI Funding Finder error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const opportunities: RawUkriOpportunity[] = [];

  // UKRI lists opportunities in article/card elements.
  // Selector may need adjustment if UKRI changes their markup.
  $("article, .opportunity-item, .listing-item, [class*='opportunity']").each(
    (_i, el) => {
      const $el = $(el);
      const title =
        $el.find("h2, h3, [class*='title']").first().text().trim() ||
        $el.find("a").first().text().trim();

      if (!title) return;

      const link = $el.find("a").first().attr("href") ?? null;
      const fullUrl = link
        ? link.startsWith("http") ? link : `https://www.ukri.org${link}`
        : null;

      const textContent = $el.text();

      // Extract council name from tags or text
      const councilMatch = textContent.match(
        /\b(AHRC|BBSRC|EPSRC|ESRC|MRC|NERC|STFC|Innovate UK|Research England)\b/i
      );

      // Extract closing date
      const dateMatch = textContent.match(
        /(?:clos(?:es|ing)|deadline)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i
      );

      // Extract funding amount
      const amountMatch = textContent.match(
        /(£[\d,.]+(?:\s*(?:million|k|m))?(?:\s*[-–]\s*£[\d,.]+(?:\s*(?:million|k|m))?)?)/i
      );

      opportunities.push({
        title,
        url: fullUrl ?? url,
        council: councilMatch ? councilMatch[1] : null,
        closingDate: dateMatch ? dateMatch[1] : null,
        fundingAmount: amountMatch ? amountMatch[1] : null,
        status: "open",
      });
    }
  );

  console.log(`  Found ${opportunities.length} opportunities on UKRI Funding Finder`);
  return opportunities;
}
```

- [ ] **Step 2: Write the UKRI normaliser**

```typescript
// data-pipeline/src/transforms/normalise-ukri.ts
import type { NormalisedScheme } from "../types.js";
import type { RawUkriOpportunity } from "../sources/ukri-finder.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

const COUNCIL_SLUGS: Record<string, string> = {
  AHRC: "ahrc",
  BBSRC: "bbsrc",
  EPSRC: "epsrc",
  ESRC: "esrc",
  MRC: "mrc",
  NERC: "nerc",
  STFC: "stfc",
  "Innovate UK": "innovate-uk",
  "Research England": "research-england",
};

export function normaliseUkriOpportunity(
  opp: RawUkriOpportunity
): NormalisedScheme {
  const funderSlug = opp.council
    ? COUNCIL_SLUGS[opp.council] ?? slugify(opp.council)
    : "ukri";

  const amount = parseAmount(opp.fundingAmount);
  const deadlineDate = parseDate(opp.closingDate);

  return {
    funder_slug: funderSlug,
    name: opp.title,
    slug: slugify(opp.title),
    status: opp.status ?? "open",
    deadline_raw: opp.closingDate,
    deadline_date: deadlineDate,
    amount_raw: opp.fundingAmount,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    duration: null,
    career_stage: null,
    institutional_eligibility: null,
    thematic_priorities: null,
    application_process: null,
    url: opp.url,
    grant_reference: null,
    source: "ukri_funding_finder",
    source_metadata: {
      council_raw: opp.council,
    },
    classifications: [],
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/src/sources/ukri-finder.ts data-pipeline/src/transforms/normalise-ukri.ts
git commit -m "feat: add UKRI Funding Finder scraper and normaliser"
```

---

### Task 8: CLI Entry Point

**Files:**
- Create: `data-pipeline/src/cli.ts`

- [ ] **Step 1: Write the CLI**

```typescript
// data-pipeline/src/cli.ts
import { Command } from "commander";
import { supabase } from "./db.js";
import { fetchGtrProjects } from "./sources/gtr.js";
import { fetchUkriOpportunities } from "./sources/ukri-finder.js";
import { normaliseGtrProject } from "./transforms/normalise-gtr.js";
import { normaliseUkriOpportunity } from "./transforms/normalise-ukri.js";
import { upsertFunder } from "./loaders/upsert-funder.js";
import { upsertSchemes } from "./loaders/upsert-schemes.js";
import { startRun, completeRun } from "./loaders/log-run.js";
import type { NormalisedScheme, RunCounters } from "./types.js";

const program = new Command();
program.name("ingest").description("Grant data ingestion pipeline").version("0.1.0");

/** Ensure all referenced funders exist in DB. Returns slug→id map. */
async function ensureFunders(
  schemes: NormalisedScheme[]
): Promise<Map<string, { id: string; name: string }>> {
  const slugs = [...new Set(schemes.map((s) => s.funder_slug))];
  const map = new Map<string, { id: string; name: string }>();

  for (const slug of slugs) {
    const id = await upsertFunder({
      slug,
      name: slug.toUpperCase().replace(/-/g, " "),
      website: null,
      type: slug.match(/^(ahrc|bbsrc|epsrc|esrc|mrc|nerc|stfc|innovate-uk|research-england)$/)
        ? "ukri_council"
        : null,
      disciplines: [],
      source_metadata: {},
    });
    map.set(slug, { id, name: slug });
  }

  return map;
}

// --- GtR command ---
program
  .command("gtr")
  .description("Ingest awarded grants from UKRI Gateway to Research API")
  .option("--council <name>", "Filter by UKRI council (e.g. ahrc, epsrc)")
  .option("--all", "Ingest from all UKRI councils")
  .option("--limit <n>", "Max projects to fetch", parseInt)
  .action(async (opts) => {
    const councils = opts.all
      ? ["ahrc", "bbsrc", "epsrc", "esrc", "mrc", "nerc", "stfc", "innovate-uk"]
      : opts.council
        ? [opts.council]
        : [];

    if (councils.length === 0) {
      console.error("Specify --council <name> or --all");
      process.exit(1);
    }

    for (const council of councils) {
      console.log(`\nIngesting GtR: ${council}`);
      const runId = await startRun("gtr", council);
      const allSchemes: NormalisedScheme[] = [];

      try {
        for await (const batch of fetchGtrProjects({
          council,
          limit: opts.limit,
        })) {
          const normalised = batch.map(normaliseGtrProject);
          allSchemes.push(...normalised);
        }

        const funderMap = await ensureFunders(allSchemes);
        const counters = await upsertSchemes(allSchemes, funderMap);

        console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
        await completeRun(runId, "success", counters);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Error: ${msg}`);
        await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
      }
    }
  });

// --- UKRI Funding Finder command ---
program
  .command("ukri-finder")
  .description("Ingest open opportunities from UKRI Funding Finder")
  .option("--council <name>", "Filter by council slug")
  .action(async (opts) => {
    console.log("\nIngesting UKRI Funding Finder");
    const runId = await startRun("ukri_funding_finder", opts.council);

    try {
      const raw = await fetchUkriOpportunities(opts.council);
      const schemes = raw.map(normaliseUkriOpportunity);

      const funderMap = await ensureFunders(schemes);
      const counters = await upsertSchemes(schemes, funderMap);

      console.log(`  Done: ${counters.created} created, ${counters.updated} updated, ${counters.skipped} skipped`);
      await completeRun(runId, "success", counters);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${msg}`);
      await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, msg);
    }
  });

// --- All command ---
program
  .command("all")
  .description("Ingest from all configured sources")
  .option("--limit <n>", "Max projects per GtR council", parseInt)
  .action(async (opts) => {
    // Run GtR for all councils
    await program.parseAsync(["node", "cli", "gtr", "--all", ...(opts.limit ? ["--limit", String(opts.limit)] : [])]);
    // Run UKRI Funding Finder
    await program.parseAsync(["node", "cli", "ukri-finder"]);
  });

// --- Status command ---
program
  .command("status")
  .description("Show last ingestion run per source")
  .action(async () => {
    const { data, error } = await supabase
      .from("ingestion_runs")
      .select("source, funder_slug, status, records_created, records_updated, started_at")
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error(`Failed to fetch status: ${error.message}`);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log("No ingestion runs found.");
      return;
    }

    console.log("\nRecent ingestion runs:");
    console.log("─".repeat(80));
    for (const run of data) {
      const funder = run.funder_slug ? ` (${run.funder_slug})` : "";
      const counts = `+${run.records_created} created, ~${run.records_updated} updated`;
      console.log(`  ${run.source}${funder}  ${run.status}  ${counts}  ${run.started_at}`);
    }
  });

program.parse();
```

- [ ] **Step 2: Verify CLI help works**

```bash
npm run -w data-pipeline ingest -- --help
```

Expected: Shows command list (gtr, ukri-finder, all, status).

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/src/cli.ts
git commit -m "feat: add CLI entry point with gtr, ukri-finder, all, and status commands"
```

---

### Task 9: Environment Setup and .env.example

**Files:**
- Create: `data-pipeline/.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create .env.example**

```
# Supabase — data-pipeline
# Get these from your Supabase project settings → API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [ ] **Step 2: Add data-pipeline .env to .gitignore**

Add this line to the root `.gitignore`:

```
data-pipeline/.env
```

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/.env.example .gitignore
git commit -m "chore: add .env.example for data pipeline and update .gitignore"
```

---

### Task 10: Run All Tests and Final Verification

- [ ] **Step 1: Run the full test suite**

```bash
npm run -w data-pipeline test
```

Expected: All tests pass (slugify: 4, parse-amounts: 7, parse-dates: 7, normalise-gtr: 7 = 25 total).

- [ ] **Step 2: Verify CLI loads without errors (requires env vars)**

```bash
SUPABASE_URL=https://example.supabase.co SUPABASE_SERVICE_ROLE_KEY=fake npm run -w data-pipeline ingest -- --help
```

Expected: Shows help text without crashing (Supabase client creates lazily, won't error on invalid key until a query runs).

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete data-pipeline package — grant database ingestion pipeline"
```

---

## Post-Implementation: Manual Steps

After all tasks are complete, the user needs to:

1. **Create a Supabase project** at https://supabase.com/dashboard
2. **Run the migration** — paste `001_grant_schema.sql` into the SQL Editor
3. **Copy env vars** — `cp data-pipeline/.env.example data-pipeline/.env` and fill in real values
4. **Test ingestion** — `npm run -w data-pipeline ingest -- gtr --council ahrc --limit 10`
5. **Check data** — verify rows in Supabase Table Editor
