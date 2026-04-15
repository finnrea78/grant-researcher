import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawAcMedSciGrant } from "../transforms/normalise-acmedsci.js";

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

  // Description: first <p> in main content, not a label paragraph
  let description: string | null = null;
  $("main p, article p, div.col p").each((_i, el) => {
    if (description) return;
    const text = $(el).text().trim();
    if (text.length > 40 && !/key dates|apply now|cookie|javascript/i.test(text)) {
      description = text;
    }
  });

  return {
    title,
    url: pageUrl,
    status,
    deadlineRaw,
    amountRaw,
    description,
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
