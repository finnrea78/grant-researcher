import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawLmsGrant } from "../transforms/normalise-lms.js";

const BASE_URL = "https://www.lms.ac.uk";
const GRANTS_URL = `${BASE_URL}/grants/`;

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

    grants.push({ title, url, status: "open", description: null, amountRaw });
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
  return grants;
}
