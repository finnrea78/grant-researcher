import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawGeolsocGrant } from "../transforms/normalise-geolsoc.js";

const BASE_URL = "https://www.geolsoc.org.uk";
const GRANTS_URL = `${BASE_URL}/careers-and-training/grants-and-bursaries/`;

/**
 * The Geological Society grants page uses a Bootstrap 5 accordion.
 * All grants within the two "Our funds" / "Other grants" accordions are
 * extracted; guidance accordions (Allowable costs, etc.) are filtered out
 * by checking for known guidance headings.
 *
 * Status is global for the cycle: one prose date in the page intro
 * ("closed on DD Month YYYY") determines whether the cycle is open or closed.
 */

const NON_GRANT_HEADINGS = /allowable|non-allowable|guidance|eligibility|report|how to apply/i;

export function parseGeolsocPage(html: string): RawGeolsocGrant[] {
  const $ = cheerio.load(html);
  const grants: RawGeolsocGrant[] = [];

  // Extract the cycle deadline from the intro paragraph
  // "applications for this year's research grants and bursaries having closed on 9 February 2026"
  let cycleDeadlineRaw: string | null = null;
  let cycleStatus = "open";

  $("p").each((_i, el) => {
    if (cycleDeadlineRaw) return;
    const text = $(el).text();
    const closedMatch = text.match(/closed on\s+(\d{1,2}\s+\w+\s+\d{4})/i);
    if (closedMatch) {
      cycleDeadlineRaw = closedMatch[1];
      // Compare to today to determine if cycle is still closed or reopened
      const closedDate = new Date(cycleDeadlineRaw);
      cycleStatus = isNaN(closedDate.getTime()) || closedDate < new Date() ? "closed" : "open";
    }

    // Also look for "closes [date]" pattern (open cycle)
    const opensMatch = text.match(/closes\s+(\d{1,2}\s+\w+\s+\d{4})/i);
    if (opensMatch && !cycleDeadlineRaw) {
      cycleDeadlineRaw = opensMatch[1];
      const closeDate = new Date(cycleDeadlineRaw);
      cycleStatus = !isNaN(closeDate.getTime()) && closeDate >= new Date() ? "open" : "closed";
    }
  });

  // Process all accordion items; skip non-grant headings
  $("div.accordion-item").each((_i, el) => {
    const $item = $(el);
    const name = $item.find("h2.accordion-header button").first().text().trim();

    if (!name || NON_GRANT_HEADINGS.test(name)) return;

    const $body = $item.find(".accordion-body");

    // Description: multi-paragraph from accordion body
    const descParts: string[] = [];
    $body.find("p").each((_j, p) => {
      const text = $(p).text().trim();
      if (text.length > 30) descParts.push(text);
    });
    const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

    // Amount: regex on description or full body text
    const bodyText = $body.text();
    const amountMatch = bodyText.match(/(?:up\s+to\s+|award\s+of\s+|of\s+)(£[\d,]+(?:\s*per\s+\w+)?)/i)
      ?? bodyText.match(/(£[\d,]+)/);
    const amountRaw = amountMatch ? amountMatch[1] : null;

    // Per-grant URL (some have a "Find out more" link to a sub-page)
    const subHref = $body.find("a").filter((_j, a) => /find out more|apply|more details/i.test($(a).text())).first().attr("href") ?? null;
    const url = subHref
      ? subHref.startsWith("http") ? subHref : `${BASE_URL}${subHref}`
      : GRANTS_URL;

    grants.push({
      name,
      url,
      status: cycleStatus,
      description,
      amountRaw,
      deadlineRaw: cycleDeadlineRaw,
    });
  });

  return grants;
}

export async function fetchGeolsocGrants(): Promise<RawGeolsocGrant[]> {
  console.log(`  Fetching Geological Society grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  Geological Society: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseGeolsocPage(html);
  console.log(`  Found ${grants.length} grant entries from Geological Society of London`);
  return grants;
}
