import type { GtrApiResponse, GtrProject } from "../types.js";

const BASE_URL = "https://gtr.ukri.org/gtr/api/projects";
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
 * Fetch projects from the GtR REST API (/gtr/api/projects).
 * Paginates through results, yielding batches of projects.
 * Filters by council name via the q= search parameter.
 */
export async function* fetchGtrProjects(
  opts: GtrFetchOptions
): AsyncGenerator<GtrProject[]> {
  const pageSize = 100;
  let page = 1;
  let fetched = 0;
  const limit = opts.limit ?? Infinity;
  const term = opts.term ?? opts.council ?? "";

  while (fetched < limit) {
    const url = `${BASE_URL}?q=${encodeURIComponent(term)}&page=${page}&size=${pageSize}`;
    console.log(`  Fetching GtR page ${page}: ${url}`);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`GtR API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      throw new Error(
        `GtR API returned ${contentType} — JSON not supported. Raw snippet: ${(await response.text()).slice(0, 200)}`
      );
    }

    const json = (await response.json()) as GtrApiResponse;
    const raw = json.project;
    const projects: GtrProject[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

    if (projects.length === 0) break;

    const batch = projects.slice(0, limit - fetched);
    yield batch;

    fetched += batch.length;
    if (page >= json.totalPages) break;
    page++;

    await sleep(DELAY_MS);
  }

  console.log(`  Fetched ${fetched} projects from GtR`);
}
