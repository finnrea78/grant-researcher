import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawERCScheme } from "../transforms/normalise-erc.js";

const APPLY_URL = "https://erc.europa.eu/apply-grant";
const BASE_URL = "https://erc.europa.eu";

// ERC grant types to include (matched against aria-label on card anchors)
const INCLUDE_TYPES = [
  "ERC Starting Grant",
  "ERC Consolidator Grant",
  "ERC Advanced Grant",
  "ERC Proof of Concept",
  "ERC Synergy Grant",
  "ERC Plus Grant",
];

export function parseERCApplyPage(html: string): Array<{ title: string; url: string }> {
  const $ = cheerio.load(html);
  const items: Array<{ title: string; url: string }> = [];

  // Grant type cards: <a arial-label="ERC ..."> within .card-oe-rich elements
  $("a[arial-label]").each((_i, el) => {
    const $el = $(el);
    const label = ($el.attr("arial-label") ?? "").trim();
    if (!INCLUDE_TYPES.includes(label)) return;

    const href = $el.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    items.push({ title: label, url });
  });

  if (items.length === 0) {
    throw new Error("ERC: no grant type cards found — page structure may have changed");
  }

  return items;
}

async function fetchGrantDescription(url: string): Promise<string | null> {
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    // First meaningful paragraph in the main content area
    let description: string | null = null;
    $("main p, .paragraph p, .field--name-body p").each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text && text.length > 50 && !description) {
        description = text;
      }
    });
    return description;
  } catch {
    return null;
  }
}

export async function fetchERCSchemes(): Promise<RawERCScheme[]> {
  console.log(`  Fetching ERC grant types: ${APPLY_URL}`);

  const response = await fetchWithRetry(APPLY_URL);
  if (!response.ok) {
    throw new Error(`ERC error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const items = parseERCApplyPage(html);

  // Fetch descriptions in parallel
  const withDescriptions = await Promise.all(
    items.map(async (item) => {
      const description = await fetchGrantDescription(item.url);
      return { ...item, description };
    })
  );

  console.log(`  Found ${withDescriptions.length} ERC grant types`);

  return withDescriptions.map((item) => ({
    title: item.title,
    url: item.url,
    status: "open",
    description: item.description,
  }));
}
