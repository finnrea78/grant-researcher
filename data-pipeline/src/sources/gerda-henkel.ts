import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawGerdaHenkelGrant } from "../transforms/normalise-gerda-henkel.js";

const BASE_URL = "https://www.gerda-henkel-stiftung.de";

/**
 * Gerda Henkel Foundation funding programmes — historical humanities focus
 * (history, archaeology, art history, historical Islamic studies, history of law,
 * history of science). All pages are server-rendered HTML (TYPO3-style).
 *
 * Most programmes are rolling: applications accepted at any time and reviewed
 * by the Board of Trustees at periodic meetings.
 */
const PROGRAMME_PAGES = [
  {
    url: `${BASE_URL}/en/researchscholarships`,
    defaultTitle: "Research Scholarships",
    fundingType: "scholarship",
  },
  {
    url: `${BASE_URL}/en/grants_projects`,
    defaultTitle: "Research Projects",
    fundingType: "research_grant",
  },
  {
    url: `${BASE_URL}/en/phd-scholarships`,
    defaultTitle: "PhD Scholarships",
    fundingType: "scholarship",
  },
  {
    url: `${BASE_URL}/en/scholars-at-risk-eng`,
    defaultTitle: "Funding Opportunities for Scholars at Risk",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/en/forced_migration`,
    defaultTitle: "Forced Migration",
    fundingType: "research_grant",
  },
  {
    url: `${BASE_URL}/en/lost_cities`,
    defaultTitle: "Lost Cities",
    fundingType: "research_grant",
  },
  {
    url: `${BASE_URL}/en/democracy`,
    defaultTitle: "Funding Programme Democracy",
    fundingType: "research_grant",
  },
];

/**
 * Extract the first amount-containing paragraph. Gerda Henkel programmes
 * quote monthly stipends (e.g. "€2,760 monthly") or project lump sums.
 */
function extractAmount($: ReturnType<typeof cheerio.load>): string | null {
  let amountRaw: string | null = null;
  $("p, li").each((_i, el) => {
    if (amountRaw) return;
    const text = $(el).text().trim();
    if (/€[\d,.]/.test(text) && text.length < 400) {
      amountRaw = text;
    }
  });
  return amountRaw;
}

/**
 * Derive status and deadline. Gerda Henkel patterns:
 *  - Rolling: "applications can be submitted at any time" / "no application deadline"
 *  - Closed:  "application deadline has expired" / "next call expected"
 *  - Fixed:   explicit "deadline: <date>"
 */
function extractDeadlineAndStatus(
  $: ReturnType<typeof cheerio.load>
): { status: string; deadlineRaw: string | null } {
  const bodyText = $("main, article, body").text();

  if (/application deadline has expired|next call (will be|is) expected|currently closed/i.test(bodyText)) {
    return { status: "closed", deadlineRaw: "Application deadline has expired" };
  }

  if (/at any time|no (application )?deadline|applications are accepted on a rolling/i.test(bodyText)) {
    return {
      status: "open",
      deadlineRaw: "Rolling — applications accepted at any time; reviewed by Board of Trustees at periodic meetings",
    };
  }

  // Look for a specific deadline date in <strong>/<b> tags or near "deadline"
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

  // Default: most Gerda Henkel programmes are rolling
  return { status: "open", deadlineRaw: null };
}

function extractSection(
  $: ReturnType<typeof cheerio.load>,
  headingPattern: RegExp
): string | null {
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

export function parseGerdaHenkelPage(
  html: string,
  pageUrl: string,
  defaultTitle: string,
  fundingType: string
): RawGerdaHenkelGrant {
  const $ = cheerio.load(html);

  // Title from <title> tag; strip " | Gerda Henkel Foundation" suffix
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
  const eligibility = extractSection(
    $,
    /who can apply|eligibility|requirements|prerequisites|target group/i
  );

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

export async function fetchGerdaHenkelGrants(): Promise<RawGerdaHenkelGrant[]> {
  const grants: RawGerdaHenkelGrant[] = [];

  for (const { url, defaultTitle, fundingType } of PROGRAMME_PAGES) {
    console.log(`  Fetching Gerda Henkel programme: ${url}`);
    const response = await fetchWithRetry(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      console.warn(`  Gerda Henkel: ${url} returned ${response.status} — skipping`);
      continue;
    }
    const html = await response.text();
    grants.push(parseGerdaHenkelPage(html, url, defaultTitle, fundingType));
  }

  console.log(`  Found ${grants.length} Gerda Henkel Foundation grant entries`);
  return grants;
}
