import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawRoyEnSocGrant } from "../transforms/normalise-royensoc.js";

const BASE_URL = "https://www.royensoc.co.uk";
const GRANTS_URL = `${BASE_URL}/membership-and-community/awards-and-grants/`;

/**
 * Parse the Royal Entomological Society awards & grants page.
 *
 * Structure:
 *   - <h2> sections: "Grants and Funding" | "Awards and Recognition"
 *   - Each entry: <div.wp-block-columns> containing two columns —
 *       image column (flex-basis:160px) and content column
 *   - Content column: <h3.wp-block-heading><a href="URL">Title</a> [– Open]</h3>
 *                     <p> description </p>
 *                     <p> amount / eligibility </p>
 *
 * Only the "Grants and Funding" section is scraped.
 * Status: "open" if " Open" appears in h3 text; else "open" (no closed markers shown).
 */
export function parseRoyEnSocPage(html: string): RawRoyEnSocGrant[] {
  const $ = cheerio.load(html);
  const grants: RawRoyEnSocGrant[] = [];

  // Collect all h2 headings and their positions
  let inGrantsSection = false;

  // Walk the main content children to split by h2 sections
  $(".entry-content, article, main").first().find("h2, div.wp-block-columns").each((_i, el) => {
    const tag = $(el).prop("tagName")?.toLowerCase();

    if (tag === "h2") {
      const heading = $(el).text().trim().toLowerCase();
      inGrantsSection = heading.includes("grants and funding");
      return;
    }

    if (tag === "div" && inGrantsSection) {
      // Find the content column (not the image column)
      const $contentCol = $(el).find(".wp-block-column").filter((_i, col) => {
        return !$(col).attr("style")?.includes("flex-basis:160px");
      }).first();

      const $h3 = $contentCol.find("h3").first();
      if (!$h3.length) return;

      const $link = $h3.find("a").first();
      const title = $link.text().trim();
      if (!title) return;

      const href = $link.attr("href") ?? null;
      const url = href
        ? href.startsWith("http") ? href : `${BASE_URL}${href}`
        : GRANTS_URL;

      // Status: check full h3 text for "Open" / "Closed" indicator
      const h3Text = $h3.text();
      const status = /closed/i.test(h3Text) ? "closed"
        : "open"; // page only shows currently-active grants

      // Paragraphs: first is description, subsequent may have amounts
      const $paras = $contentCol.find("p");
      const description = $paras.first().text().trim() || null;

      // Amount: find paragraph containing £
      let amountRaw: string | null = null;
      $paras.each((_i, p) => {
        const text = $(p).text().trim();
        if (!amountRaw && /£/.test(text)) {
          amountRaw = text;
        }
      });

      grants.push({ title, url, status, description, amountRaw });
    }
  });

  return grants;
}

export async function fetchRoyEnSocGrants(): Promise<RawRoyEnSocGrant[]> {
  console.log(`  Fetching Royal Entomological Society grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  Royal Entomological Society: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseRoyEnSocPage(html);
  console.log(`  Found ${grants.length} Royal Entomological Society grant entries`);
  return grants;
}
