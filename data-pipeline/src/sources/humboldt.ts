import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawHumboldtGrant } from "../transforms/normalise-humboldt.js";

const BASE_URL = "https://www.humboldt-foundation.de";

/**
 * Key Humboldt Foundation sponsorship programmes.
 * All pages are TYPO3 CMS server-rendered — no JS required.
 */
const PROGRAMME_PAGES = [
  {
    url: `${BASE_URL}/en/apply/sponsorship-programmes/humboldt-research-fellowship`,
    defaultTitle: "Humboldt Research Fellowship",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/en/apply/sponsorship-programmes/humboldt-research-award`,
    defaultTitle: "Humboldt Research Award",
    fundingType: "award",
  },
  {
    url: `${BASE_URL}/en/apply/sponsorship-programmes/georg-forster-research-fellowship`,
    defaultTitle: "Georg Forster Research Fellowship",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/en/apply/sponsorship-programmes/feodor-lynen-research-fellowship`,
    defaultTitle: "Feodor Lynen Research Fellowship",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/en/apply/sponsorship-programmes/philipp-schwartz-initiative`,
    defaultTitle: "Philipp Schwartz Initiative",
    fundingType: "fellowship",
  },
];

/**
 * Extract the first amount-containing sentence from the page.
 * Amounts appear in inline `<p>` tags: "The monthly fellowship amount is €3,000..."
 */
function extractAmount($: ReturnType<typeof cheerio.load>): string | null {
  let amountRaw: string | null = null;
  $("p").each((_i, el) => {
    if (amountRaw) return;
    const text = $(el).text().trim();
    if (/€[\d,.]/.test(text) && text.length < 300) {
      amountRaw = text;
    }
  });
  return amountRaw;
}

/**
 * Derive status and deadline text from the page content.
 *
 * Patterns observed:
 *  - Rolling: "There is no closing date" or selection committee meets X times/year
 *  - Closed:  "The application deadline has expired"
 *  - Open call (fixed): explicit date near "deadline"
 */
function extractDeadlineAndStatus(
  $: ReturnType<typeof cheerio.load>
): { status: string; deadlineRaw: string | null } {
  const bodyText = $("main, article, body").text();

  if (/application deadline has expired/i.test(bodyText)) {
    return { status: "closed", deadlineRaw: "Application deadline has expired" };
  }

  if (/no closing date|there is no.*closing/i.test(bodyText)) {
    return { status: "open", deadlineRaw: "Rolling — no closing date; selection committee meets 3x per year" };
  }

  // Look for a specific deadline date in a <strong> or near "deadline" heading
  let deadlineRaw: string | null = null;
  $("strong, b").each((_i, el) => {
    if (deadlineRaw) return;
    const text = $(el).text().trim();
    if (/\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}/.test(text)) {
      deadlineRaw = text;
    }
  });

  if (deadlineRaw) {
    return { status: "open", deadlineRaw };
  }

  // Default: assume open (most Humboldt programmes are rolling)
  return { status: "open", deadlineRaw: null };
}

function extractSection($: ReturnType<typeof cheerio.load>, headingPattern: RegExp): string | null {
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

export function parseHumboldtPage(
  html: string,
  pageUrl: string,
  defaultTitle: string,
  fundingType: string
): RawHumboldtGrant {
  const $ = cheerio.load(html);

  // Title from <title> tag; strip " | Alexander von Humboldt-Stiftung" suffix
  const rawTitle = $("title").first().text().trim();
  const title = rawTitle.split("|")[0].trim() || defaultTitle;

  // Description: multi-paragraph from main content area
  const descParts: string[] = [];
  const selectors = ["main p", "article p", ".content p", "body p"];
  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 60 && !/cookie|javascript|browser/i.test(text)) {
        descParts.push(text);
      }
    });
    if (descParts.length > 0) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility from dedicated section
  const eligibility = extractSection($, /who can apply|eligibility|requirements|prerequisites/i);

  const amountRaw = extractAmount($);
  const { status, deadlineRaw } = extractDeadlineAndStatus($);

  return {
    title,
    url: pageUrl,
    fundingType,
    status,
    deadlineRaw,
    amountRaw,
    description,
    eligibility,
  };
}

export async function fetchHumboldtGrants(): Promise<RawHumboldtGrant[]> {
  const grants: RawHumboldtGrant[] = [];

  for (const { url, defaultTitle, fundingType } of PROGRAMME_PAGES) {
    console.log(`  Fetching Humboldt programme: ${url}`);
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.warn(`  Humboldt: ${url} returned ${response.status} — skipping`);
      continue;
    }
    const html = await response.text();
    grants.push(parseHumboldtPage(html, url, defaultTitle, fundingType));
  }

  console.log(`  Found ${grants.length} Humboldt Foundation grant entries`);
  return grants;
}
