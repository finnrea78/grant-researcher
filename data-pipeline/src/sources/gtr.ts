import type { GtrApiResponse, GtrProject } from "../types.js";
import { sleep } from "../utils/sleep.js";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";

const BASE_URL = "https://gtr.ukri.org/gtr/api/projects";
const DELAY_MS = 500;

/** Map council slugs to their Lead Funder Name as used in the GtR API. */
export const GTR_COUNCIL_NAMES: Record<string, string> = {
  ahrc: "AHRC",
  bbsrc: "BBSRC",
  epsrc: "EPSRC",
  esrc: "ESRC",
  mrc: "MRC",
  nerc: "NERC",
  stfc: "STFC",
  "innovate-uk": "Innovate UK",
};

export interface GtrFetchOptions {
  council: string;        // slug, e.g. "ahrc"
  limit?: number;
  sinceYear?: number;     // stop when fund_start < this year
}

/**
 * Fetch projects from the GtR REST API using the pro.lf (Lead Funder Name) field filter.
 * Returns all projects for a council, sorted by start date descending (newest first).
 * Stops early if sinceYear is set and a project's fund_start is before that year.
 */
export async function* fetchGtrProjects(
  opts: GtrFetchOptions
): AsyncGenerator<GtrProject[]> {
  const pageSize = 100;
  let page = 1;
  let fetched = 0;
  const limit = opts.limit ?? Infinity;
  const councilName = GTR_COUNCIL_NAMES[opts.council] ?? opts.council.toUpperCase();

  // f=pro.lf: restrict search to Lead Funder Name field
  // sf=pro.sd&so=D: sort by start date descending (newest first)
  const baseUrl = `${BASE_URL}?q=${encodeURIComponent(councilName)}&f=pro.lf&sf=pro.sd&so=D`;

  while (fetched < limit) {
    const url = `${baseUrl}&page=${page}&size=${pageSize}`;
    console.log(`  Fetching GtR page ${page}: ${url}`);

    const response = await fetchWithRetry(url, {
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

    // Early stop: if sinceYear is set, filter out projects before that year
    // Projects are sorted newest-first, so once we hit one before sinceYear, we're done
    if (opts.sinceYear) {
      const cutoff = new Date(opts.sinceYear, 0, 1);
      const filtered: GtrProject[] = [];
      let hitCutoff = false;
      for (const p of projects) {
        // GtR API may return fund start date; use created date as fallback
        const dateStr = p.fund?.start ?? null;
        if (dateStr) {
          const d = new Date(dateStr);
          if (d < cutoff) { hitCutoff = true; break; }
        }
        filtered.push(p);
      }
      const batch = filtered.slice(0, limit - fetched);
      if (batch.length > 0) yield batch;
      fetched += batch.length;
      if (hitCutoff) break;
    } else {
      const batch = projects.slice(0, limit - fetched);
      yield batch;
      fetched += batch.length;
    }

    if (page >= json.totalPages) break;
    page++;

    await sleep(DELAY_MS);
  }

  console.log(`  Fetched ${fetched} projects from GtR`);
}
