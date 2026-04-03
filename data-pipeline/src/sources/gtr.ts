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
