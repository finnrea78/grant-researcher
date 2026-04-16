import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawGeneticsSocietyGrant } from "../transforms/normalise-genetics-society.js";

const BASE_URL = "https://genetics.org.uk";

/**
 * Genetics Society grant scheme pages.
 * Title, deadline, and amount are embedded in plain <p>/<li> prose — no
 * structured HTML wrappers.  Schemes 4 and 11 share the same URL.
 */
const SCHEME_PAGES = [
  `${BASE_URL}/grants/junior-scientist-conference-grants/`,
  `${BASE_URL}/grants/training-grant/`,
  `${BASE_URL}/grants/heredity-fieldwork-grant/`,
  `${BASE_URL}/grants/summer-studentships/`,
  `${BASE_URL}/grants/research-access-placements/`,
  `${BASE_URL}/grants/comm-your-sci/`,
  `${BASE_URL}/grants/carers-award/`,
  `${BASE_URL}/grants/one-off-meeting-grant/`,
  `${BASE_URL}/grants/public-engement-grant/`,
  `${BASE_URL}/grants/new-special-interest-group/`,
];

/** Strip ordinal suffixes: "1st" → "1", "15th" → "15" */
function stripOrdinal(s: string): string {
  return s.replace(/(\d+)(?:st|nd|rd|th)\b/gi, "$1");
}

export function parseGeneticsSocietyPage(
  html: string,
  pageUrl: string
): RawGeneticsSocietyGrant | null {
  const $ = cheerio.load(html);

  // Title: most pages use <h2> as the main heading; fall back to <h1>
  const title = $("h1, h2").first().text().trim();
  if (!title) return null;

  // Description: collect substantial paragraphs from the page content
  const descParts: string[] = [];
  $("p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60 && !/^(apply|log in|sign in|mySociety)/i.test(text)) {
      descParts.push(text);
    }
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility: extract section under eligibility heading or collect eligibility-related paragraphs
  let eligibility: string | null = null;
  $("h2, h3, h4").each((_i, el) => {
    if (eligibility !== null) return;
    if (!/eligibility|who can apply|who is eligible/i.test($(el).text().trim())) return;
    const parts: string[] = [];
    let sibling = $(el).next();
    while (sibling.length && !sibling.is("h2, h3, h4")) {
      const text = sibling.text().trim();
      if (text) parts.push(text);
      sibling = sibling.next();
    }
    if (parts.length > 0) eligibility = parts.join("\n\n").slice(0, 1500);
  });

  // Deadline: first <p> containing "deadline" with a parseable date
  let deadlineRaw: string | null = null;
  let deadlineFound = false;
  $("p, li").each((_i, el) => {
    if (deadlineFound) return;
    const text = $(el).text();
    if (!/deadline/i.test(text)) return;
    // Match "1st February 2024", "31st March 2026", etc.
    const match = text.match(/(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i);
    if (match) {
      deadlineRaw = stripOrdinal(match[1]);
      deadlineFound = true;
      return;
    }
    // Also match "1st February" without year (rolling deadlines)
    const partialMatch = text.match(/(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December))/i);
    if (partialMatch) {
      deadlineRaw = stripOrdinal(partialMatch[1]); // no year → parseDate will return null
      deadlineFound = true;
    }
  });

  // Amount: first £ figure in <p> or <li>
  let amountRaw: string | null = null;
  $("p, li").each((_i, el) => {
    if (amountRaw) return;
    const text = $(el).text().trim();
    const match = text.match(/(?:up\s+to\s+|of\s+|awards?\s+of\s+)?(£[\d,]+(?:\/week)?)/i);
    if (match) amountRaw = match[0];
  });

  // Status: infer from deadline date compared to today
  // Note: cast required — TS 5.9 narrows closure-assigned lets to initializer type (null).
  const deadlineForStatus = deadlineRaw as string | null;
  let status = "open";
  if (deadlineForStatus) {
    // If the raw date contains a year, compare to today
    const yearMatch = deadlineForStatus.match(/\d{4}/);
    if (yearMatch) {
      const deadlineDate = new Date(deadlineForStatus);
      if (!isNaN(deadlineDate.getTime()) && deadlineDate < new Date()) {
        status = "closed";
      }
    }
    // No year → treat as rolling (open)
  }

  return {
    title,
    url: pageUrl,
    status,
    deadlineRaw,
    amountRaw,
    description,
    eligibility,
  };
}

export async function fetchGeneticsSocietyGrants(): Promise<RawGeneticsSocietyGrant[]> {
  const grants: RawGeneticsSocietyGrant[] = [];

  for (const url of SCHEME_PAGES) {
    console.log(`  Fetching Genetics Society scheme: ${url}`);
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.warn(`  Genetics Society: ${url} returned ${response.status} — skipping`);
      continue;
    }
    const html = await response.text();
    const grant = parseGeneticsSocietyPage(html, url);
    if (grant) grants.push(grant);
  }

  console.log(`  Found ${grants.length} Genetics Society grant entries`);
  return grants;
}
