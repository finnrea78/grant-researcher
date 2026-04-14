import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawNuffieldScheme } from "../transforms/normalise-nuffield.js";

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

    schemes.push({ title, url: fullUrl, status, amountRaw, deadlineRaw, durationRaw, description });
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
  return schemes;
}
