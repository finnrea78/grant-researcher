import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawInnovateUKCompetition } from "../transforms/normalise-innovate-uk.js";

const BASE_URL = "https://apply-for-innovation-funding.service.gov.uk";
const SEARCH_URL = `${BASE_URL}/competition/search`;

export function parseInnovateUKPage(html: string): RawInnovateUKCompetition[] {
  const $ = cheerio.load(html);
  const competitions: RawInnovateUKCompetition[] = [];

  $("ul.govuk-list > li").each((_i, el) => {
    const $li = $(el);

    // Title and URL from h2 > a
    const $link = $li.find("h2.govuk-heading-m a.govuk-link");
    const title = $link.text().trim();
    if (!title) return;

    const href = $link.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Description from first div.wysiwyg-styles (contains amount text)
    const $descDivs = $li.find("div.wysiwyg-styles");
    const description = $descDivs.first().text().trim() || null;

    // Eligibility from second div.wysiwyg-styles (after h3 "Eligibility")
    const eligibility = $descDivs.eq(1).text().trim() || null;

    // Status from h3 before the date list
    const $statusH3 = $li.find("dl.date-definition-list").prev("h3.govuk-heading-s");
    const statusText = $statusH3.text().trim().toLowerCase();
    let status: string;
    if (statusText.includes("open now")) {
      status = "open";
    } else if (statusText.includes("opening soon")) {
      status = "opening_soon";
    } else {
      status = "closed";
    }

    // Dates from dl.date-definition-list
    const $dl = $li.find("dl.date-definition-list");
    let openDateRaw: string | null = null;
    let closeDateRaw: string | null = null;

    $dl.find("dt").each((_j, dtEl) => {
      const dtText = $(dtEl).text().trim().toLowerCase();
      const ddText = $(dtEl).next("dd").text().trim();
      if (dtText === "opens:" || dtText === "opened:") {
        openDateRaw = ddText || null;
      } else if (dtText === "closes:") {
        closeDateRaw = ddText || null;
      }
    });

    // Extract amount from description text
    // Patterns: "up to £4.5 million", "£20 million", "a share of £25 million"
    const amountMatch = description?.match(
      /(?:up\s+to\s+|a\s+share\s+of\s+(?:up\s+to\s+)?)?([£€$][\d.,]+(?:\s*(?:million|thousand|k))?)/i
    );
    const amountRaw = amountMatch ? amountMatch[0].trim() : null;

    competitions.push({
      title,
      url,
      status,
      description,
      eligibility,
      amountRaw,
      openDateRaw,
      closeDateRaw,
    });
  });

  if (competitions.length === 0) {
    throw new Error("Innovate UK: no competition listings found — page structure may have changed");
  }

  return competitions;
}

export function extractNextPageUrl(html: string): string | null {
  const $ = cheerio.load(html);
  const $next = $("ul.pagination li.next a.govuk-link");
  if (!$next.length) return null;
  const href = $next.attr("href");
  if (!href) return null;
  return href.startsWith("http") ? href : `${SEARCH_URL}${href}`;
}

export async function fetchInnovateUKCompetitions(): Promise<RawInnovateUKCompetition[]> {
  const allCompetitions: RawInnovateUKCompetition[] = [];
  let url: string | null = SEARCH_URL;
  let page = 0;

  while (url) {
    console.log(`  Fetching Innovate UK competitions (page ${page}): ${url}`);
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      if (page === 0) {
        throw new Error(`Innovate UK error: ${response.status} ${response.statusText}`);
      }
      // Non-fatal on subsequent pages
      console.warn(`  Innovate UK page ${page} returned ${response.status} — stopping pagination`);
      break;
    }

    const html = await response.text();
    const pageCompetitions = parseInnovateUKPage(html);
    allCompetitions.push(...pageCompetitions);

    url = extractNextPageUrl(html);
    page++;

    if (page > 10) {
      // Safety cap — never fetch more than 10 pages
      console.warn("  Innovate UK: reached 10-page cap, stopping pagination");
      break;
    }
  }

  console.log(`  Found ${allCompetitions.length} competitions from Innovate UK`);
  return allCompetitions;
}
