import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawMicrobiologySocietyGrant } from "../transforms/normalise-microbiology-society.js";

const BASE_URL = "https://microbiologysociety.org";
const GRANTS_URL = `${BASE_URL}/grants-prizes/all-grants.html`;

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

export function parseMicrobiologySocietyDetailPage(html: string): { description: string | null; eligibility: string | null } {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  $("main p, article p, .article-body p, .content p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /eligibility|who can apply|who is eligible|criteria/i);

  return { description, eligibility };
}

/**
 * Parse the Microbiology Society all-grants listing page.
 *
 * Cards: `div.article.toc-item`
 *   - Title: `a.article-heading-link` text
 *   - URL: `a.article-heading-link` href
 *   - Description + amount: `p.article-text`
 * No deadlines on listing page (rolling schemes described in prose).
 */
export function parseMicrobiologySocietyPage(html: string): RawMicrobiologySocietyGrant[] {
  const $ = cheerio.load(html);
  const grants: RawMicrobiologySocietyGrant[] = [];

  $("div.article.toc-item").each((_i, el) => {
    const $card = $(el);

    const title = $card.find("a.article-heading-link").first().text().trim();
    if (!title) return;

    const href = $card.find("a.article-heading-link").first().attr("href") ?? null;
    const url = href
      ? href.startsWith("http") ? href : `${BASE_URL}${href}`
      : GRANTS_URL;

    const description = $card.find("p.article-text").first().text().trim() || null;

    // Amount: inline in description prose ("up to £3,000", "Awards of up to £2,000")
    const amountMatch = description?.match(
      /(?:up\s+to\s+|of\s+|awards?\s+of\s+up\s+to\s+|awards?\s+of\s+)?(£[\d,]+)/i
    );
    const amountRaw = amountMatch ? amountMatch[0] : null;

    grants.push({
      title,
      url,
      status: "open", // all schemes are rolling, no closed indicators on page
      description,
      amountRaw,
      eligibility: null,
    });
  });

  return grants;
}

export async function fetchMicrobiologySocietyGrants(): Promise<RawMicrobiologySocietyGrant[]> {
  console.log(`  Fetching Microbiology Society grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  Microbiology Society: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseMicrobiologySocietyPage(html);
  console.log(`  Found ${grants.length} Microbiology Society grant entries`);

  // Enrich from detail pages
  for (const item of grants) {
    if (!item.url || item.url === GRANTS_URL) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(item.url);
      if (!res.ok) continue;
      const detailHtml = await res.text();
      const { description, eligibility } = parseMicrobiologySocietyDetailPage(detailHtml);
      if (description) item.description = description;
      if (eligibility) item.eligibility = eligibility;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return grants;
}
