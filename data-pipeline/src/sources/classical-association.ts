import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawClassicalAssocGrant } from "../transforms/normalise-classical-association.js";

const BASE_URL = "https://www.classicalassociation.org";
const WP_API_URL = `${BASE_URL}/wp-json/wp/v2/pages?slug=grants&_fields=content.rendered`;
const GRANTS_URL = `${BASE_URL}/grants.html`;

/**
 * Given a list of day-of-month numbers and month names (e.g. [1 March, 1 June, ...]),
 * returns the date string for the next upcoming occurrence from today.
 */
function resolveNextDeadline(dayMonthPairs: Array<{ day: number; month: string }>): string | null {
  const now = new Date();
  for (const { day, month } of dayMonthPairs) {
    const candidate = new Date(`${month} ${day}, ${now.getFullYear()}`);
    if (candidate > now) return `${day} ${month} ${now.getFullYear()}`;
  }
  // All this year's dates passed — take first of next year
  const first = dayMonthPairs[0];
  if (!first) return null;
  return `${first.day} ${first.month} ${now.getFullYear() + 1}`;
}

/**
 * Parse the Classical Association grants page HTML (from WP REST API rendered content).
 *
 * The page describes two grant types:
 *  - Small Grants: up to £4,999, quarterly deadlines (1 March, 1 June, 1 September, 1 December)
 *  - Major Grants: £5,000+, biannual deadlines (1 March, 1 September)
 */
export function parseClassicalAssocPage(html: string): RawClassicalAssocGrant[] {
  const $ = cheerio.load(html);
  const bodyText = $.text();

  const grants: RawClassicalAssocGrant[] = [];

  // Small grants: up to £4,999, quarterly deadlines
  const smallAmountMatch = bodyText.match(/up to (?:a maximum of )?(£[\d,]+)/i);
  const smallAmountRaw = smallAmountMatch ? smallAmountMatch[0].trim() : "up to £4,999";

  const quarterlyDeadline = resolveNextDeadline([
    { day: 1, month: "March" },
    { day: 1, month: "June" },
    { day: 1, month: "September" },
    { day: 1, month: "December" },
  ]);

  grants.push({
    title: "Classical Association Small Grant",
    url: GRANTS_URL,
    status: "open",
    description:
      "Grants of up to £4,999 for classical projects in the UK, typically funding activities by schoolteachers, students, academics and organisations. Considered quarterly.",
    amountRaw: smallAmountRaw,
    deadlineRaw: quarterlyDeadline,
  });

  // Major grants: £5,000+, biannual deadlines
  const biannualDeadline = resolveNextDeadline([
    { day: 1, month: "March" },
    { day: 1, month: "September" },
  ]);

  grants.push({
    title: "Classical Association Major Grant",
    url: GRANTS_URL,
    status: "open",
    description:
      "Major grants of £5,000 and over for classical projects in the UK, supporting study and engagement with Ancient Greece and Rome. Considered twice a year.",
    amountRaw: "£5,000 and over",
    deadlineRaw: biannualDeadline,
  });

  return grants;
}

export async function fetchClassicalAssocGrants(): Promise<RawClassicalAssocGrant[]> {
  console.log(`  Fetching Classical Association grants via WP REST API`);

  const res = await fetchWithRetry(WP_API_URL);
  if (!res.ok) {
    console.warn(`  Classical Association: WP API ${res.status} — skipping`);
    return [];
  }

  const pages: Array<{ content: { rendered: string } }> = await res.json();
  if (!pages.length) {
    console.warn(`  Classical Association: no page found`);
    return [];
  }

  const html = pages[0].content.rendered;
  const grants = parseClassicalAssocPage(html);
  console.log(`  Found ${grants.length} Classical Association grant types`);
  return grants;
}
