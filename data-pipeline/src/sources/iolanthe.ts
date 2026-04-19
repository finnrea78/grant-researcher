import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawIolantheAward } from "../transforms/normalise-iolanthe.js";

const BASE_URL = "https://iolanthe.org";
const APPLY_URL = `${BASE_URL}/grants-awards/apply`;

/**
 * Parse the Iolanthe Midwifery Trust awards listing page.
 *
 * Structure: Drupal page with repeated award card sections.
 * Each section has:
 *   - Heading: "The <Award Name>"
 *   - "Awarded for:" description text
 *   - "Award Amount:" value
 *   - "Eligibility:" text
 *   - "Next Application Round:" date range
 *   - Link to /node/<id>
 *
 * Status: "Applications are closed" or "Applications are open"
 */
export function parseIolantheListingPage(html: string): RawIolantheAward[] {
  const $ = cheerio.load(html);
  const awards: RawIolantheAward[] = [];
  const seen = new Set<string>();

  // Each award card is accessible via a "Full Award Details" link or heading-identified section.
  // Find all headings that look like award names (h2/h3 within the main content area).
  $("main h2, main h3, .field--name-body h2, .field--name-body h3, article h2, article h3").each((_i, heading) => {
    const $h = $(heading);
    const title = $h.text().trim().replace(/^The\s+/i, "").trim();
    if (!title || title.length < 5) return;

    // Skip navigation-style headings
    if (/^(what|who|how|can|apply|training|research|improving|awards won|contact)/i.test(title)) return;

    // De-duplicate
    if (seen.has(title)) return;
    seen.add(title);

    // Collect following sibling text until the next heading
    let description: string | null = null;
    let eligibility: string | null = null;
    let amountRaw: string | null = null;
    let deadlineRaw: string | null = null;
    let url: string | null = null;
    let status = "closed";

    let $el = $h.next();
    while ($el.length && !$el.is("h2, h3")) {
      const text = $el.text().trim();

      if (/awarded\s+for[:\s]/i.test(text)) {
        description = text.replace(/^awarded\s+for[:\s]+/i, "").trim().slice(0, 2000) || null;
      } else if (/eligibility[:\s]/i.test(text)) {
        eligibility = text.replace(/^eligibility[:\s]+/i, "").trim().slice(0, 1500) || null;
      } else if (/award\s+amount[:\s]/i.test(text)) {
        const amountMatch = text.match(/(?:up\s+to\s+)?(£[\d,]+)/i);
        if (amountMatch) amountRaw = amountMatch[0].trim();
      } else if (/next\s+application\s+round[:\s]/i.test(text)) {
        const dateMatch = text.match(
          /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i
        );
        if (dateMatch) deadlineRaw = dateMatch[1].trim();
      } else if (/applications?\s+are\s+(?:now\s+)?open/i.test(text)) {
        status = "open";
      }

      // Grab the detail page URL — check both the element itself and its descendants
      if (!url) {
        const $candidates = $el.is("a") ? $el : $el.find("a");
        $candidates.each((_j, a) => {
          if (url) return;
          const href = $(a).attr("href") ?? "";
          if (/node\//i.test(href) && !/apply|guidance|pdf/i.test(href)) {
            url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
          }
        });
      }

      $el = $el.next();
    }

    // Fall back to listing page URL if no detail link found
    awards.push({
      title,
      url: url ?? APPLY_URL,
      description,
      eligibility,
      amountRaw,
      deadlineRaw,
      status,
    });
  });

  return awards;
}

export async function fetchIolantheAwards(): Promise<RawIolantheAward[]> {
  console.log(`  Fetching Iolanthe awards listing: ${APPLY_URL}`);
  const res = await fetchWithRetry(APPLY_URL);
  if (!res.ok) {
    console.warn(`  Iolanthe: ${APPLY_URL} returned ${res.status} — skipping`);
    return [];
  }
  const html = await res.text();
  const awards = parseIolantheListingPage(html);
  console.log(`  Found ${awards.length} Iolanthe award entries`);
  return awards;
}
