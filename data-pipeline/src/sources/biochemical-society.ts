import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawBiochemGrant } from "../transforms/normalise-biochemical-society.js";

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

export function parseBiochemDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
  deadlineRaw: string | null;
} {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  const selectors = ["main p", "article p", ".page-content p", ".entry-content p", ".content p", "body p"];
  for (const sel of selectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 60) descParts.push(text);
    });
    if (descParts.length > 0) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

  // Deadline: look for pattern near "deadline" keyword
  const bodyText = $("body").text();
  const deadlineMatch = bodyText.match(/(?:deadline|closing date|closes?)[:\s]+([A-Za-z0-9 ,]+\d{4})/i);
  const deadlineRaw = deadlineMatch ? deadlineMatch[1].trim().slice(0, 100) : null;

  return { description, eligibility, deadlineRaw };
}

const BASE_URL = "https://www.biochemistry.org";
const GRANTS_URL = `${BASE_URL}/grants-and-awards/grants-and-bursaries/`;

/**
 * Parse the Biochemical Society grants-and-bursaries listing page.
 *
 * The page renders `<div class="content-tile">` cards inside a tile-list
 * container.  Each card has:
 *   - `<p class="subheading-one">` — grant category
 *   - `<h5>` — grant name
 *   - `<div class="content-tile__content"> > <p>` — description with inline amount
 *   - `<a href>` — link to individual grant page
 */
export function parseBiochemPage(html: string): RawBiochemGrant[] {
  const $ = cheerio.load(html);
  const grants: RawBiochemGrant[] = [];

  $("div.content-tile").each((_i, el) => {
    const $card = $(el);

    const title = $card.find("h5").first().text().trim();
    if (!title) return;

    const category = $card.find("p.subheading-one").first().text().trim() || null;

    // Description is the first <p> in content wrapper (contains amount inline)
    const description = $card.find("div.content-tile__content > p").first().text().trim() || null;

    // Amount: extract from description prose ("up to £X", "£X")
    let amountRaw: string | null = null;
    if (description && /£/.test(description)) {
      amountRaw = description;
    }

    // URL: card wraps in an <a>
    const href = $card.find("a").first().attr("href") ?? null;
    const url = href
      ? href.startsWith("http")
        ? href
        : `${BASE_URL}${href}`
      : GRANTS_URL;

    grants.push({
      title,
      category,
      url,
      status: "open",
      description,
      amountRaw,
      eligibility: null,
      deadlineRaw: null,
    });
  });

  return grants;
}

export async function fetchBiochemGrants(): Promise<RawBiochemGrant[]> {
  console.log(`  Fetching Biochemical Society grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  Biochemical Society: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseBiochemPage(html);
  console.log(`  Found ${grants.length} grant entries from Biochemical Society`);

  // Enrich with detail-page content
  for (const grant of grants) {
    if (!grant.url || grant.url === GRANTS_URL) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(grant.url);
      if (!detailRes.ok) {
        console.warn(`  Biochem detail fetch failed: ${detailRes.status} ${grant.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseBiochemDetailPage(detailHtml);
      if (enriched.description) grant.description = enriched.description;
      if (enriched.eligibility) grant.eligibility = enriched.eligibility;
      if (enriched.deadlineRaw) grant.deadlineRaw = enriched.deadlineRaw;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return grants;
}
