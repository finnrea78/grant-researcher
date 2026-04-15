import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawLmsGrant } from "../transforms/normalise-lms.js";

const BASE_URL = "https://www.lms.ac.uk";
const GRANTS_URL = `${BASE_URL}/grants/`;
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

export function parseLmsDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
  deadlineRaw: string | null;
} {
  const $ = cheerio.load(html);

  // Description: substantial paragraphs from main content area
  const descParts: string[] = [];
  $("main p, .field--name-body p, article p, .field--type-text-with-summary p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility
  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

  // Deadline: look for closing dates or application deadlines
  const bodyText = $("body").text();
  const deadlineMatch = bodyText.match(
    /(?:deadline|closing date|closes?|applications?\s+(?:by|close|deadline))[:\s]+([A-Za-z0-9 ,]+(?:\d{4})?)/i
  );
  const deadlineRaw = deadlineMatch ? deadlineMatch[1].trim().slice(0, 100) : null;

  return { description, eligibility, deadlineRaw };
}

// Slugs to skip — category overview/policy pages, not individual schemes
const SKIP_SLUG_RE =
  /general-policy|other-sources|research-grants$|education-grants$|international-grants$|women\/grants$|funding-for-external-events/;

/**
 * Parse the London Mathematical Society grants listing page.
 *
 * Structure: Drupal page with `div.field--name-body` content.
 *   - Top-level schemes: <p><strong><a href="/grants/...">Title</a></strong> – up to £X</p>
 *   - Committee schemes: <li><b>Scheme N: <a href="...">Title</a></b> – up to £X</li>
 *   - Other schemes:     <li><a href="..."><strong>Title</strong></a> – up to £X</li>
 *
 * Filter: only items with <strong>/<b> and a /grants/ link (excludes prose refs).
 * Status: all rolling (no deadline dates on listing page).
 */
export function parseLmsPage(html: string): RawLmsGrant[] {
  const $ = cheerio.load(html);
  const grants: RawLmsGrant[] = [];
  const seen = new Set<string>();

  const $body = $(".field--name-body, .field--type-text-with-summary").first();
  if (!$body.length) return grants;

  $body.find("p, li").each((_i, el) => {
    const $el = $(el);

    // Must have bold/strong to distinguish named schemes from inline prose links
    if (!$el.find("strong, b").length) return;

    const $link = $el.find("a").first();
    if (!$link.length) return;

    const href = $link.attr("href") ?? "";
    if (!href) return;

    // Skip category-level or policy pages
    if (SKIP_SLUG_RE.test(href)) return;

    // Must be a grants or events/lms path (not external unrelated pages)
    const isLmsGrant =
      href.includes("lms.ac.uk/grants/") ||
      href.includes("lms.ac.uk/events/lms-") ||
      href.includes("lms.ac.uk/prizes/") ||
      href.startsWith("/grants/") ||
      href.startsWith("/events/lms-") ||
      href.startsWith("/prizes/");
    if (!isLmsGrant) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // De-duplicate (same scheme appears twice in different sections)
    if (seen.has(url)) return;
    seen.add(url);

    // Title: link text (handles all patterns — text inside <a> regardless of inner <strong>/<b>)
    const title = $link.text().trim();
    if (!title) return;

    // Amount: first £ match in the element text
    const elText = $el.text();
    const amountMatch = elText.match(/£[\d,]+(?:\s*-\s*£[\d,]+)?/);
    const amountRaw = amountMatch ? amountMatch[0] : null;

    grants.push({ title, url, status: "open", description: null, eligibility: null, deadlineRaw: null, amountRaw });
  });

  return grants;
}

export async function fetchLmsGrants(): Promise<RawLmsGrant[]> {
  console.log(`  Fetching LMS grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  LMS: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseLmsPage(html);
  console.log(`  Found ${grants.length} LMS grant entries`);

  // Enrich each grant with detail-page content
  for (const item of grants) {
    if (!item.url) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(item.url);
      if (!detailRes.ok) {
        console.warn(`  LMS detail fetch failed: ${detailRes.status} ${item.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseLmsDetailPage(detailHtml);
      if (enriched.description) item.description = enriched.description;
      if (enriched.eligibility) item.eligibility = enriched.eligibility;
      if (enriched.deadlineRaw) item.deadlineRaw = enriched.deadlineRaw;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return grants;
}
