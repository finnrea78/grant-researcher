import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawBiochemGrant } from "../transforms/normalise-biochemical-society.js";

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
  return grants;
}
