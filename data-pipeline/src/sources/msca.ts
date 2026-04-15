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

function extractSection($: cheerio.CheerioAPI, headingPattern: RegExp): string | null {
  let result: string | null = null;
  $("h2, h3, h4").each((_i, el) => {
    if (result !== null) return;
    if (!headingPattern.test($(el).text().trim())) return;
    const parts: string[] = [];
    let sibling = $(el).next();
    while (sibling.length && !sibling.is("h2, h3, h4")) {
      const text = sibling.text().trim();
      if (text) parts.push(text);
      sibling = sibling.next();
    }
    if (parts.length > 0) result = parts.join("\n\n").slice(0, 1500);
  });
  return result;
}

async function fetchActionDetails(slug: string): Promise<{ description: string | null; eligibility: string | null }> {
  const url = `${BASE_URL}/actions/${slug}`;
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return { description: null, eligibility: null };
    const html = await response.text();
    const $ = cheerio.load(html);

    const descParts: string[] = [];
    $("main p, .ecl-paragraph, .field--name-body p, article p").each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 60) descParts.push(text);
    });
    const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

    const eligibility = extractSection($, /eligibility|who can apply|who is eligible|requirements|participation/i);

    return { description, eligibility };
  } catch {
    return { description: null, eligibility: null };
  }
}

export async function fetchMSCASchemes(): Promise<RawMSCAScheme[]> {
  console.log(`  Fetching MSCA action types`);

  // Verify base URL is reachable
  const checkResp = await fetchWithRetry(`${BASE_URL}/actions/postdoctoral-fellowships`);
  if (!checkResp.ok) {
    throw new Error(`MSCA error: ${checkResp.status} ${checkResp.statusText}`);
  }

  // Fetch descriptions and eligibility for all actions in parallel
  const results = await Promise.all(
    MSCA_ACTIONS.map(async (action) => {
      const { description, eligibility } = await fetchActionDetails(action.slug);
      return {
        title: action.title,
        url: `${BASE_URL}/actions/${action.slug}`,
        status: "open" as const,
        description,
        eligibility,
      };
    })
  );

  console.log(`  Found ${results.length} MSCA action types`);
  return results;
}
