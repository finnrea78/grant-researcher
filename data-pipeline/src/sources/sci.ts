import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawSciGrant } from "../transforms/normalise-sci.js";

const BASE_URL = "https://www.soci.org";

// Sub-category listing pages to scrape
const LISTING_PAGES = [
  `${BASE_URL}/awards/scholarships-and-fellowships`,
  `${BASE_URL}/awards/travel-bursaries`,
  `${BASE_URL}/awards/entrepreneurship-awards`,
];

/**
 * Parse an SCI award sub-category listing page.
 * Structure: <a href="/awards/{category}/{slug}"><h5>Award Name</h5></a>
 */
export function parseSciListingPage(html: string): { title: string; url: string }[] {
  const $ = cheerio.load(html);
  const results: { title: string; url: string }[] = [];
  const seen = new Set<string>();

  // Each award card is an <a> containing an <h5>
  $("a:has(h5)").each((_i, el) => {
    const $a = $(el);
    const href = $a.attr("href") ?? "";
    if (!href.startsWith("/awards/")) return;

    // Must be 3 path segments: /awards/{category}/{slug}
    const segments = href.replace(/\/$/, "").split("/").filter(Boolean);
    if (segments.length < 3) return;

    const url = `${BASE_URL}${href.endsWith("/") ? href.slice(0, -1) : href}`;
    if (seen.has(url)) return;
    seen.add(url);

    const title = $a.find("h5").first().text().trim();
    if (!title) return;

    results.push({ title, url });
  });

  return results;
}

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

/**
 * Parse an individual SCI award page to extract description, eligibility, deadline and amount.
 *
 * Timetable: <table><tr><td>Closes:</td><td>30 April 2026</td></tr></table>
 * Amount: first £ mention in body prose.
 */
export function parseSciGrantPage(
  html: string,
  url: string
): Pick<RawSciGrant, "amountRaw" | "deadlineRaw" | "status" | "description" | "eligibility"> {
  const $ = cheerio.load(html);

  // Description: substantial paragraphs — try main/article/content area first, fall back to all body p
  const descParts: string[] = [];
  const selectors = ["main p", "article p", ".page-content p", ".field--name-body p", "body p"];
  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 60) descParts.push(text);
    });
    if (descParts.length > 0) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility
  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

  let deadlineRaw: string | null = null;

  // Timetable: find td containing "Closes" then get sibling td
  $("table tr").each((_i, row) => {
    const $cells = $(row).find("td");
    if ($cells.length < 2) return;
    const label = $cells.eq(0).text().trim().toLowerCase();
    if (/closes/i.test(label) && !deadlineRaw) {
      const raw = $cells.eq(1).text().trim();
      if (raw) deadlineRaw = raw;
    }
  });

  const bodyText = $("main, article, .page-content, body").first().text();

  // Amount: "up to £X,XXX", "£X,XXX"
  const amountMatch = bodyText.match(/(?:up\s+to\s+)?(£[\d,]+)/i);
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  let status = "open";
  if (deadlineRaw) {
    const parsed = new Date(deadlineRaw);
    if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
  }

  return { description, eligibility, amountRaw, deadlineRaw, status };
}

export async function fetchSciGrants(): Promise<RawSciGrant[]> {
  const allListings: { title: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const listingUrl of LISTING_PAGES) {
    console.log(`  Fetching SCI listing page: ${listingUrl}`);
    const res = await fetchWithRetry(listingUrl);
    if (!res.ok) {
      console.warn(`  SCI: ${listingUrl} returned ${res.status} — skipping`);
      continue;
    }
    const html = await res.text();
    const items = parseSciListingPage(html);
    for (const item of items) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        allListings.push(item);
      }
    }
  }

  console.log(`  SCI: fetching ${allListings.length} individual award pages`);

  const grants: RawSciGrant[] = [];
  for (const { title, url } of allListings) {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`  SCI: ${url} returned ${res.status} — skipping`);
      continue;
    }
    const html = await res.text();
    const details = parseSciGrantPage(html, url);
    grants.push({ title, url, ...details });
  }

  console.log(`  Found ${grants.length} SCI award entries`);
  return grants;
}
