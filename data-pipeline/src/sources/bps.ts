import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawBpsGrant } from "../transforms/normalise-bps.js";

const DETAIL_DELAY_MS = 300;

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

export function parseBpsDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
} {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  const selectors = ["main p", "article p", ".article-body p", ".articlecontent p", ".content p", "body p"];
  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 60) descParts.push(text);
    });
    if (descParts.length > 0) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /who can apply|eligibility|who is eligible/i);

  return { description, eligibility };
}

const BASE_URL = "https://www.bps.ac.uk";
const LISTING_BASE = `${BASE_URL}/membership-community/prizes-awards-grants-bursaries/prizes-awards-grants/`;

/** Fetch up to MAX_PAGES listing pages and collect all grant cards. */
const MAX_PAGES = 5;

export function parseBpsPage(html: string): RawBpsGrant[] {
  const $ = cheerio.load(html);
  const grants: RawBpsGrant[] = [];

  $("div.article.articletype-0").each((_i, el) => {
    const $card = $(el);

    const title = $card.find("span[itemprop='headline']").text().trim()
      || $card.find("a[itemprop='url']").attr("title")
      || "";
    if (!title) return;

    const href = $card.find("a[itemprop='url']").first().attr("href") ?? null;
    const url = href
      ? href.startsWith("http") ? href : `${BASE_URL}${href}`
      : LISTING_BASE;

    const category = $card.find("span.news-list-category").first().text().trim() || null;

    // Deadline: machine-readable ISO date on <time datetime="YYYY-MM-DD">
    const deadlineIso = $card.find("time[itemprop='datePublished']").attr("datetime") ?? null;

    // Status: open if a future deadline is present; otherwise treat as open
    // (BPS doesn't publish explicit closed status on listing page)
    let status = "open";
    if (deadlineIso) {
      const deadlineDate = new Date(deadlineIso);
      if (deadlineDate < new Date()) status = "closed";
    }

    // Amount: regex on teaser text
    const teaserText = $card.find("div.articlecontent p").first().text().trim() || null;
    const amountMatch = teaserText?.match(/(?:up\s+to\s+|of\s+)?(£[\d,]+(?:\s*per\s+\w+)?)/i);
    const amountRaw = amountMatch ? amountMatch[0] : null;

    grants.push({
      title,
      url,
      category,
      status,
      deadlineIso,
      amountRaw,
      description: teaserText,
      eligibility: null,
    });
  });

  return grants;
}

/** Extract the "next page" URL from the paginator, or null if last page. */
export function extractBpsNextPage(html: string, currentUrl: string): string | null {
  const $ = cheerio.load(html);
  const $next = $("ul.f3-widget-paginator li.next a");
  if (!$next.length) return null;
  const href = $next.attr("href");
  if (!href) return null;
  return href.startsWith("http") ? href : `${BASE_URL}${href}`;
}

export async function fetchBpsGrants(): Promise<RawBpsGrant[]> {
  const allGrants: RawBpsGrant[] = [];
  let pageUrl: string | null = LISTING_BASE;
  let page = 1;

  while (pageUrl && page <= MAX_PAGES) {
    console.log(`  Fetching BPS grants page ${page}: ${pageUrl}`);
    const response = await fetchWithRetry(pageUrl);
    if (!response.ok) {
      console.warn(`  BPS: ${pageUrl} returned ${response.status} — stopping`);
      break;
    }
    const html = await response.text();
    const grants = parseBpsPage(html);
    allGrants.push(...grants);

    pageUrl = extractBpsNextPage(html, pageUrl);
    page++;
  }

  console.log(`  Found ${allGrants.length} BPS grant entries`);

  // Enrich with detail-page content
  for (const grant of allGrants) {
    if (!grant.url || grant.url === LISTING_BASE) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(grant.url);
      if (!detailRes.ok) {
        console.warn(`  BPS detail fetch failed: ${detailRes.status} ${grant.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseBpsDetailPage(detailHtml);
      if (enriched.description) grant.description = enriched.description;
      if (enriched.eligibility) grant.eligibility = enriched.eligibility;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return allGrants;
}
