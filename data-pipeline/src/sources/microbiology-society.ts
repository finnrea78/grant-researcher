import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawMicrobiologySocietyGrant } from "../transforms/normalise-microbiology-society.js";

const BASE_URL = "https://microbiologysociety.org";
const GRANTS_URL = `${BASE_URL}/grants-prizes/all-grants.html`;

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
  return grants;
}
