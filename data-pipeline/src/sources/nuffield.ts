import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawNuffieldScheme } from "../transforms/normalise-nuffield.js";

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

export function parseNuffieldDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
} {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  const selectors = ["main p", "article p", ".entry-content p", ".content p", "body p"];
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

const SCHEMES_URL = "https://www.nuffieldfoundation.org/funding-for-research";
const BASE_URL = "https://www.nuffieldfoundation.org";

export function parseNuffieldPage(html: string): RawNuffieldScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawNuffieldScheme[] = [];

  $("li.fund-card").each((_i, card) => {
    const $card = $(card);

    const url = $card.find("a").first().attr("href") ?? "";
    const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;

    const title = $card.find("h3.fund-card-title").text().trim();
    if (!title) return;

    const tagClass = $card.find("span.fund-card-tag").attr("class") ?? "";
    const status = tagClass.includes("fund-card-tag--open") ? "open" : "closed";

    // Meta items have an SVG icon followed by text — remove SVGs before extracting
    const metaItems: string[] = [];
    $card.find("ul.fund-card-meta li").each((_j, li) => {
      $(li).find("svg").remove();
      const text = $(li).text().trim();
      if (text) metaItems.push(text);
    });

    const amountRaw = metaItems[0] ?? null;
    const deadlineRaw = metaItems[1] ?? null;
    const durationRaw = metaItems[2] ?? null;

    const description =
      $card.find("div.fund-card-description p").text().trim() || null;

    schemes.push({ title, url: fullUrl, status, amountRaw, deadlineRaw, durationRaw, description, eligibility: null });
  });

  if (schemes.length === 0) {
    throw new Error("Nuffield: no fund cards found — page structure may have changed");
  }

  return schemes;
}

export async function fetchNuffieldSchemes(): Promise<RawNuffieldScheme[]> {
  console.log(`  Fetching Nuffield Foundation schemes: ${SCHEMES_URL}`);

  const response = await fetchWithRetry(SCHEMES_URL);
  if (!response.ok) {
    throw new Error(`Nuffield error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseNuffieldPage(html);
  console.log(`  Found ${schemes.length} schemes from Nuffield Foundation`);

  // Enrich with detail-page content
  for (const scheme of schemes) {
    if (!scheme.url) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(scheme.url);
      if (!detailRes.ok) {
        console.warn(`  Nuffield detail fetch failed: ${detailRes.status} ${scheme.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseNuffieldDetailPage(detailHtml);
      if (enriched.description) scheme.description = enriched.description;
      if (enriched.eligibility) scheme.eligibility = enriched.eligibility;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return schemes;
}
