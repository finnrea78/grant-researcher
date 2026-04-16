import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawRc1851Grant } from "../transforms/normalise-royal-commission-1851.js";

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

export function parseRc1851DetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
} {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  const selectors = ["main p", "article p", ".tm-content p", ".content p", "body p"];
  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 60) descParts.push(text);
    });
    if (descParts.length > 0) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

  const bodyText = $("body").text();
  const amountMatch = bodyText.match(/(?:up\s+to\s+)?(£[\d,]+(?:\s*[–-]\s*£[\d,]+)?)/i);
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  const deadlineMatch = bodyText.match(/(?:deadline|closing date|closes?)[:\s]+([A-Za-z0-9 ,]+\d{4})/i);
  const deadlineRaw = deadlineMatch ? deadlineMatch[1].trim().slice(0, 100) : null;

  return { description, eligibility, amountRaw, deadlineRaw };
}

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

    grants.push({ title, url, status: "open", description, amountRaw: null, eligibility: null, deadlineRaw: null });
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

  // Enrich with detail-page content
  for (const grant of grants) {
    if (!grant.url) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(grant.url);
      if (!detailRes.ok) {
        console.warn(`  RC1851 detail fetch failed: ${detailRes.status} ${grant.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseRc1851DetailPage(detailHtml);
      if (enriched.description) grant.description = enriched.description;
      if (enriched.eligibility) grant.eligibility = enriched.eligibility;
      if (enriched.amountRaw) grant.amountRaw = enriched.amountRaw;
      if (enriched.deadlineRaw) grant.deadlineRaw = enriched.deadlineRaw;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return grants;
}
