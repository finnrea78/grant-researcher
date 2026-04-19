import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawGerdaHenkelScheme } from "../transforms/normalise-gerda-henkel.js";

const BASE_URL = "https://www.gerda-henkel-stiftung.de";
const DETAIL_DELAY_MS = 400;

const PROGRAMME_PAGES: { path: string; title: string; fundingType: string }[] = [
  {
    path: "/en/grants_projects",
    title: "General Research Grants: Projects",
    fundingType: "grant",
  },
  {
    path: "/en/researchscholarships",
    title: "General Research Grants: Scholarships",
    fundingType: "fellowship",
  },
  {
    path: "/en/phd-scholarships",
    title: "PhD Scholarships",
    fundingType: "fellowship",
  },
  {
    path: "/en/lost_cities",
    title: "Special Programme: Lost Cities",
    fundingType: "grant",
  },
  {
    path: "/en/forced_migration",
    title: "Special Programme: Forced Migration",
    fundingType: "grant",
  },
  {
    path: "/en/scholars-at-risk-eng",
    title: "Scholars at Risk",
    fundingType: "fellowship",
  },
];

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

export function parseGerdaHenkelPage(
  html: string,
  defaultTitle: string,
  fundingType: string,
  pageUrl: string
): RawGerdaHenkelScheme {
  const $ = cheerio.load(html);

  // Title from h1 (falls back to defaultTitle)
  const h1Text = $("h1").first().text().trim();
  const title = h1Text || defaultTitle;

  // Description: collect substantial paragraphs from main content area
  const descParts: string[] = [];
  const selectors = [".main-content p", "main p", "article p", ".content p", "body p"];
  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 80 && !descParts.includes(text)) descParts.push(text);
    });
    if (descParts.length >= 3) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility
  const eligibility = extractSection($, /eligibility|who can apply|who may apply|requirements/i);

  // Amount: find highest recurring EUR figure in the body (monthly scholarship rate)
  const bodyText = $("body").text();
  let amountRaw: string | null = null;
  const euroMatches = [...bodyText.matchAll(/(\d[\d,. ]*)\s*euro/gi)];
  if (euroMatches.length > 0) {
    // Take the largest amount as representative (senior researcher rate or max grant)
    let maxVal = 0;
    let maxRaw = "";
    for (const m of euroMatches) {
      const val = parseFloat(m[1].replace(/[,\s]/g, ""));
      if (!isNaN(val) && val > maxVal) {
        maxVal = val;
        maxRaw = `€${m[1].trim()}`;
      }
    }
    if (maxRaw) amountRaw = maxRaw;
  }

  // Deadline: find text containing "deadline" followed by a date
  let deadlineRaw: string | null = null;
  const deadlinePatterns = [
    /deadline[^.]*?(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    /deadline[^.]*?(\d{4}-\d{2}-\d{2})/i,
    /next deadline[^.]*?(\d{1,2}\s+\w+\s+\d{4})/i,
    // "April 29, 2026" US format on some pages
    /deadline[^.]*?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const pattern of deadlinePatterns) {
    const m = bodyText.match(pattern);
    if (m) {
      deadlineRaw = m[1].trim();
      break;
    }
  }

  // Status: rolling if "rolling" or "no deadline" or "continuously" in body, otherwise derive from deadline
  let status: string;
  const lowerBody = bodyText.toLowerCase();
  const isRolling = /rolling|no deadline|continuously|year[- ]round|at any time/i.test(lowerBody);

  if (isRolling && !deadlineRaw) {
    status = "open";
  } else if (/concluded|no longer accepting|programme.*ended|closed.*programme/i.test(bodyText)) {
    status = "closed";
  } else {
    status = "open"; // Default open; normaliser will refine by deadline date
  }

  return {
    title,
    url: pageUrl,
    deadlineRaw,
    description,
    eligibility,
    amountRaw,
    fundingType,
    status,
  };
}

export async function fetchGerdaHenkelSchemes(): Promise<RawGerdaHenkelScheme[]> {
  console.log(`  Fetching Gerda Henkel Foundation programmes (${PROGRAMME_PAGES.length} pages)`);

  const schemes: RawGerdaHenkelScheme[] = [];

  for (const { path, title, fundingType } of PROGRAMME_PAGES) {
    const url = `${BASE_URL}${path}`;
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(url);
      if (!res.ok) {
        console.warn(`  Gerda Henkel: ${res.status} on ${url}`);
        continue;
      }
      const html = await res.text();
      const scheme = parseGerdaHenkelPage(html, title, fundingType, url);
      schemes.push(scheme);
      console.log(`  Found: ${scheme.title} (deadline: ${scheme.deadlineRaw ?? "rolling"})`);
    } catch (err) {
      console.warn(`  Gerda Henkel: fetch error on ${url}: ${err}`);
    }
  }

  return schemes;
}
