import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawRoyalSocietyScheme } from "../transforms/normalise-royal-society.js";

const GRANTS_URL = "https://royalsociety.org/grants/search/grant-listings/";
const BASE_URL = "https://royalsociety.org";

export interface RoyalSocietyPageData {
  schemes: RawRoyalSocietyScheme[];
  /** Total grants on the site (pagination not yet supported — AJAX endpoint unknown). */
  totalCount: number;
}

export function parseRoyalSocietyPage(html: string): RoyalSocietyPageData {
  const $ = cheerio.load(html);
  const schemes: RawRoyalSocietyScheme[] = [];

  $("article.card--grant").each((_i, el) => {
    const $el = $(el);

    const title = $el.find(".card__title").first().text().trim();
    if (!title) return;

    const href = $el.find("a.card__link").first().attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    const description = $el.find(".card__desc p").first().text().trim();

    // Status tag contains "Open" or "Closed"
    const tagText = $el.find(".card__tag").first().text().trim();
    const status = /open/i.test(tagText) ? "open" : "closed";

    // card__meta strong may contain "Opening DD Month YYYY" for upcoming schemes
    const metaText = $el.find(".card__meta strong").first().text().trim();
    let deadlineText: string | null = null;
    if (metaText) {
      const match = metaText.match(/opening\s+(.+)/i);
      if (match) deadlineText = match[1].trim();
    }

    schemes.push({ title, url, status, deadlineText, description });
  });

  if (schemes.length === 0) {
    throw new Error("Royal Society: no grant cards found — page structure may have changed");
  }

  // Extract total from "You've viewed N of M grants"
  let totalCount = schemes.length;
  const countText = $(".grant-search__count").text();
  const countMatch = countText.match(/of\s+(\d+)\s+grants/i);
  if (countMatch) totalCount = parseInt(countMatch[1], 10);

  return { schemes, totalCount };
}

export async function fetchRoyalSocietySchemes(): Promise<RawRoyalSocietyScheme[]> {
  console.log(`  Fetching Royal Society grants: ${GRANTS_URL}`);
  console.log(`  Note: fetching server-rendered items only (~12 of 28). Full pagination requires AJAX endpoint discovery.`);

  const response = await fetchWithRetry(GRANTS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Royal Society error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const { schemes, totalCount } = parseRoyalSocietyPage(html);

  if (schemes.length < totalCount) {
    console.log(`  Found ${schemes.length} of ${totalCount} total grants (pagination not yet supported)`);
  } else {
    console.log(`  Found ${schemes.length} grants from Royal Society`);
  }

  return schemes;
}
