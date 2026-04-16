import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawWolfsonScheme } from "../transforms/normalise-wolfson.js";

const PLACES_URL = "https://www.wolfson.org.uk/funding/funding-for-places/";
const PEOPLE_URL = "https://www.wolfson.org.uk/funding/funding-for-people/";
const BASE_URL = "https://www.wolfson.org.uk";
const DETAIL_DELAY_MS = 400;

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

export function parseWolfsonDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
} {
  const $ = cheerio.load(html);

  // Description: collect substantial paragraphs from the main content area
  const descParts: string[] = [];
  $("main p, .entry-content p, article p, .et_pb_text p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility
  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

  // Amount: look for £N,000 range patterns
  const bodyText = $("body").text();
  const amountMatch = bodyText.match(
    /(?:minimum\s+grant[:\s]+)?(£[\d,]+(?:\s*[–-]\s*£[\d,]+)?(?:\s*(?:k|m|million))?)/i
  );
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  // Deadline: look for Stage 1 close date
  const deadlineMatch = bodyText.match(
    /Stage\s+1\s+(?:closes?|deadline)[:\s]+([^\n,;]+(?:\d{4})?)/i
  );
  const deadlineRaw = deadlineMatch ? deadlineMatch[1].trim() : null;

  return { description, eligibility, amountRaw, deadlineRaw };
}

/**
 * Extract capital-grant sub-category opportunities from the "Funding for places" page.
 * Each sub-category (e.g. Museums & Galleries, Universities & Research Institutions) is
 * treated as one rolling opportunity — Wolfson does not publish discrete open/closed calls.
 */
export function parseWolfsonPlacesPage(html: string): RawWolfsonScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawWolfsonScheme[] = [];

  // Sub-category links live in the body content as anchors to /funding/funding-for-places/<slug>/
  $("a[href*='/funding/funding-for-places/']").each((_i, el) => {
    const $el = $(el);
    const href = $el.attr("href") ?? "";
    // Skip the parent page itself and navigation links with no descriptive text
    if (!href.match(/\/funding\/funding-for-places\/[^/]+\//)) return;
    const title = $el.text().replace(/&amp;/g, "&").trim();
    if (!title || /View|Apply|Read|Learn|Find|Guide/i.test(title)) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    schemes.push({ title, url, status: "open", description: null, eligibility: null, amountRaw: null, deadlineRaw: null, programme: "places" });
  });

  return schemes;
}

/**
 * Extract named fellowship/scholarship programmes from the "Funding for people" page.
 */
export function parseWolfsonPeoplePage(html: string): RawWolfsonScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawWolfsonScheme[] = [];

  // Programmes are in column divs. Each has heading text + description + a "View" link.
  // We walk <p> text blocks and look for bold/strong programme names or heading-like paragraphs.
  // Strategy: find all links to /funding/funding-for-people/<slug>/ and work backwards for context.
  $("a[href*='/funding/funding-for-people/']").each((_i, el) => {
    const $el = $(el);
    const href = $el.attr("href") ?? "";
    if (!href.match(/\/funding\/funding-for-people\/[^/]+\//)) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Title: look for the nearest preceding heading or strong text in the parent column
    const $col = $el.closest("[class*='et_pb_column']");
    let title = "";
    let description = "";

    if ($col.length) {
      // First <p> is the programme name (bold text in real HTML)
      const paras = $col.find("p");
      paras.each((_j, p) => {
        const text = $(p).text().trim();
        if (!title && text && !/Students|Employees|Academic/i.test(text)) {
          title = text;
        } else if (title && !description && text) {
          description = text;
        }
      });
    }

    if (!title) {
      // Fallback: derive title from URL slug
      const slug = href.split("/").filter(Boolean).pop() ?? "";
      title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    schemes.push({ title, url, status: "open", description: description || null, eligibility: null, amountRaw: null, deadlineRaw: null, programme: "people" });
  });

  return schemes;
}

export async function fetchWolfsonSchemes(): Promise<RawWolfsonScheme[]> {
  console.log(`  Fetching Wolfson Foundation schemes`);

  const [placesResp, peopleResp] = await Promise.all([
    fetchWithRetry(PLACES_URL),
    fetchWithRetry(PEOPLE_URL),
  ]);

  if (!placesResp.ok) {
    throw new Error(`Wolfson places error: ${placesResp.status} ${placesResp.statusText}`);
  }
  if (!peopleResp.ok) {
    throw new Error(`Wolfson people error: ${peopleResp.status} ${peopleResp.statusText}`);
  }

  const [placesHtml, peopleHtml] = await Promise.all([
    placesResp.text(),
    peopleResp.text(),
  ]);

  const placesSchemes = parseWolfsonPlacesPage(placesHtml);
  const peopleSchemes = parseWolfsonPeoplePage(peopleHtml);

  const all = [...placesSchemes, ...peopleSchemes];

  if (all.length === 0) {
    throw new Error("Wolfson: no schemes found — page structure may have changed");
  }

  console.log(
    `  Found ${placesSchemes.length} place-grant categories and ${peopleSchemes.length} people programmes`
  );

  // Enrich each scheme with detail-page content
  for (const item of all) {
    if (!item.url) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(item.url);
      if (!detailRes.ok) {
        console.warn(`  Wolfson detail fetch failed: ${detailRes.status} ${item.url}`);
        continue;
      }
      const detailHtml = await detailRes.text();
      const enriched = parseWolfsonDetailPage(detailHtml);
      if (enriched.description) item.description = enriched.description;
      if (enriched.eligibility) item.eligibility = enriched.eligibility;
      if (enriched.amountRaw) item.amountRaw = enriched.amountRaw;
      if (enriched.deadlineRaw) item.deadlineRaw = enriched.deadlineRaw;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return all;
}
