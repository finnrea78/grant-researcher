import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawImaGrant } from "../transforms/normalise-ima.js";

const BASE_URL = "https://ima.org.uk";
const GRANTS_URL = `${BASE_URL}/support/grants/`;

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

    grants.push({ title, url, status: "open", description, amountRaw });
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
  return grants;
}
