import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawFebsGrant } from "../transforms/normalise-febs.js";

const BASE_URL = "https://www.febs.org";
const FUNDING_URL = `${BASE_URL}/funding/`;

// Skip info/index/faq pages — not grant schemes
const SKIP_PATH_RE = /general-guidelines|faqs?\/?$|^\/funding\/?$/;

/**
 * Parse the FEBS funding listing page sidebar to extract individual scheme URLs.
 * Sidebar: div.sidebar_block.sidebar_menu li.page_item a
 */
export function parseFebsListingPage(html: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const seen = new Set<string>();

  $("div.sidebar_block.sidebar_menu li.page_item a").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href.includes("/funding/")) return;

    try {
      const path = new URL(href).pathname;
      if (SKIP_PATH_RE.test(path)) return;

      // Must have at least one segment after /funding/
      const after = path.replace(/^\/funding\/?/, "").replace(/\/$/, "");
      if (!after) return;

      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
      if (seen.has(url)) return;
      seen.add(url);
      urls.push(url);
    } catch {
      // invalid URL — skip
    }
  });

  return urls;
}

/**
 * Parse an individual FEBS grant page.
 *
 * Title: <section.page_header h2.hero_item__title> or <h1>
 * Amount: under <h2>BENEFITS</h2> → next sibling <p> containing <strong>€
 * Deadline: under <h2>APPLICATION</h2> → look for date patterns in prose
 */
export function parseFebsGrantPage(
  html: string,
  url: string
): Pick<RawFebsGrant, "title" | "amountRaw" | "deadlineRaw" | "status"> {
  const $ = cheerio.load(html);

  // Title from hero heading
  const title =
    $("h2.hero_item__title, h1.hero_item__title, section.page_header h2, section.page_header h1")
      .first()
      .text()
      .trim();

  const $content = $("div.text_column--65, .entry-content, main article").first();

  let amountRaw: string | null = null;
  let deadlineRaw: string | null = null;
  let status = "open";

  // Walk h2 sections to find BENEFITS and APPLICATION
  $content.find("h2").each((_i, h2) => {
    const h2Text = $(h2).text().trim().toLowerCase();

    if (/benefits/i.test(h2Text) && !amountRaw) {
      // Collect following p siblings until next h2
      let $el = $(h2).next();
      while ($el.length && !$el.is("h2")) {
        // Find strong containing €
        $el.find("strong").each((_j, s) => {
          const sText = $(s).text().trim();
          if (/€[\d,]+|EUR[\d,]+/.test(sText) && !amountRaw) {
            amountRaw = sText;
          }
        });
        // Also try prose € match
        if (!amountRaw) {
          const pText = $el.text();
          const match = pText.match(/€[\d,]+(?:\s*per\s+\w+)?/i);
          if (match) amountRaw = match[0];
        }
        $el = $el.next();
      }
    }

    if (/application/i.test(h2Text)) {
      // Look for a specific deadline date in following p elements
      let $el = $(h2).next();
      while ($el.length && !$el.is("h2")) {
        const pText = $el.text();
        // Find date patterns anywhere in APPLICATION prose
        const dateMatch = pText.match(
          /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i
        );
        if (dateMatch && !deadlineRaw) {
          deadlineRaw = dateMatch[1].replace(",", "").trim();
          const parsed = new Date(deadlineRaw);
          if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
        }
        $el = $el.next();
      }
    }
  });

  return { title, amountRaw, deadlineRaw, status };
}

export async function fetchFebsGrants(): Promise<RawFebsGrant[]> {
  console.log(`  Fetching FEBS funding listing: ${FUNDING_URL}`);
  const listingRes = await fetchWithRetry(FUNDING_URL);
  if (!listingRes.ok) {
    console.warn(`  FEBS: ${FUNDING_URL} returned ${listingRes.status} — skipping`);
    return [];
  }
  const listingHtml = await listingRes.text();
  const grantUrls = parseFebsListingPage(listingHtml);

  console.log(`  FEBS: fetching ${grantUrls.length} individual scheme pages`);

  const grants: RawFebsGrant[] = [];
  for (const url of grantUrls) {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`  FEBS: ${url} returned ${res.status} — skipping`);
      continue;
    }
    const html = await res.text();
    const parsed = parseFebsGrantPage(html, url);
    if (!parsed.title) continue;
    grants.push({ ...parsed, url });
  }

  console.log(`  Found ${grants.length} FEBS grant entries`);
  return grants;
}
