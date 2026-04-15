import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawPhysocGrant } from "../transforms/normalise-physoc.js";

const BASE_URL = "https://www.physoc.org";
const LISTING_URL = `${BASE_URL}/grants/`;

/**
 * Parse the Physiological Society grants listing page.
 * Cards: <a href="URL" class="info-box type3-md ...">
 *   - Title: <h2> inside the card
 *   - Description: <div class="descr"><p>
 */
export function parsePhysocListingPage(html: string): { title: string; url: string; description: string | null }[] {
  const $ = cheerio.load(html);
  const entries: { title: string; url: string; description: string | null }[] = [];

  $("a.info-box").each((_i, el) => {
    const $card = $(el);
    const title = $card.find("h2, h3").first().text().trim();
    if (!title) return;
    const href = $card.attr("href") ?? null;
    if (!href) return;
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const description = $card.find(".descr p").first().text().trim() || null;
    entries.push({ title, url, description });
  });

  return entries;
}

/**
 * Parse a Physiological Society individual grant page.
 * Structure: repeated <figure class="icon-block"> sections with h3 + p content.
 *   - Amount: icon-block where h3 contains "How much funding"
 *   - Deadline: icon-block where h3 contains "Deadline"
 *   - Status: inferred from deadline text or "Applications are now open"/"closed"
 */
export function parsePhysocGrantPage(
  html: string,
  url: string
): { amountRaw: string | null; deadlineRaw: string | null; status: string } {
  const $ = cheerio.load(html);

  let amountRaw: string | null = null;
  let deadlineRaw: string | null = null;
  let status = "open";

  // Walk icon-block figures
  $("figure.icon-block").each((_i, el) => {
    const $block = $(el);
    const heading = $block.find("h3").first().text().trim().toLowerCase();
    const bodyText = $block.find("figcaption").text().trim();

    if (heading.includes("how much") || heading.includes("funding available")) {
      const amountMatch = bodyText.match(/£[\d,]+(?:\s*-\s*£[\d,]+)?/);
      if (amountMatch) amountRaw = amountMatch[0];
    }

    if (heading.includes("deadline")) {
      // Extract date(s) from the block — take the earliest/first future date
      const dates = bodyText.match(/\d{1,2}\s+\w+\s+\d{4}/g);
      if (dates && dates.length > 0) {
        // Find the first date that hasn't passed
        const today = new Date();
        let chosen: string | null = null;
        for (const d of dates) {
          const parsed = new Date(d);
          if (!isNaN(parsed.getTime())) {
            if (!chosen) chosen = d;
            if (parsed >= today) { chosen = d; break; }
          }
        }
        deadlineRaw = chosen;
        // Status: if all dates have passed, closed
        if (dates.every(d => {
          const p = new Date(d);
          return !isNaN(p.getTime()) && p < today;
        })) {
          status = "closed";
        }
      } else {
        // "Apply by DD Month YYYY" form
        const byMatch = bodyText.match(/\b(\d{1,2}\s+\w+\s+\d{4})\b/);
        if (byMatch) {
          deadlineRaw = byMatch[1];
          const parsed = new Date(byMatch[1]);
          if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
        }
      }
    }

    // Status from "When can I apply?" block
    if (heading.includes("when can i apply") || heading.includes("when to apply")) {
      if (/closed/i.test(bodyText)) status = "closed";
      else if (/open/i.test(bodyText)) status = "open";
    }
  });

  return { amountRaw, deadlineRaw, status };
}

export async function fetchPhysocGrants(): Promise<RawPhysocGrant[]> {
  console.log(`  Fetching Physiological Society grants listing: ${LISTING_URL}`);
  const listResp = await fetchWithRetry(LISTING_URL);
  if (!listResp.ok) {
    console.warn(`  Physiological Society: listing ${listResp.status} — skipping`);
    return [];
  }
  const listHtml = await listResp.text();
  const entries = parsePhysocListingPage(listHtml);
  console.log(`  Found ${entries.length} Physiological Society grant pages to fetch`);

  const grants: RawPhysocGrant[] = [];
  for (const entry of entries) {
    const resp = await fetchWithRetry(entry.url);
    if (!resp.ok) {
      console.warn(`  Physoc: ${entry.url} returned ${resp.status} — skipping`);
      grants.push({ ...entry, amountRaw: null, deadlineRaw: null, status: "open" });
      continue;
    }
    const html = await resp.text();
    const details = parsePhysocGrantPage(html, entry.url);
    grants.push({ ...entry, ...details });
  }

  console.log(`  Fetched ${grants.length} Physiological Society grants`);
  return grants;
}
