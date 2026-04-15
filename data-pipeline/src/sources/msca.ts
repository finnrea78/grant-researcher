import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawMSCAScheme } from "../transforms/normalise-msca.js";

const BASE_URL = "https://marie-sklodowska-curie-actions.ec.europa.eu";

// Known MSCA action types — these are stable annual programmes
const MSCA_ACTIONS = [
  { title: "MSCA Doctoral Networks", slug: "doctoral-networks" },
  { title: "MSCA Postdoctoral Fellowships", slug: "postdoctoral-fellowships" },
  { title: "MSCA Staff Exchanges", slug: "staff-exchanges" },
  { title: "MSCA COFUND", slug: "cofund" },
] as const;

async function fetchActionDescription(slug: string): Promise<string | null> {
  const url = `${BASE_URL}/actions/${slug}`;
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    let description: string | null = null;
    $("main p, .ecl-paragraph, .field--name-body p").each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text && text.length > 60 && !description) {
        description = text;
      }
    });
    return description;
  } catch {
    return null;
  }
}

export async function fetchMSCASchemes(): Promise<RawMSCAScheme[]> {
  console.log(`  Fetching MSCA action types`);

  // Verify base URL is reachable
  const checkResp = await fetchWithRetry(`${BASE_URL}/actions/postdoctoral-fellowships`);
  if (!checkResp.ok) {
    throw new Error(`MSCA error: ${checkResp.status} ${checkResp.statusText}`);
  }

  // Fetch descriptions for all actions in parallel
  const results = await Promise.all(
    MSCA_ACTIONS.map(async (action) => {
      const description = await fetchActionDescription(action.slug);
      return {
        title: action.title,
        url: `${BASE_URL}/actions/${action.slug}`,
        status: "open" as const,
        description,
      };
    })
  );

  console.log(`  Found ${results.length} MSCA action types`);
  return results;
}
