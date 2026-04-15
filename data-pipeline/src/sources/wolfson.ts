import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawWolfsonScheme } from "../transforms/normalise-wolfson.js";

const PLACES_URL = "https://www.wolfson.org.uk/funding/funding-for-places/";
const PEOPLE_URL = "https://www.wolfson.org.uk/funding/funding-for-people/";
const BASE_URL = "https://www.wolfson.org.uk";

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
    schemes.push({ title, url, status: "open", description: null, programme: "places" });
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

    schemes.push({ title, url, status: "open", description: description || null, programme: "people" });
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
  return all;
}
