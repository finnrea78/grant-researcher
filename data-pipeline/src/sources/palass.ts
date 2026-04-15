import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawPalassGrant } from "../transforms/normalise-palass.js";

const BASE_URL = "https://www.palass.org";
const GRANTS_URL = `${BASE_URL}/awards-grants/grants`;

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

/**
 * Resolve an annually-recurring deadline to the next upcoming date.
 * "1st March" → "1 March 2026" if in the future, else "1 March 2027"
 */
function resolveAnnualDeadline(dayMonth: string): string | null {
  const match = dayMonth.match(new RegExp(`(\\d{1,2})\\s+(${MONTHS})`, "i"));
  if (!match) return null;

  const [, day, month] = match;
  const now = new Date();
  const thisYear = new Date(`${day} ${month} ${now.getFullYear()}`);
  if (thisYear >= now) return `${day} ${month} ${now.getFullYear()}`;
  return `${day} ${month} ${now.getFullYear() + 1}`;
}

/**
 * Parse the PalAss grants listing page.
 *
 * Drupal 10 accordion structure:
 *   <h4 class="accordion-heading" data-aria-accordion-heading>Title</h4>
 *   <div class="accordion-panel" data-aria-accordion-panel>
 *     <p>...description with £ amounts...</p>
 *     <p><strong>Deadline: DD Month...</strong></p>
 *     <div class="button-list">
 *       <a class="button black" href="/scheme-slug">More Information</a>
 *     </div>
 *   </div>
 */
export function parsePalassPage(html: string): RawPalassGrant[] {
  const $ = cheerio.load(html);
  const grants: RawPalassGrant[] = [];
  const seen = new Set<string>();

  $("h4[data-aria-accordion-heading], h4.accordion-heading").each((_i, h4el) => {
    const title = $(h4el).text().trim();
    if (!title || seen.has(title)) return;
    seen.add(title);

    const $panel = $(h4el).next("div[data-aria-accordion-panel], div.accordion-panel").first();
    if (!$panel.length) return;

    // URL from "More Information" button
    const href = $panel.find("a.button.black, a.button[title='More Information']").first().attr("href") ?? null;
    const url = href
      ? href.startsWith("http") ? href : `${BASE_URL}${href}`
      : GRANTS_URL;

    // Amount: first £ pattern in prose paragraphs
    let amountRaw: string | null = null;
    $panel.find("p").each((_j, p) => {
      if (amountRaw) return;
      const text = $(p).text();
      const match = text.match(/(?:up\s+to\s+)?£[\d,]+(?:\s*(?:GBP|each|per\s+award))?/i);
      if (match) amountRaw = match[0].trim();
    });

    // Deadline: <strong>Deadline: ...</strong> in panel
    let deadlineRaw: string | null = null;
    $panel.find("strong").each((_j, s) => {
      if (deadlineRaw) return;
      const sText = $(s).text().trim();
      if (!/deadline/i.test(sText)) return;

      // Extract "DD Month" pattern, strip ordinals and time/noise
      const dayMonthMatch = sText.match(
        new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})`, "i")
      );
      if (dayMonthMatch) {
        const resolved = resolveAnnualDeadline(`${dayMonthMatch[1]} ${dayMonthMatch[2]}`);
        deadlineRaw = resolved;
      }
    });

    // Status
    let status = "open";
    if (deadlineRaw) {
      const parsed = new Date(deadlineRaw);
      if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
    }

    // Description: first full prose paragraph (not the deadline)
    let description: string | null = null;
    $panel.find("p").each((_j, p) => {
      if (description) return;
      const $p = $(p);
      if ($p.find("strong").length) return; // skip deadline strong paragraph
      const text = $p.text().trim();
      if (text.length > 20) description = text;
    });

    grants.push({ title, url, status, amountRaw, deadlineRaw, description });
  });

  return grants;
}

export async function fetchPalassGrants(): Promise<RawPalassGrant[]> {
  console.log(`  Fetching Palaeontological Association grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  PalAss: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parsePalassPage(html);
  console.log(`  Found ${grants.length} PalAss grant entries`);
  return grants;
}
