// Server-only module. Called after each scan agent run to persist discoveries to Supabase.
import {
  upsertFunderFromDiscovery,
  upsertOpportunityFromDiscovery,
  updateHarvestStatus,
} from "@/lib/opportunity-store";

export interface DiscoveredManifestEntry {
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
 * Persist in-memory discovered manifest entries to Supabase.
 *
 * Per-funder errors are caught so a single bad entry doesn't abort the rest.
 */
export async function persistDiscoveredResults(
  entries: DiscoveredManifestEntry[],
  discoveryContext: Record<string, unknown>
): Promise<void> {
  if (entries.length === 0) return;

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
