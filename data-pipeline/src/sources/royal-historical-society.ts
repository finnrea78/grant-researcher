import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawRhsGrant } from "../transforms/normalise-royal-historical-society.js";

const BASE_URL = "https://royalhistsoc.org";
const GRANTS_URL = `${BASE_URL}/grants/`;

/**
 * Parse the Royal Historical Society grants page.
 *
 * The "Current open calls" h3 section lists active grants in <ul><li> items.
 * Each li: <a href="URL"><strong>Title</strong></a> prose... <strong>£X</strong>... <strong>Next closing date: DD Month YYYY.</strong>
 *
 * Only items in the open calls section are scraped (have deadlines + amounts).
 */
export function parseRhsPage(html: string): RawRhsGrant[] {
  const $ = cheerio.load(html);
  const grants: RawRhsGrant[] = [];

  // Find the "Current open calls" h3
  let $openCallsH3 = $("h3").filter((_i, el) =>
    /current\s+open\s+calls/i.test($(el).text())
  ).first();

  if (!$openCallsH3.length) return grants;

  // Collect all siblings after h3 until the next h2/h3 heading
  // Note: <hr> elements appear between ul blocks but are within the open-calls section
  $openCallsH3.nextUntil("h2, h3").each((_i, el) => {
    const tag = $(el).prop("tagName")?.toLowerCase();
    if (tag !== "ul") return;

    $(el).find("li").each((_j, li) => {
      const $li = $(li);

      // Title + URL from the first <a> in the li
      const $link = $li.find("a").first();
      if (!$link.length) return;

      const title = $link.find("strong").text().trim() || $link.text().trim();
      if (!title) return;

      const href = $link.attr("href") ?? null;
      const url = href
        ? href.startsWith("http") ? href : `${BASE_URL}${href}`
        : GRANTS_URL;

      const liText = $li.text();

      // Deadline: "Next closing date: Friday DD Month YYYY."
      const deadlineMatch = liText.match(/Next closing date:\s+\w+\s+(\d{1,2}\s+\w+\s+\d{4})/i);
      const deadlineRaw = deadlineMatch ? deadlineMatch[1] : null;

      // Amount: from strong elements containing £ (excluding the deadline strong)
      let amountRaw: string | null = null;
      $li.find("strong").each((_k, s) => {
        const sText = $(s).text().trim();
        if (/£/.test(sText) && !amountRaw) {
          amountRaw = sText;
        }
      });
      // Also try inline prose amount
      if (!amountRaw) {
        const amountMatch = liText.match(/(?:of\s+(?:up\s+to\s+)?|funding\s+of\s+(?:either\s+)?)(£[\d,]+(?:\s+or\s+£[\d,]+)?)/i);
        if (amountMatch) amountRaw = amountMatch[1];
      }

      // Status: these are in the "current open calls" section → open
      // Confirm deadline hasn't passed
      let status = "open";
      if (deadlineRaw) {
        const parsed = new Date(deadlineRaw);
        if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
      }

      // Description: full li text (stripped of deadline and noise)
      const description = liText
        .replace(/Next closing date:[^\n.]+\./gi, "")
        .replace(/\s+/g, " ")
        .trim() || null;

      grants.push({ title, url, status, description, amountRaw, deadlineRaw });
    });
  });

  return grants;
}

export async function fetchRhsGrants(): Promise<RawRhsGrant[]> {
  console.log(`  Fetching Royal Historical Society grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  RHS: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseRhsPage(html);
  console.log(`  Found ${grants.length} Royal Historical Society open call entries`);
  return grants;
}
