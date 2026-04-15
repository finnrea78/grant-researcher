import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawBouGrant } from "../transforms/normalise-bou.js";

const BASE_URL = "https://bou.org.uk";
const FUNDING_URL = `${BASE_URL}/funding/`;

/**
 * Parse the BOU funding overview page.
 *
 * Avada/Fusion Builder WordPress theme.
 * Each scheme: <div class="...link_box">
 *   <div class="link_box_title"><h3>Title</h3></div>
 *   <div class="link_box_text"><p>Description with optional £ amount</p></div>
 *   <a class="link_box_button" href="/scheme-slug/">
 */
export function parseBouOverviewPage(html: string): Array<{
  title: string;
  url: string;
  description: string | null;
  amountRaw: string | null;
}> {
  const $ = cheerio.load(html);
  const results: ReturnType<typeof parseBouOverviewPage> = [];
  const seen = new Set<string>();

  $(".link_box").each((_i, el) => {
    const $card = $(el);
    const title = $card.find(".link_box_title h3, .link_box_title h2").first().text().trim();
    if (!title || seen.has(title)) return;
    seen.add(title);

    const href = $card.find("a.link_box_button, a[class*='link_box']").first().attr("href") ?? null;
    if (!href) return;
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    const descText = $card.find(".link_box_text p").first().text().trim();
    const description = descText || null;

    // Amount may appear in overview card description
    const amountMatch = descText.match(/(?:up\s+to\s+)?(£[\d,]+)/i);
    const amountRaw = amountMatch ? amountMatch[0].trim() : null;

    results.push({ title, url, description, amountRaw });
  });

  return results;
}

/**
 * Parse an individual BOU grant sub-page for amount and deadline.
 *
 * Title: <span class="entry-title"> (Avada theme)
 * Amount: £ in prose <p>
 * Deadline:
 *   - <p><strong>Closing date for applications...: DD Month YYYY</strong></p>
 *   - <p>Application deadline: DD Month YYYY</p>
 */
export function parseBouGrantPage(html: string): {
  title: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
  status: string;
} {
  const $ = cheerio.load(html);

  const title = $("span.entry-title, h1.entry-title, .page-title span").first().text().trim() || null;

  const bodyText = $("main, article, .fusion-post-content, body").first().text();

  // Amount: first £ mention in body
  let amountRaw: string | null = null;
  const amountMatch = bodyText.match(/(?:up\s+to\s+)?(£[\d,]+)/i);
  if (amountMatch) amountRaw = amountMatch[0].trim();

  // Deadline: "Closing date for applications...: DD Month YYYY" or "Application deadline: DD Month YYYY"
  let deadlineRaw: string | null = null;
  const deadlineMatch = bodyText.match(
    /(?:closing date for applications|application deadline)[^:\n]*:\s*(\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})/i
  );
  if (deadlineMatch) {
    deadlineRaw = deadlineMatch[1].replace(",", "").trim();
  }

  let status = "open";
  if (deadlineRaw) {
    const parsed = new Date(deadlineRaw);
    if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
  }

  return { title, amountRaw, deadlineRaw, status };
}

export async function fetchBouGrants(): Promise<RawBouGrant[]> {
  console.log(`  Fetching BOU funding overview: ${FUNDING_URL}`);
  const overviewRes = await fetchWithRetry(FUNDING_URL);
  if (!overviewRes.ok) {
    console.warn(`  BOU: ${FUNDING_URL} returned ${overviewRes.status} — skipping`);
    return [];
  }

  const overviewHtml = await overviewRes.text();
  const listings = parseBouOverviewPage(overviewHtml);

  console.log(`  BOU: fetching ${listings.length} individual scheme pages`);

  const grants: RawBouGrant[] = [];
  for (const { title, url, description, amountRaw: listingAmount } of listings) {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`  BOU: ${url} returned ${res.status} — using listing data only`);
      grants.push({
        title,
        url,
        status: "open",
        description,
        amountRaw: listingAmount,
        deadlineRaw: null,
      });
      continue;
    }

    const subHtml = await res.text();
    const details = parseBouGrantPage(subHtml);

    grants.push({
      title: details.title ?? title,
      url,
      status: details.status,
      description,
      amountRaw: details.amountRaw ?? listingAmount,
      deadlineRaw: details.deadlineRaw,
    });
  }

  console.log(`  Found ${grants.length} BOU grant entries`);
  return grants;
}
