// Server-only module. Builds the DB-sourced context block injected into the
// scanner agent's prompt so it can re-harvest previously discovered funders.
import {
  getStaleFunders,
  getExistingFunderSlugs,
} from "@/lib/opportunity-store";
import type { ScanPlanEntry } from "@/lib/scan-extract";

/**
 * Return funders that need re-scraping: never harvested, harvested 30+ days ago,
 * or all their opportunities have expired deadlines.
 */
export async function getScanUrlList(): Promise<ScanPlanEntry[]> {
  const stale = await getStaleFunders();
  return stale.map((s) => ({ slug: s.slug, url: s.url }));
}

/**
 * Build a context block for the discovery agent listing existing funder slugs
 * so it can avoid rediscovering them.
 */
export async function buildScanDbContext(): Promise<string> {
  try {
    const existingSlugs = await getExistingFunderSlugs();

    if (existingSlugs.length === 0) return "";

    return "\n\nExisting funder slugs in database (do NOT rediscover these):\n" +
      existingSlugs.join(", ");
  } catch (err) {
    console.warn("[scan-db-context] Failed to query DB for context:", err);
    return "";
  }
}
