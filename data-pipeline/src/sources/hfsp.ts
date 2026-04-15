import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawHfspGrant } from "../transforms/normalise-hfsp.js";

const BASE_URL = "https://www.hfsp.org";

const PROGRAMME_PAGES = [
  {
    url: `${BASE_URL}/funding/hfsp-funding/research-grants`,
    defaultTitle: "HFSP Research Grants",
    fundingType: "grant",
  },
  {
    url: `${BASE_URL}/funding/hfsp-funding/postdoctoral-fellowships`,
    defaultTitle: "HFSP Postdoctoral Fellowships",
    fundingType: "fellowship",
  },
];

/**
 * Extract deadlines from the section following an <h4> containing "Deadlines".
 * Returns the first specific date string found (Letter of Intent submission).
 *
 * Two HTML patterns observed:
 *  - Research Grants: `<span style="color:#000000;"><strong>DD Month YYYY</strong></span>`
 *    inside `<p>` siblings of the h4.
 *  - Postdoctoral Fellowships: `<strong>Month DD, YYYY</strong>` inside `<li>` siblings.
 */
function extractDeadlines(
  $: ReturnType<typeof cheerio.load>,
  $h4: cheerio.Cheerio<cheerio.Element>
): { deadlineRaw: string | null; allDates: string[] } {
  const allDates: string[] = [];

  // Collect all siblings after the h4 until the next h4 or h3/h2
  const $siblings = $h4.nextUntil("h4, h3, h2");

  $siblings.find("strong").each((_i, el) => {
    const text = $(el).text().trim();
    // Match "26 March 2026", "March 26, 2026", "May 12, 2026"
    if (/\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},\s+\d{4}/.test(text)) {
      allDates.push(text);
    }
  });

  return {
    deadlineRaw: allDates[0] ?? null,
    allDates,
  };
}

export function parseHfspPage(
  html: string,
  pageUrl: string,
  defaultTitle: string,
  fundingType: string
): RawHfspGrant {
  const $ = cheerio.load(html);

  // Title from <title> tag ("Research Grants | Human Frontier Science Program")
  const rawTitle = $("title").first().text().trim();
  const title = rawTitle.split("|")[0].trim() || defaultTitle;

  // Description: first substantial <p> in the main content (not nav/header)
  // Use the first <p> that contains more than 30 chars and isn't a nav element
  let description: string | null = null;
  $("main p, article p, div.field p, div.node-content p, div p").each((_i, el) => {
    if (description) return;
    const text = $(el).text().trim();
    if (text.length > 40 && !/cookie|navigation|javascript/i.test(text)) {
      description = text;
    }
  });

  // Find h4 containing "Deadlines"
  let deadlineRaw: string | null = null;
  let allDates: string[] = [];

  $("h4").each((_i, el) => {
    if (deadlineRaw !== null) return;
    const $h4 = $(el);
    if (/deadlines/i.test($h4.text())) {
      const result = extractDeadlines($, $h4);
      deadlineRaw = result.deadlineRaw;
      allDates = result.allDates;
    }
  });

  return {
    title,
    url: pageUrl,
    fundingType,
    status: "open",
    deadlineRaw,
    allDates,
    description,
  };
}

export async function fetchHfspGrants(): Promise<RawHfspGrant[]> {
  const grants: RawHfspGrant[] = [];

  for (const { url, defaultTitle, fundingType } of PROGRAMME_PAGES) {
    console.log(`  Fetching HFSP programme: ${url}`);
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.warn(`  HFSP: ${url} returned ${response.status} — skipping`);
      continue;
    }
    const html = await response.text();
    grants.push(parseHfspPage(html, url, defaultTitle, fundingType));
  }

  console.log(`  Found ${grants.length} HFSP grant entries`);
  return grants;
}
