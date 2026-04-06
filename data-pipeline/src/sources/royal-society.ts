import * as cheerio from "cheerio";
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

  // Cards can be within various container structures
  $(".grant-search-result").each((_i, el) => {
    const $el = $(el);

    const titleEl = $el.find("h4, h5, h3").first();
    const title = titleEl.text().trim();
    if (!title) return;

    const linkEl = $el.find("a").first();
    const href = linkEl.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    const description = $el.find("p").first().text().trim();

    const statusText = $el.find("[class*='status']").first().text().trim();
    const isOpen = /opening/i.test(statusText);
    const status = isOpen ? "open" : "closed";

    let deadlineText: string | null = null;
    if (isOpen) {
      const match = statusText.match(/opening\s+(.+)/i);
      if (match) deadlineText = match[1].trim();
    }

    schemes.push({ title, url, status, deadlineText, description });
  });

  if (schemes.length === 0) {
    throw new Error("Royal Society: no grant cards found — page structure may have changed");
  }

  // Extract total from "You've viewed N of M grants"
  let totalCount = schemes.length;
  const countText = $("[class*='count']").text();
  const countMatch = countText.match(/of\s+(\d+)\s+grants/i);
  if (countMatch) totalCount = parseInt(countMatch[1], 10);

  return { schemes, totalCount };
}

export async function fetchRoyalSocietySchemes(): Promise<RawRoyalSocietyScheme[]> {
  console.log(`  Fetching Royal Society grants: ${GRANTS_URL}`);
  console.log(`  Note: fetching server-rendered items only (~12 of 28). Full pagination requires AJAX endpoint discovery.`);

  const response = await fetch(GRANTS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; grant-researcher-bot/1.0)",
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
