import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawAcMedSciGrant } from "../transforms/normalise-acmedsci.js";

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

const BASE_URL = "https://acmedsci.ac.uk";

/**
 * Academy of Medical Sciences scheme pages.
 * All server-rendered pages with a consistent funding-detail section.
 * Some schemes live outside /grant-schemes/ — top-level slugs used where confirmed.
 */
const SCHEME_PAGES = [
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/springboard`, defaultTitle: "Springboard" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/starter-grants`, defaultTitle: "Starter Grants for Clinical Lecturers" },
  { url: `${BASE_URL}/networking-grants`, defaultTitle: "Networking Grants" },
  { url: `${BASE_URL}/cross-sector-experience-awards`, defaultTitle: "Cross-Sector Experience Awards" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/academy-of-medical-sciences-professorship-scheme`, defaultTitle: "AMS Professorship Scheme" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/amr-professorships`, defaultTitle: "Hamied Foundation UK-India AMR Professorships" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/csf`, defaultTitle: "Clinical Scientist Fellowship" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/daniel-turnberg-travel-fellowship`, defaultTitle: "Daniel Turnberg Travel Fellowship" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/newton-advanced-fellowships`, defaultTitle: "Newton Advanced Fellowships" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/newton-international-fellowships`, defaultTitle: "Newton International Fellowships (AMS)" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/springboard-health-of-the-public`, defaultTitle: "Springboard Health of the Public" },
  { url: `${BASE_URL}/grants-and-schemes/grant-schemes/gcrf-networking-grants`, defaultTitle: "GCRF Networking Grants" },
];

/**
 * Extract grant data from a single AcMedSci scheme page.
 *
 * All pages share this structure:
 *  - Open badge: `div.scheme-open` (present only when open)
 *  - Key dates block: `p.sub` (label) + next `<p>` (status/date text)
 *  - Amount: first `<span>` in `.funding-detail .left.match` containing £
 *  - Specific deadline: `<strong>` in body near "deadline" or "by [date]"
 */
export function parseAcMedSciPage(
  html: string,
  pageUrl: string,
  defaultTitle: string
): RawAcMedSciGrant | null {
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim() || defaultTitle;

  // Status: presence of .scheme-open badge is the most reliable signal
  const isOpenBadge = $("div.scheme-open, .scheme-open").length > 0;

  // Key dates text: "p.sub" ("Key dates") → next sibling p
  let keyDatesText = "";
  $("p.sub").each((_i, el) => {
    if (keyDatesText) return;
    const text = $(el).text().trim();
    if (/key dates/i.test(text)) {
      keyDatesText = $(el).next("p").text().trim();
    }
  });

  const isClosed = /closed|no longer/i.test(keyDatesText) && !isOpenBadge;
  const status = isClosed ? "closed" : "open";

  // Amount: first span inside .funding-detail .left.match containing £
  let amountRaw: string | null = null;
  $("div.funding-detail span, div.left.match span").each((_i, el) => {
    if (amountRaw) return;
    const text = $(el).text().trim();
    if (/£/.test(text) && text.length < 300) {
      amountRaw = text;
    }
  });

  // Specific deadline: <strong> in body containing date pattern
  let deadlineRaw: string | null = null;
  $("strong, b").each((_i, el) => {
    if (deadlineRaw) return;
    const text = $(el).text().trim();
    if (/\d{1,2}\s+\w+\s+\d{4}/.test(text)) {
      deadlineRaw = text;
    }
  });

  // Fall back to key dates text if no specific deadline found
  if (!deadlineRaw && keyDatesText) {
    deadlineRaw = keyDatesText;
  }

  // Description: multi-paragraph from main content
  const descParts: string[] = [];
  const selectors = ["main p", "article p", "div.content-body p", "div.col p", "body p"];
  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 60 && !/key dates|apply now|cookie|javascript|scheme-open/i.test(text)) {
        descParts.push(text);
      }
    });
    if (descParts.length > 0) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility
  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

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

export async function fetchAcMedSciGrants(): Promise<RawAcMedSciGrant[]> {
  const grants: RawAcMedSciGrant[] = [];

  for (const { url, defaultTitle } of SCHEME_PAGES) {
    console.log(`  Fetching AcMedSci scheme: ${url}`);
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.warn(`  AcMedSci: ${url} returned ${response.status} — skipping`);
      continue;
    }
    const html = await response.text();
    const grant = parseAcMedSciPage(html, url, defaultTitle);
    if (grant) grants.push(grant);
  }

  console.log(`  Found ${grants.length} AcMedSci scheme entries`);
  return grants;
}
