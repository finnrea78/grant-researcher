// Server-only module. Builds the DB-sourced context block injected into the
// scanner agent's prompt so it can re-harvest previously discovered funders.
import {
  getFunderSourceUrls,
  getExistingFunderSlugs,
} from "@/lib/opportunity-store";

/**
 * Query Supabase for known funders and build a context block for the scanner prompt.
 *
 * Returns an empty string on error so the scan route can continue without DB context
 * (graceful degradation — scan still works, just doesn't benefit from prior discoveries).
 */
export async function buildScanDbContext(): Promise<string> {
  try {
    const [sourceUrls, existingSlugs] = await Promise.all([
      getFunderSourceUrls(),
      getExistingFunderSlugs(),
    ]);

    if (sourceUrls.length === 0 && existingSlugs.length === 0) return "";

    const parts: string[] = [];

    if (sourceUrls.length > 0) {
      parts.push(
        "Database-sourced funders (harvest these alongside seed URLs):\n" +
          sourceUrls.map((s) => `${s.slug} | ${s.url}`).join("\n")
      );
    }

    if (existingSlugs.length > 0) {
      parts.push(
        "Existing funder slugs (already in database — you may skip re-extracting opportunities whose slug and funder_slug combination already exists):\n" +
          existingSlugs.join(", ")
      );
    }

    return "\n\n" + parts.join("\n\n");
  } catch (err) {
    console.warn("[scan-db-context] Failed to query DB for context:", err);
    return "";
  }
}
