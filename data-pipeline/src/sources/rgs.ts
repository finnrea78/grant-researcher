import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawRgsGrant } from "../transforms/normalise-rgs.js";

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

export function parseRgsDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
} {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  $("main p, article p, [class*='RichTextstyles'] p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /eligibilit|who\s+can\s+apply|who\s+is\s+eligible/i);

  return { description, eligibility };
}

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
      grants.push({ name, url, status, deadlineRaw, description: null, eligibility: null });
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

  // Enrich with detail-page descriptions and eligibility (skip if URL is the deadlines listing)
  const seen = new Set<string>();
  for (const grant of grants) {
    if (!grant.url || grant.url === DEADLINES_URL || seen.has(grant.url)) continue;
    seen.add(grant.url);
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(grant.url);
      if (!res.ok) continue;
      const detailHtml = await res.text();
      const { description, eligibility } = parseRgsDetailPage(detailHtml);
      // Apply to all grants sharing the same URL
      for (const g of grants) {
        if (g.url === grant.url) {
          if (description) g.description = description;
          if (eligibility) g.eligibility = eligibility;
        }
      }
    } catch { /* skip on error */ }
  }

  return grants;
}
