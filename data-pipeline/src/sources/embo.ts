import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawEmboGrant } from "../transforms/normalise-embo.js";

const BASE_URL = "https://www.embo.org";

/**
 * Known EMBO programme pages.  The index page at /funding-awards/ is
 * navigational only; individual programme pages carry deadline text.
 */
const PROGRAMME_PAGES = [
  {
    url: `${BASE_URL}/funding-awards/postdoctoral-fellowships/`,
    defaultTitle: "EMBO Postdoctoral Fellowships",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/funding-awards/young-investigators/`,
    defaultTitle: "EMBO Young Investigator Programme",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/funding-awards/installation-grants/`,
    defaultTitle: "EMBO Installation Grants",
    fundingType: "grant",
  },
  {
    url: `${BASE_URL}/funding-awards/scientific-exchange-grants/`,
    defaultTitle: "EMBO Scientific Exchange Grants",
    fundingType: "grant",
  },
  {
    url: `${BASE_URL}/funding-awards/travel-grants/`,
    defaultTitle: "EMBO Travel Grants",
    fundingType: "grant",
  },
];

/**
 * Extract deadline text from a programme page.
 * Deadline appears in the first <strong> or <b> tag whose text contains
 * "deadline" or "cutoff".  Rolling programmes say "Applications accepted
 * throughout the year" with no structured date.
 */
function extractDeadline($: ReturnType<typeof cheerio.load>): string | null {
  let deadlineRaw: string | null = null;

  $("strong, b").each((_i, el) => {
    if (deadlineRaw) return;
    const text = $(el).text().trim();
    if (/deadline|cutoff/i.test(text)) {
      deadlineRaw = text;
    }
  });

  // Check for rolling phrasing even without a strong tag
  if (!deadlineRaw) {
    const bodyText = $("main, article, .entry-content, body").text();
    if (/applications accepted throughout the year/i.test(bodyText)) {
      deadlineRaw = "Applications accepted throughout the year (rolling)";
    }
  }

  return deadlineRaw;
}

export function parseEmboPage(
  html: string,
  pageUrl: string,
  defaultTitle: string,
  fundingType: string
): RawEmboGrant {
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim() || defaultTitle;
  const description = $("h1").first().nextAll("p").first().text().trim() || null;
  const deadlineRaw = extractDeadline($);

  // Derive a parseable date string from the deadline raw text
  // "Friday 10 July 2026, 14:00 CEST" → "10 July 2026"
  // "1 April" → "1 April" (no year, parseDate will return null)
  // "15 April" → "15 April" (no year, parseDate will return null)
  let deadlineDateRaw: string | null = null;
  if (deadlineRaw) {
    const dateMatch = deadlineRaw.match(
      /(\d{1,2}\s+\w+\s+\d{4})/
    );
    if (dateMatch) {
      deadlineDateRaw = dateMatch[1];
    } else {
      // Try "1 April" or "15 April" pattern (no year)
      const noYearMatch = deadlineRaw.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December))\b/i);
      if (noYearMatch) {
        deadlineDateRaw = noYearMatch[1]; // no year — parseDate will return null
      }
    }
  }

  const status =
    !deadlineRaw || /throughout the year|rolling/i.test(deadlineRaw)
      ? "open" // rolling calls are always open
      : "open"; // assume open unless page says otherwise

  return {
    title,
    url: pageUrl,
    fundingType,
    status,
    deadlineRaw,
    deadlineDateRaw,
    description,
  };
}

export async function fetchEmboGrants(): Promise<RawEmboGrant[]> {
  const grants: RawEmboGrant[] = [];

  for (const { url, defaultTitle, fundingType } of PROGRAMME_PAGES) {
    console.log(`  Fetching EMBO programme: ${url}`);
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.warn(`  EMBO: ${url} returned ${response.status} — skipping`);
      continue;
    }
    const html = await response.text();
    grants.push(parseEmboPage(html, url, defaultTitle, fundingType));
  }

  console.log(`  Found ${grants.length} EMBO grant entries`);
  return grants;
}
