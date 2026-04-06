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
export async function buildScanDbContext(staleDays = 7): Promise<string> {
  try {
    const [{ toHarvest, fresh }, existingSlugs] = await Promise.all([
      getFunderSourceUrls(staleDays),
      getExistingFunderSlugs(),
    ]);

    if (toHarvest.length === 0 && fresh.length === 0 && existingSlugs.length === 0) return "";

    const parts: string[] = [];

    if (toHarvest.length > 0) {
      parts.push(
        `Database-sourced funders to harvest (not yet harvested or stale — older than ${staleDays} days):\n` +
          toHarvest.map((s) => `${s.slug} | ${s.url}`).join("\n")
      );
    }

    if (fresh.length > 0) {
      // Fresh sources: already harvested recently — pass slugs only for dedup, skip re-fetching
      parts.push(
        `Recently harvested funders (DO NOT re-fetch — already up to date. Use slugs for dedup only):\n` +
          fresh.map((s) => s.slug).join(", ")
      );
    }

    if (existingSlugs.length > 0) {
      parts.push(
        "Existing funder slugs in database (skip re-extracting opportunities already captured):\n" +
          existingSlugs.join(", ")
      );
    }

    return "\n\n" + parts.join("\n\n");
  } catch (err) {
    console.warn("[scan-db-context] Failed to query DB for context:", err);
    return "";
  }
}
