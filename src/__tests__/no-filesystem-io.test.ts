/**
 * Phase 7: Verify that API routes in src/app/api/session/ use zero
 * researcher-state filesystem I/O (no reads/writes to researcher-specific
 * paths that should now live in the DB).
 *
 * The scan route is exempt for its shared infrastructure files
 * (_urls.md, _scan-plan.json, _discovered.json) — transient agent working
 * files, not durable researcher state.
 */

import * as fs from "fs";
import * as path from "path";

const SESSION_API_DIR = path.resolve(__dirname, "../app/api/session");

function getRouteFilesSync(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getRouteFilesSync(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.includes(".test.") &&
      !fullPath.includes("__tests__")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// Patterns that indicate a route is doing researcher-specific file I/O.
// These match actual fs function calls, not prompt template strings.
const RESEARCHER_STATE_PATTERNS: Array<[RegExp, string]> = [
  // Direct fs function calls that write or create researcher-specific paths
  [/writeFileSync\s*\(.*(?:intake|profile\.json|publications|researcher-context|enrich-pending|scholar-skip|scan-complete|proposal-intent|matches\.md)/, "writeFileSync to researcher path"],
  [/readFileSync\s*\(.*(?:intake\.json|profile\.json|publications|researcher-context|enrich-pending|proposal-intent|matches\.md)/, "readFileSync researcher path"],
  [/existsSync\s*\(.*(?:intake\.json|profile\.json|publications|researcher-context|enrich-pending|proposal-intent|matches\.md)/, "existsSync researcher path"],
  [/mkdirSync/, "mkdirSync"],
  [/unlinkSync/, "unlinkSync"],
  [/rmSync/, "rmSync"],
];

describe("No researcher-state filesystem I/O in API routes", () => {
  const routeFiles = getRouteFilesSync(SESSION_API_DIR);

  it("finds route files to check", () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  const exemptRoutes = [
    // scan uses transient scan infrastructure files (_urls.md, _scan-plan.json, _discovered.json)
    path.join("scan", "route.ts"),
  ];

  for (const filePath of routeFiles) {
    const relativePath = path.relative(SESSION_API_DIR, filePath);

    if (exemptRoutes.some((exempt) => relativePath.includes(exempt))) continue;

    it(`${relativePath} has no researcher-state fs reads/writes`, () => {
      const source = fs.readFileSync(filePath, "utf-8");

      for (const [pattern, label] of RESEARCHER_STATE_PATTERNS) {
        const match = source.match(pattern);
        if (match) {
          throw new Error(
            `${relativePath} contains researcher-state filesystem reference: "${label}". ` +
            `All researcher state must be read/written via DB store functions.`
          );
        }
      }
    });
  }
});
