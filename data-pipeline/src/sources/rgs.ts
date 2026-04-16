import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawRgsGrant } from "../transforms/normalise-rgs.js";

const BASE_URL = "https://www.rgs.org";
const DEADLINES_URL = `${BASE_URL}/exploration/grants/grant-deadlines/`;

/**
 * Infer the full year for a deadline date that only has day + month.
 *
 * The page heading reads "Grant deadlines YYYY/YYYY" (e.g. "2025/2026").
 * Convention: months Aug-Dec belong to the first year, Jan-Jul to the second.
 */
function inferYear(monthName: string, cycleYears: [number, number]): number {
  const LATE_MONTHS = ["august","september","october","november","december"];
  return LATE_MONTHS.includes(monthName.toLowerCase()) ? cycleYears[0] : cycleYears[1];
}

/**
 * Parse the RGS grant deadlines page.
 *
 * Structure:
 *   <h2>Grant deadlines YYYY/YYYY</h2>
 *   <h3>DD Month</h3>
 *   <ul>
 *     <li><p><a href="..." title="Grant Name">…</a></p>
 *       [optional nested <ul><li>…sub-grants…</li></ul>]
 *     </li>
 *   </ul>
 *
 * Top-level and nested grants are both collected; each inherits the h3 deadline date.
 * Status is derived by comparing the inferred deadline date against today.
 */
export function parseRgsPage(html: string): RawRgsGrant[] {
  const $ = cheerio.load(html);
  const grants: RawRgsGrant[] = [];

  // Extract cycle years from h2: "Grant deadlines 2025/2026"
  let cycleYears: [number, number] = [new Date().getFullYear(), new Date().getFullYear() + 1];
  $("h2").each((_i, el) => {
    const text = $(el).text();
    const match = text.match(/(\d{4})\/(\d{4})/);
    if (match) cycleYears = [parseInt(match[1]), parseInt(match[2])];
  });

  const today = new Date();

  // Find the content root — stable class prefix for RichTextstyles
  const $root = $('[class*="RichTextstyles__Content"]');
  const context = $root.length ? $root : $("main, article, body");

  context.find("h3").each((_i, h3) => {
    const dateText = $(h3).text().trim(); // "23 November"
    const dateMatch = dateText.match(/^(\d{1,2})\s+(\w+)$/);
    if (!dateMatch) return;

    const day = parseInt(dateMatch[1]);
    const month = dateMatch[2];
    const year = inferYear(month, cycleYears);
    const deadlineRaw = `${day} ${month} ${year}`;

    const deadlineDate = new Date(`${month} ${day}, ${year}`);
    const status = deadlineDate < today ? "closed" : "open";

    const $ul = $(h3).next("ul");

    const addGrant = (name: string, href: string | undefined) => {
      if (!name) return;
      const url = href
        ? href.startsWith("http") ? href : `${BASE_URL}${href}`
        : DEADLINES_URL;
      grants.push({ name, url, status, deadlineRaw, description: null });
    };

    $ul.children("li").each((_j, li) => {
      const $li = $(li);
      const $topA = $li.find("a").first();
      const topName = $topA.attr("title") ?? $topA.text().trim();
      const topHref = $topA.attr("href");

      // Check for nested sub-grants
      const $nested = $li.find("ul li");
      if ($nested.length > 0) {
        // Parent grant is also a real grant — add it
        addGrant(topName, topHref);
        // Add each sub-grant
        $nested.each((_k, subLi) => {
          const $subA = $(subLi).find("a").first();
          const subName = $subA.attr("title") ?? $subA.text().trim();
          const subHref = $subA.attr("href");
          addGrant(subName, subHref);
        });
      } else {
        addGrant(topName, topHref);
      }
    });
  });

  return grants;
}

export async function fetchRgsGrants(): Promise<RawRgsGrant[]> {
  console.log(`  Fetching RGS grant deadlines: ${DEADLINES_URL}`);
  const response = await fetchWithRetry(DEADLINES_URL);
  if (!response.ok) {
    console.warn(`  RGS: ${DEADLINES_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseRgsPage(html);
  console.log(`  Found ${grants.length} RGS grant entries`);
  return grants;
}
