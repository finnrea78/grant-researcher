// Server-only module. Called after each scan agent run to persist discoveries to Supabase.
import { existsSync, readFileSync } from "fs";
import {
  upsertFunderFromDiscovery,
  upsertOpportunityFromDiscovery,
  updateHarvestStatus,
} from "@/lib/opportunity-store";

interface DiscoveredManifestEntry {
  funder_slug: string;
  funder_name: string;
  source_url: string;
  disciplines: string[];
  opportunities: Array<{
    name: string;
    slug: string;
    status: string | null;
    deadline_raw: string | null;
    deadline_date: string | null;
    amount_raw: string | null;
    amount_min: number | null;
    amount_max: number | null;
    url: string | null;
    funding_type: string | null;
    description: string | null;
    eligibility: string | null;
    scope: string | null;
  }>;
}

/**
 * Read `_discovered.json` written by the scanner agent and upsert all
 * discovered funders and opportunities to Supabase.
 *
 * Per-funder errors are caught so a single bad entry doesn't abort the rest.
 * The manifest file is not deleted — it's overwritten on the next scan.
 */
export async function persistDiscoveredManifest(
  manifestPath: string,
  discoveryContext: Record<string, unknown>
): Promise<void> {
  if (!existsSync(manifestPath)) return;

  let entries: DiscoveredManifestEntry[];
  try {
    entries = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    // Malformed JSON — log and bail without throwing
    console.warn(`[scan-persistence] Failed to parse ${manifestPath} — skipping DB persist`);
    return;
  }

  for (const entry of entries) {
    try {
      const funderId = await upsertFunderFromDiscovery({
        slug: entry.funder_slug,
        name: entry.funder_name,
        website: null,
        source_url: entry.source_url,
        disciplines: entry.disciplines ?? [],
        discovered_by: "agentic_scan",
        discovery_context: discoveryContext,
      });

      for (const opp of entry.opportunities ?? []) {
        await upsertOpportunityFromDiscovery(opp, funderId);
      }

      await updateHarvestStatus(entry.funder_slug, "success");
    } catch (err) {
      console.error(
        `[scan-persistence] Failed to persist funder ${entry.funder_slug}:`,
        err
      );
      await updateHarvestStatus(entry.funder_slug, "failed").catch(() => {});
    }
  }
}
