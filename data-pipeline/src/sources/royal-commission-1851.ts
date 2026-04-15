import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawRc1851Grant } from "../transforms/normalise-royal-commission-1851.js";

const BASE_URL = "https://royalcommission1851.org";
const AWARDS_URL = `${BASE_URL}/awards/`;

/**
 * Parse the Royal Commission for the Exhibition of 1851 awards page.
 *
 * Structure: UIkit CSS grid with <div.cta--grid-cell> → <a.cta--simple-link href="URL">
 *   - Title: <div.cta--heading><h2>
 *   - Description: <div.cta--copy><p>
 *
 * Filters out top-level nav links (/awards, /about-us etc) — keeps only specific scheme URLs.
 */
export function parseRc1851Page(html: string): RawRc1851Grant[] {
  const $ = cheerio.load(html);
  const grants: RawRc1851Grant[] = [];
  const seen = new Set<string>();

  $("div.cta--grid-cell").each((_i, el) => {
    const $cell = $(el);
    const $link = $cell.find("a.cta--simple-link").first();
    if (!$link.length) return;

    const href = $link.attr("href") ?? "";
    if (!href) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Skip top-level category/nav pages (e.g. /awards, /about-us)
    // Keep only paths with at least 2 non-empty segments (e.g. /awards/research-fellowships/)
    const path = url.replace(BASE_URL, "").replace(/\/$/, "");
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) return;

    if (seen.has(url)) return;
    seen.add(url);

    const title = $link.find("h2").first().text().trim();
    if (!title) return;

    const description = $link.find(".cta--copy p").first().text().trim() || null;

    grants.push({ title, url, status: "open", description, amountRaw: null });
  });

  return grants;
}

export async function fetchRc1851Grants(): Promise<RawRc1851Grant[]> {
  console.log(`  Fetching Royal Commission 1851 awards: ${AWARDS_URL}`);
  const response = await fetchWithRetry(AWARDS_URL);
  if (!response.ok) {
    console.warn(`  RC1851: ${AWARDS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseRc1851Page(html);
  console.log(`  Found ${grants.length} Royal Commission 1851 award entries`);
  return grants;
}
