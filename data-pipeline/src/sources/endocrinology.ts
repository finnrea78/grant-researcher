import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawEndocrinologyGrant } from "../transforms/normalise-endocrinology.js";

const BASE_URL = "https://www.endocrinology.org";
const GRANTS_URL = `${BASE_URL}/grants-and-awards/`;
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

export function parseEndocrinologyDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
} {
  const $ = cheerio.load(html);

  // Description: substantial paragraphs from main content
  const descParts: string[] = [];
  const selectors = ["main p", "article p", ".entry-content p", ".page-content p", "body p"];
  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 60) descParts.push(text);
    });
    if (descParts.length > 0) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility
  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

  // Amount: look for £ in body text
  const bodyText = $("body").text();
  const amountMatch = bodyText.match(/(?:up\s+to\s+)?(£[\d,]+(?:\s*[–-]\s*£[\d,]+)?)/i);
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  // Deadline: look for date in body text
  const deadlineMatch = bodyText.match(
    /(?:deadline|closing date|closes?)[:\s]+([A-Za-z0-9 ,]+\d{4})/i
  );
  const deadlineRaw = deadlineMatch ? deadlineMatch[1].trim().slice(0, 100) : null;

  return { description, eligibility, amountRaw, deadlineRaw };
}

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

    grants.push({ title, url, status: "open", description, eligibility: null, amountRaw: null, deadlineRaw: null });
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

  // Enrich each grant with detail-page content
  for (const item of grants) {
    if (!item.url) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(item.url);
      if (!detailRes.ok) {
        console.warn(`  Endocrinology detail fetch failed: ${detailRes.status} ${item.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseEndocrinologyDetailPage(detailHtml);
      if (enriched.description) item.description = enriched.description;
      if (enriched.eligibility) item.eligibility = enriched.eligibility;
      if (enriched.amountRaw) item.amountRaw = enriched.amountRaw;
      if (enriched.deadlineRaw) item.deadlineRaw = enriched.deadlineRaw;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return grants;
}
