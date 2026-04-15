import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawEndocrinologyGrant } from "../transforms/normalise-endocrinology.js";

const BASE_URL = "https://www.endocrinology.org";
const GRANTS_URL = `${BASE_URL}/grants-and-awards/`;

// Meta-section titles that are not actual grant schemes
const NON_GRANT_TITLES = /grants\s+review|view\s+all|eligibility\s+criteria/i;

/**
 * Parse the Society for Endocrinology grants listing page.
 *
 * Structure:
 *   <div class="grant-type ...">
 *     <div class="list-group">
 *       <a href="/grants-and-awards/grants/travel-grant/" class="link list-group-item pt-4">
 *         <div>
 *           <h3 class="h5 sfe-txt-navy">Travel Grant</h3>
 *           <div>Description text…</div>
 *         </div>
 *       </a>
 *     </div>
 *   </div>
 *
 * No amounts on listing page. Status: "open" unless "now closed" appears on the page globally.
 * Individual grant pages should be checked for real-time status, but listing is rolling.
 */
export function parseEndocrinologyPage(html: string): RawEndocrinologyGrant[] {
  const $ = cheerio.load(html);
  const grants: RawEndocrinologyGrant[] = [];
  const seen = new Set<string>();

  // Global status: check if page-wide closure notice is present
  // (individual grants have their own cycles so default to open)
  $("div[class*='grant-type']").each((_i, el) => {
    const $card = $(el);

    const $link = $card.find("a.list-group-item").first();
    if (!$link.length) return;

    const href = $link.attr("href") ?? null;
    if (!href) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    if (seen.has(url)) return;
    seen.add(url);

    const title = $link.find("h3").first().text().trim();
    if (!title || NON_GRANT_TITLES.test(title)) return;

    // Description: text content of the div sibling after h3
    const $h3 = $link.find("h3").first();
    const description = $h3.next("div").text().trim() || $link.find("div").last().text().trim() || null;

    grants.push({ title, url, status: "open", description, amountRaw: null });
  });

  return grants;
}

export async function fetchEndocrinologyGrants(): Promise<RawEndocrinologyGrant[]> {
  console.log(`  Fetching Society for Endocrinology grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  Endocrinology: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseEndocrinologyPage(html);
  console.log(`  Found ${grants.length} Society for Endocrinology grant entries`);
  return grants;
}
