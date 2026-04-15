import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawSalGrant } from "../transforms/normalise-sal.js";

const BASE_URL = "https://www.sal.org.uk";
const GRANTS_URL = `${BASE_URL}/what-we-do/grants/our-grant-programmes/`;

/**
 * Resolve an annually-recurring deadline to the next upcoming date.
 * "15 January annually" → "15 January 2026" if future, else "15 January 2027"
 */
function resolveAnnualDeadline(text: string): string | null {
  const match = text.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i);
  if (!match) return null;

  const [, day, month] = match;
  const now = new Date();
  const thisYear = new Date(`${day} ${month} ${now.getFullYear()}`);
  if (thisYear >= now) {
    return `${day} ${month} ${now.getFullYear()}`;
  }
  return `${day} ${month} ${now.getFullYear() + 1}`;
}

/**
 * Parse the SAL grants page.
 *
 * Structure: UIkit accordion <ul uk-accordion> with <li> items.
 *   - Title: <a class="uk-accordion-title"><span>Name: description</span></a>
 *     → keep only the part before the first ":"
 *   - Content: <div class="uk-accordion-content">
 *     → <p><strong>Award Amount</strong></p><p>value</p>
 *     → <p><strong>Deadline for Applications</strong></p><p>date</p>
 *
 * Skip the first item which is a navigation/overview link.
 */
export function parseSalPage(html: string): RawSalGrant[] {
  const $ = cheerio.load(html);
  const grants: RawSalGrant[] = [];

  $("ul[uk-accordion] li, ul[data-uk-accordion] li").each((_i, el) => {
    const $li = $(el);
    const $title = $li.find("a.uk-accordion-title span").first();
    const spanText = $title.text().trim();

    if (!spanText) return;

    // Skip the "More information on Research and Travel Grants." nav item
    if (/more information/i.test(spanText)) return;

    // Title: everything before the first ":"
    const colonIdx = spanText.indexOf(":");
    const title = colonIdx > 0 ? spanText.slice(0, colonIdx).trim() : spanText;
    if (!title) return;

    const $content = $li.find(".uk-accordion-content").first();

    // Walk pairs of <p> elements: label (contains strong) → value (plain text)
    let amountRaw: string | null = null;
    let deadlineText: string | null = null;

    $content.find("p").each((_j, p) => {
      const $p = $(p);
      const strongText = $p.find("strong").text().trim().toLowerCase();

      if (/amount of award|award amount/i.test(strongText)) {
        // next sibling p is the value
        const $next = $p.next("p");
        if ($next.length) amountRaw = $next.text().trim() || null;
      }
      if (/deadline for applications/i.test(strongText)) {
        const $next = $p.next("p");
        if ($next.length) deadlineText = $next.text().trim() || null;
      }
    });

    // Resolve recurring annual deadlines
    const deadlineRaw = deadlineText ? resolveAnnualDeadline(deadlineText) : null;

    // Status: open if deadline is in the future (or if no deadline = open/rolling)
    let status = "open";
    if (deadlineRaw) {
      const parsed = new Date(deadlineRaw);
      if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
    }

    // Description: collect all non-label paragraphs for multi-paragraph description
    const descParts: string[] = [];
    $content.find("p").each((_j, p) => {
      const $p = $(p);
      if ($p.find("strong").length) return; // skip label paragraphs
      const text = $p.text().trim();
      if (text.length > 20) descParts.push(text);
    });
    const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

    grants.push({
      title,
      url: GRANTS_URL,
      status,
      description,
      amountRaw,
      deadlineRaw,
      eligibility: null,
    });
  });

  return grants;
}

export async function fetchSalGrants(): Promise<RawSalGrant[]> {
  console.log(`  Fetching Society of Antiquaries of London grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  SAL: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseSalPage(html);
  console.log(`  Found ${grants.length} SAL grant entries`);
  return grants;
}
