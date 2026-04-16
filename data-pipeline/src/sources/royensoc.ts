import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawRoyEnSocGrant } from "../transforms/normalise-royensoc.js";

const BASE_URL = "https://www.royensoc.co.uk";
const GRANTS_URL = `${BASE_URL}/membership-and-community/awards-and-grants/`;
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

export function parseRoyEnSocDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
  deadlineRaw: string | null;
} {
  const $ = cheerio.load(html);

  // Description: substantial paragraphs from main/article content
  const descParts: string[] = [];
  const selectors = ["article p", "main p", ".entry-content p", ".wp-block-post-content p", "body p"];
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

  // Deadline
  const bodyText = $("body").text();
  const deadlineMatch = bodyText.match(
    /(?:deadline|closing date|applications?\s+close)[:\s]+([A-Za-z0-9 ,]+(?:\d{4})?)/i
  );
  const deadlineRaw = deadlineMatch ? deadlineMatch[1].trim().slice(0, 100) : null;

  return { description, eligibility, deadlineRaw };
}

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

      grants.push({ title, url, status, description, eligibility: null, deadlineRaw: null, amountRaw });
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

  // Enrich each grant with detail-page content
  for (const item of grants) {
    if (!item.url || item.url === GRANTS_URL) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(item.url);
      if (!detailRes.ok) {
        console.warn(`  RoyEnSoc detail fetch failed: ${detailRes.status} ${item.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseRoyEnSocDetailPage(detailHtml);
      if (enriched.description) item.description = enriched.description;
      if (enriched.eligibility) item.eligibility = enriched.eligibility;
      if (enriched.deadlineRaw) item.deadlineRaw = enriched.deadlineRaw;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return grants;
}
