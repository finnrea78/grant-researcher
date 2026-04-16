import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawHeritageFundScheme } from "../transforms/normalise-heritage-fund.js";

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

export function parseHeritageFundDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
} {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  const selectors = ["main p", "article p", ".field--name-body p", ".field--name-field-intro p", ".content p", "body p"];
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

    schemes.push({ title, url, description, eligibility: null });
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

  // Enrich with detail-page content
  for (const scheme of schemes) {
    if (!scheme.url) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(scheme.url);
      if (!detailRes.ok) {
        console.warn(`  Heritage Fund detail fetch failed: ${detailRes.status} ${scheme.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseHeritageFundDetailPage(detailHtml);
      if (enriched.description) scheme.description = enriched.description;
      if (enriched.eligibility) scheme.eligibility = enriched.eligibility;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return schemes;
}
