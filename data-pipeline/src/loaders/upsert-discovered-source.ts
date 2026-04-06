// data-pipeline/src/loaders/upsert-discovered-source.ts
// Upsert a funder with its discovery source URL — used by the seed-sources CLI command.
import { readFileSync } from "fs";
import { supabase } from "@grant-researcher/db";

export interface DiscoveredSourceInput {
  slug: string;
  source_url: string;
  discovered_by: "manual" | "pipeline" | "agentic_scan";
}

/**
 * Upsert a single funder source URL into the funders table.
 * Only sets `source_url` and `discovered_by` — does not overwrite name/type/disciplines
 * if the funder row already exists.
 */
export async function upsertDiscoveredSource(
  source: DiscoveredSourceInput
): Promise<string> {
  const { data, error } = await supabase
    .from("funders")
    .upsert(
      {
        slug: source.slug,
        name: source.slug.toUpperCase().replace(/-/g, " "),
        source_url: source.source_url,
        discovered_by: source.discovered_by,
        website: null,
        type: null,
        disciplines: [],
        source_metadata: {},
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`Failed to upsert source ${source.slug}: ${error.message}`);
  return data.id;
}

/**
 * Parse `_urls.md` and upsert each funder slug + URL into the funders table
 * with `discovered_by: 'manual'`. Returns the count of successfully seeded rows.
 */
export async function seedSourcesFromUrlList(urlsMdPath: string): Promise<number> {
  const content = readFileSync(urlsMdPath, "utf-8");
  const lines = content.split("\n");

  // Only process lines matching the `slug | URL` pattern (ignores headers, blanks, etc.)
  const entries = lines
    .map((line) => line.trim())
    .filter((line) => /^[\w-]+\s*\|\s*https?:\/\/.+/.test(line))
    .map((line) => {
      const [slug, url] = line.split("|").map((s) => s.trim());
      return { slug, source_url: url, discovered_by: "manual" as const };
    });

  let count = 0;
  for (const entry of entries) {
    await upsertDiscoveredSource(entry);
    count++;
  }
  return count;
}
