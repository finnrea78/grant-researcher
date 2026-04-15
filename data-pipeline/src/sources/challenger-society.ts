import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawChallengerSocietyGrant } from "../transforms/normalise-challenger-society.js";

const BASE_URL = "https://challenger-society.org.uk";
const GRANTS_URL = `${BASE_URL}/awards-and-grants/`;

// Non-grant honorary/award-only schemes to skip
const SKIP_TITLE_RE = /honorary membership|challenger medal|meeting prize|^awards?\s*$/i;

/**
 * Parse the Challenger Society awards-and-grants listing page.
 *
 * Flat WordPress Gutenberg structure inside div.entry-content:
 *   <h4 class="wp-block-heading">[<a href="sub-page">]Title[</a>]</h4>
 *   <p class="wp-block-paragraph">Description with optional £ amount.</p>
 */
export function parseChallengerListingPage(html: string): Array<{
  title: string;
  url: string;
  subpageUrl: string | null;
  amountRaw: string | null;
  description: string | null;
}> {
  const $ = cheerio.load(html);
  const results: ReturnType<typeof parseChallengerListingPage> = [];
  const seen = new Set<string>();

  $(".entry-content h4.wp-block-heading, article h4.wp-block-heading").each((_i, h4el) => {
    const $h4 = $(h4el);
    const $link = $h4.find("a").first();
    const title = $h4.text().trim();

    if (!title || SKIP_TITLE_RE.test(title) || seen.has(title)) return;
    seen.add(title);

    const subHref = $link.attr("href") ?? null;
    const subpageUrl = subHref
      ? subHref.startsWith("http") ? subHref : `${BASE_URL}${subHref}`
      : null;
    const url = subpageUrl ?? GRANTS_URL;

    // Collect following p siblings until next h4
    let amountRaw: string | null = null;
    let description: string | null = null;
    let $el = $h4.next();
    while ($el.length && !$el.is("h4, h3, h2")) {
      const tag = $el.prop("tagName")?.toLowerCase();
      if (tag === "p") {
        const text = $el.text().trim();
        if (!amountRaw) {
          const match = text.match(/(?:up\s+to\s+)?(£[\d,]+)/i);
          if (match) amountRaw = match[0].trim();
        }
        if (!description && text.length > 20) {
          description = text;
        }
      }
      $el = $el.next();
    }

    results.push({ title, url, subpageUrl, amountRaw, description });
  });

  return results;
}

/**
 * Parse an individual Challenger Society grant sub-page for deadline, description, and eligibility.
 */
export function parseChallengerGrantPage(html: string): {
  deadlineRaw: string | null;
  description: string | null;
  eligibility: string | null;
} {
  const $ = cheerio.load(html);
  let deadlineRaw: string | null = null;

  // Look for specific date patterns: "30th April 2026", "January 15th", etc.
  const bodyText = $(".entry-content, article, main").first().text();
  const dateMatch = bodyText.match(
    /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i
  );
  if (dateMatch) {
    deadlineRaw = dateMatch[1].replace(/(\d+)(st|nd|rd|th)/i, "$1").trim();
  }

  // Multi-paragraph description from main content
  const descParts: string[] = [];
  $(".entry-content p, article p, main p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility from heading sections
  let eligibility: string | null = null;
  $("h2, h3, h4").each((_i, el) => {
    if (eligibility !== null) return;
    if (!/eligib|who\s+can\s+apply|who\s+is\s+eligible/i.test($(el).text().trim())) return;
    const parts: string[] = [];
    let sibling = $(el).next();
    while (sibling.length && !sibling.is("h2, h3, h4")) {
      const text = sibling.text().trim();
      if (text) parts.push(text);
      sibling = sibling.next();
    }
    if (parts.length > 0) eligibility = parts.join("\n\n").slice(0, 1500);
  });

  return { deadlineRaw, description, eligibility };
}

export async function fetchChallengerSocietyGrants(): Promise<RawChallengerSocietyGrant[]> {
  console.log(`  Fetching Challenger Society grants: ${GRANTS_URL}`);
  const listingRes = await fetchWithRetry(GRANTS_URL);
  if (!listingRes.ok) {
    console.warn(`  Challenger Society: ${GRANTS_URL} returned ${listingRes.status} — skipping`);
    return [];
  }

  const listingHtml = await listingRes.text();
  const listings = parseChallengerListingPage(listingHtml);

  const grants: RawChallengerSocietyGrant[] = [];
  for (const { title, url, subpageUrl, amountRaw, description: listingDescription } of listings) {
    let deadlineRaw: string | null = null;
    let description = listingDescription;
    let eligibility: string | null = null;

    if (subpageUrl) {
      const subRes = await fetchWithRetry(subpageUrl);
      if (subRes.ok) {
        const subHtml = await subRes.text();
        const parsed = parseChallengerGrantPage(subHtml);
        deadlineRaw = parsed.deadlineRaw;
        if (parsed.description) description = parsed.description;
        if (parsed.eligibility) eligibility = parsed.eligibility;
      }
    }

    let status = "open";
    if (deadlineRaw) {
      const parsed = new Date(deadlineRaw);
      if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
    }

    grants.push({ title, url, status, amountRaw, deadlineRaw, description, eligibility });
  }

  console.log(`  Found ${grants.length} Challenger Society grant entries`);
  return grants;
}
