import * as cheerio from "cheerio";
import { sleep } from "../utils/sleep.js";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";

const BASE_URL = "https://www.ukri.org/opportunity/";
const DETAIL_DELAY_MS = 300;

export interface RawUkriOpportunity {
  title: string;
  url: string;
  council: string | null;
  closingDate: string | null;
  fundingAmount: string | null;
  status: string | null;
  fundingType: string | null;
  description: string | null;
  eligibility: string | null;
  scope: string | null;
}

function parsePageOpportunities($: cheerio.CheerioAPI, pageUrl: string): RawUkriOpportunity[] {
  const opportunities: RawUkriOpportunity[] = [];

  $("article, .opportunity-item, .listing-item, [class*='opportunity']").each(
    (_i, el) => {
      const $el = $(el);
      const title =
        $el.find("h2, h3, [class*='title']").first().text().trim() ||
        $el.find("a").first().text().trim();

      if (!title) return;

      const link = $el.find("a").first().attr("href") ?? null;
      const fullUrl = link
        ? link.startsWith("http") ? link : `https://www.ukri.org${link}`
        : null;

      const textContent = $el.text();

      const councilMatch = textContent.match(
        /\b(AHRC|BBSRC|EPSRC|ESRC|MRC|NERC|STFC|Innovate UK|Research England)\b/i
      );

      const dateMatch = textContent.match(
        /(?:clos(?:es|ing)\s+date|deadline)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i
      );

      const amountMatch = textContent.match(
        /(£[\d,.]+(?:\s*(?:million|k|m))?(?:\s*[-–]\s*£[\d,.]+(?:\s*(?:million|k|m))?)?)/i
      );

      opportunities.push({
        title,
        url: fullUrl ?? pageUrl,
        council: councilMatch ? councilMatch[1] : null,
        closingDate: dateMatch ? dateMatch[1] : null,
        fundingAmount: amountMatch ? amountMatch[1] : null,
        status: "open",
        fundingType: null,
        description: null,
        eligibility: null,
        scope: null,
      });
    }
  );

  return opportunities;
}

function getTotalPages($: cheerio.CheerioAPI): number {
  let max = 1;
  $("a[href*='/page/']").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/\/page\/(\d+)\//);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  });
  return max;
}

/** Extract text content of a section by finding a heading that matches the pattern,
 *  then collecting all sibling text until the next heading of same or higher level. */
function extractSection($: cheerio.CheerioAPI, headingPattern: RegExp): string | null {
  let result: string | null = null;

  $("h2, h3").each((_i, el) => {
    if (result !== null) return; // already found
    const headingText = $(el).text().trim();
    if (!headingPattern.test(headingText)) return;

    const parts: string[] = [];
    let sibling = $(el).next();
    while (sibling.length && !sibling.is("h2, h3")) {
      const text = sibling.text().trim();
      if (text) parts.push(text);
      sibling = sibling.next();
    }

    if (parts.length > 0) result = parts.join("\n\n");
  });

  return result;
}

/** Fetch and parse the detail page for a single opportunity. */
async function fetchOpportunityDetails(url: string): Promise<Pick<RawUkriOpportunity, "fundingType" | "description" | "eligibility" | "scope" | "closingDate">> {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    return { fundingType: null, description: null, eligibility: null, scope: null, closingDate: null };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Description: first substantial paragraph in the main content area
  let description: string | null = null;
  $("main p, .entry-content p, article p").each((_i, el) => {
    if (description) return;
    const text = $(el).text().trim();
    if (text.length > 80) description = text;
  });

  // Funding type: look for "Grant", "Fellowship", "Loan", "Contract" near metadata
  let fundingType: string | null = null;
  const bodyText = $("body").text();
  const typeMatch = bodyText.match(/\b(Grant|Fellowship|Loan|Contract)\b/i);
  if (typeMatch) fundingType = typeMatch[1].toLowerCase();

  const eligibility = extractSection($, /who can apply|eligibility/i);
  const scope = extractSection($, /what we.{0,10}looking for|scope|what you.{0,10}do/i);

  // Closing date: "Closing date: 14 July 2026 4:00pm UK time"
  let closingDate: string | null = null;
  const dateMatch = bodyText.match(/clos(?:es|ing)\s+date[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i);
  if (dateMatch) closingDate = dateMatch[1];

  return { fundingType, description, eligibility, scope, closingDate };
}

/**
 * Fetch all pages of the UKRI Funding Finder, then enrich each opportunity
 * with data from its detail page (eligibility, scope, description, funding type).
 * Optionally filter by council slug (e.g. "ahrc", "epsrc").
 */
export async function fetchUkriOpportunities(
  council?: string
): Promise<RawUkriOpportunity[]> {
  const buildUrl = (page: number) => {
    const base = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
    return council ? `${base}?filter_council[]=${encodeURIComponent(council)}` : base;
  };

  // Fetch page 1 to get total page count
  const firstUrl = buildUrl(1);
  console.log(`  Fetching UKRI Funding Finder: ${firstUrl}`);
  const firstResponse = await fetchWithRetry(firstUrl);
  if (!firstResponse.ok) {
    throw new Error(`UKRI Funding Finder error: ${firstResponse.status} ${firstResponse.statusText}`);
  }

  const firstHtml = await firstResponse.text();
  const $first = cheerio.load(firstHtml);
  const totalPages = getTotalPages($first);
  const opportunities: RawUkriOpportunity[] = parsePageOpportunities($first, firstUrl);

  // Fetch remaining listing pages
  for (let page = 2; page <= totalPages; page++) {
    const pageUrl = buildUrl(page);
    console.log(`  Fetching page ${page}/${totalPages}: ${pageUrl}`);
    const response = await fetchWithRetry(pageUrl);
    if (!response.ok) {
      console.warn(`  Page ${page} failed: ${response.status} — skipping`);
      continue;
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    opportunities.push(...parsePageOpportunities($, pageUrl));
  }

  console.log(`  Found ${opportunities.length} opportunities — fetching detail pages...`);

  // Enrich each opportunity with detail page data
  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i];
    if (!opp.url || opp.url === BASE_URL) continue;

    const details = await fetchOpportunityDetails(opp.url);
    opp.fundingType = details.fundingType;
    opp.description = details.description;
    opp.eligibility = details.eligibility;
    opp.scope = details.scope;
    if (!opp.closingDate && details.closingDate) opp.closingDate = details.closingDate;

    if ((i + 1) % 10 === 0) console.log(`  Detail pages: ${i + 1}/${opportunities.length}`);
    if (i < opportunities.length - 1) await sleep(DETAIL_DELAY_MS);
  }

  console.log(`  Done fetching ${opportunities.length} opportunities`);
  return opportunities;
}
