import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawImaGrant } from "../transforms/normalise-ima.js";

const BASE_URL = "https://ima.org.uk";
const GRANTS_URL = `${BASE_URL}/support/grants/`;

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

export function parseImaDetailPage(html: string): { description: string | null; eligibility: string | null } {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  $("main p, article p, .entry-content p, .post-content p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /eligibility|who can apply|who is eligible|criteria/i);

  return { description, eligibility };
}

/**
 * Parse the IMA grants listing page.
 *
 * Structure: <article class="hero col-sm-12">
 *   - Title + URL: <h3 class="entry-title"><a href="...">
 *   - Description: <div class="entry-summary"><p>
 *   - Amount: inline in description prose ("£400", "£4,000")
 */
export function parseImaPage(html: string): RawImaGrant[] {
  const $ = cheerio.load(html);
  const grants: RawImaGrant[] = [];

  $("article.hero").each((_i, el) => {
    const $article = $(el);

    const $link = $article.find("h3.entry-title a, h2.entry-title a").first();
    if (!$link.length) return;

    const title = $link.text().trim();
    if (!title) return;

    const href = $link.attr("href") ?? null;
    const url = href
      ? href.startsWith("http") ? href : `${BASE_URL}${href}`
      : GRANTS_URL;

    const description = $article.find(".entry-summary p").first().text().trim() || null;

    // Amount: £X in description prose
    const amountMatch = description?.match(/£[\d,]+(?:\s*-\s*£[\d,]+)?/);
    const amountRaw = amountMatch ? amountMatch[0] : null;

    grants.push({ title, url, status: "open", description, amountRaw, eligibility: null });
  });

  return grants;
}

export async function fetchImaGrants(): Promise<RawImaGrant[]> {
  console.log(`  Fetching IMA grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  IMA: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseImaPage(html);
  console.log(`  Found ${grants.length} IMA grant entries`);

  // Enrich from detail pages
  for (const item of grants) {
    if (!item.url || item.url === GRANTS_URL) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(item.url);
      if (!res.ok) continue;
      const detailHtml = await res.text();
      const { description, eligibility } = parseImaDetailPage(detailHtml);
      if (description && description.length > (item.description?.length ?? 0)) {
        item.description = description;
      }
      if (eligibility) item.eligibility = eligibility;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return grants;
}
