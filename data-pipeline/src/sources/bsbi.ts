import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawBsbiGrant } from "../transforms/normalise-bsbi.js";

const BASE_URL = "https://bsbi.org";
const GRANTS_URL = `${BASE_URL}/learn/grants`;

/**
 * Parse the BSBI grants page.
 *
 * Structure: single <article class="page-content"> with:
 *   - Intro <p><strong> block: global status ("All our grant programmes have now closed...")
 *   - <div id="headingN"> anchors followed by <h3> grant titles
 *   - <ul><li>Up to £X...</li></ul> for amounts
 *   - <a class="btn btn-primary" href="/learn/grants/[slug]"> for individual page links
 *   - Occasional <p> prose with specific dates (Trial FISC Grants)
 *
 * Strategy: find each div[id^="heading"] anchor, the next sibling h3 is the title.
 * Walk following siblings until the next anchor to collect amount (li) and URL (a.btn).
 */
export function parseBsbiPage(html: string): RawBsbiGrant[] {
  const $ = cheerio.load(html);
  const grants: RawBsbiGrant[] = [];

  // Detect global status from intro strong block
  let globalStatus = "open";
  $("article p strong, .page-content p strong").each((_i, el) => {
    const text = $(el).text().toLowerCase();
    if (/now closed|have now closed/i.test(text)) {
      globalStatus = "closed";
    }
  });

  $("div[id^='heading']").each((_i, anchor) => {
    const $h3 = $(anchor).next("h3");
    if (!$h3.length) return;

    const title = $h3.text().trim();
    if (!title) return;

    let amountRaw: string | null = null;
    let url = GRANTS_URL;
    let deadlineRaw: string | null = null;
    let status = globalStatus;

    // Walk siblings between this anchor and the next until next div[id]
    let $el = $h3.next();
    while ($el.length && !($el.is("div") && $el.attr("id"))) {
      const tag = $el.prop("tagName")?.toLowerCase();

      if (tag === "ul" && !amountRaw) {
        // Look for £ amount in list items
        $el.find("li").each((_j, li) => {
          if (amountRaw) return;
          const text = $(li).text();
          const match = text.match(/(?:up\s+to\s+)?(£[\d,]+)/i);
          if (match) amountRaw = match[0].trim();
        });
      }

      if (tag === "p") {
        const pText = $el.text();
        // Specific date patterns: "Applications open on DD Month YYYY and close on DD Month YYYY"
        const closeMatch = pText.match(/close[s]?\s+on\s+(\d{1,2}\s+\w+\s+\d{4})/i);
        if (closeMatch && !deadlineRaw) {
          deadlineRaw = closeMatch[1];
          const parsed = new Date(deadlineRaw);
          if (!isNaN(parsed.getTime())) {
            status = parsed < new Date() ? "closed" : "open";
          }
        }
        // Also get amount from prose if no ul found
        if (!amountRaw) {
          const match = pText.match(/(?:up\s+to\s+)?(£[\d,]+)/i);
          if (match) amountRaw = match[0].trim();
        }
      }

      if (tag === "p" || tag === "div") {
        // Individual page link
        $el.find("a.btn-primary, a.btn").each((_j, a) => {
          const href = $(a).attr("href") ?? "";
          if (href.startsWith("/learn/grants/") || href.startsWith("https://bsbi.org/learn/grants/")) {
            url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
          }
        });
      }

      $el = $el.next();
    }

    grants.push({ title, url, status, amountRaw, deadlineRaw });
  });

  return grants;
}

export async function fetchBsbiGrants(): Promise<RawBsbiGrant[]> {
  console.log(`  Fetching BSBI grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  BSBI: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseBsbiPage(html);
  console.log(`  Found ${grants.length} BSBI grant entries`);
  return grants;
}
