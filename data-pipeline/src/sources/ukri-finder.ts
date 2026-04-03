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

/**
 * Fetch and parse the UKRI Funding Finder listing page.
 * Optionally filter by council slug (e.g. "ahrc", "epsrc").
 */
export async function fetchUkriOpportunities(
  council?: string
): Promise<RawUkriOpportunity[]> {
  let url = BASE_URL;
  if (council) {
    url += `?filter_council[]=${encodeURIComponent(council)}`;
  }

  console.log(`  Fetching UKRI Funding Finder: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`UKRI Funding Finder error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const opportunities: RawUkriOpportunity[] = [];

  // UKRI lists opportunities in article/card elements.
  // Selector may need adjustment if UKRI changes their markup.
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

      // Extract council name from tags or text
      const councilMatch = textContent.match(
        /\b(AHRC|BBSRC|EPSRC|ESRC|MRC|NERC|STFC|Innovate UK|Research England)\b/i
      );

      // Extract closing date
      const dateMatch = textContent.match(
        /(?:clos(?:es|ing)|deadline)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i
      );

      // Extract funding amount
      const amountMatch = textContent.match(
        /(£[\d,.]+(?:\s*(?:million|k|m))?(?:\s*[-–]\s*£[\d,.]+(?:\s*(?:million|k|m))?)?)/i
      );

      opportunities.push({
        title,
        url: fullUrl ?? url,
        council: councilMatch ? councilMatch[1] : null,
        closingDate: dateMatch ? dateMatch[1] : null,
        fundingAmount: amountMatch ? amountMatch[1] : null,
        status: "open",
      });
    }
  );

  console.log(`  Found ${opportunities.length} opportunities on UKRI Funding Finder`);
  return opportunities;
}
