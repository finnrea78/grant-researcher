import * as cheerio from "cheerio";

const BASE_URL = "https://www.ukri.org/opportunity/";

export interface RawUkriOpportunity {
  title: string;
  url: string;
  council: string | null;
  closingDate: string | null;
  fundingAmount: string | null;
  status: string | null;
}

function parsePageOpportunities($: cheerio.CheerioAPI, pageUrl: string): RawUkriOpportunity[] {
  const opportunities: RawUkriOpportunity[] = [];

  $("article, .opportunity-item, .listing-item, [class*='opportunity']").each(
    (_i, el) => {
      const $el = $(el);
      const title =
        $el.find("h2, h3, [class*='title']").first().text().trim() ||
        $el.find("a").first().text().trim();

      if (!title) return;

      const link = $el.find("a").first().attr("href") ?? null;
      const fullUrl = link
        ? link.startsWith("http") ? link : `https://www.ukri.org${link}`
        : null;

      const textContent = $el.text();

      const councilMatch = textContent.match(
        /\b(AHRC|BBSRC|EPSRC|ESRC|MRC|NERC|STFC|Innovate UK|Research England)\b/i
      );

      const dateMatch = textContent.match(
        /(?:clos(?:es|ing)|deadline)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i
      );

      const amountMatch = textContent.match(
        /(£[\d,.]+(?:\s*(?:million|k|m))?(?:\s*[-–]\s*£[\d,.]+(?:\s*(?:million|k|m))?)?)/i
      );

      opportunities.push({
        title,
        url: fullUrl ?? pageUrl,
        council: councilMatch ? councilMatch[1] : null,
        closingDate: dateMatch ? dateMatch[1] : null,
        fundingAmount: amountMatch ? amountMatch[1] : null,
        status: "open",
      });
    }
  );

  return opportunities;
}

function getTotalPages($: cheerio.CheerioAPI): number {
  // Look for the last page number in pagination links
  let max = 1;
  $("a[href*='/page/']").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const match = href.match(/\/page\/(\d+)\//);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  });
  return max;
}

/**
 * Fetch and parse all pages of the UKRI Funding Finder.
 * Optionally filter by council slug (e.g. "ahrc", "epsrc").
 */
export async function fetchUkriOpportunities(
  council?: string
): Promise<RawUkriOpportunity[]> {
  const buildUrl = (page: number) => {
    const base = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
    return council ? `${base}?filter_council[]=${encodeURIComponent(council)}` : base;
  };

  // Fetch page 1 to get total page count
  const firstUrl = buildUrl(1);
  console.log(`  Fetching UKRI Funding Finder: ${firstUrl}`);
  const firstResponse = await fetch(firstUrl);
  if (!firstResponse.ok) {
    throw new Error(`UKRI Funding Finder error: ${firstResponse.status} ${firstResponse.statusText}`);
  }

  const firstHtml = await firstResponse.text();
  const $first = cheerio.load(firstHtml);
  const totalPages = getTotalPages($first);
  const opportunities: RawUkriOpportunity[] = parsePageOpportunities($first, firstUrl);

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    const pageUrl = buildUrl(page);
    console.log(`  Fetching page ${page}/${totalPages}: ${pageUrl}`);
    const response = await fetch(pageUrl);
    if (!response.ok) {
      console.warn(`  Page ${page} failed: ${response.status} — skipping`);
      continue;
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    opportunities.push(...parsePageOpportunities($, pageUrl));
  }

  console.log(`  Found ${opportunities.length} opportunities across ${totalPages} pages`);
  return opportunities;
}
