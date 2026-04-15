import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawHeritageFundScheme } from "../transforms/normalise-heritage-fund.js";

const PROGRAMMES_URL = "https://www.heritagefund.org.uk/funding";
const BASE_URL = "https://www.heritagefund.org.uk";

export function parseHeritageFundPage(html: string): RawHeritageFundScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawHeritageFundScheme[] = [];

  // Drupal view: each programme is an <article class="programme ...">
  $("article.programme").each((_i, article) => {
    const $article = $(article);

    const $titleLink = $article.find("h2.search-result__title a").first();
    const title = $titleLink.find("span").text().trim();
    if (!title) return;

    const href = $titleLink.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Description from the body field
    const description = $article.find(".field--name-body").text().trim() || null;

    schemes.push({ title, url, description });
  });

  if (schemes.length === 0) {
    throw new Error("Heritage Fund: no programme articles found — page structure may have changed");
  }

  return schemes;
}

export async function fetchHeritageFundSchemes(): Promise<RawHeritageFundScheme[]> {
  console.log(`  Fetching National Lottery Heritage Fund programmes: ${PROGRAMMES_URL}`);

  const response = await fetchWithRetry(PROGRAMMES_URL);
  if (!response.ok) {
    throw new Error(`Heritage Fund error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseHeritageFundPage(html);
  console.log(`  Found ${schemes.length} programmes from National Lottery Heritage Fund`);
  return schemes;
}
