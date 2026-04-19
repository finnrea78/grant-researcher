import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawWellcomeScheme } from "../transforms/normalise-wellcome.js";

const SCHEMES_URL = "https://wellcome.org/grant-funding/schemes";
const WELLCOME_BASE = "https://wellcome.org";

const DETAIL_DELAY_MS = 300;

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
}

interface WellcomeApiListing {
  id: string;
  url: string;
  title: string;
  listing_summary: string;
  scheme_status: string;
  level_of_funding: string;
  duration_of_funding: string;
  scheme_closes_for_applications: string | null;
  frequency: string;
  lead_applicant_career_stage: Array<{ name: string }>;
  location_ref: Array<{ name: string }>;
}

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

export function parseWellcomeDetailPage(html: string): { description: string | null; eligibility: string | null } {
  const $ = cheerio.load(html);

  // Try __NEXT_DATA__ first for structured content
  const nextDataRaw = $("#__NEXT_DATA__").html();
  if (nextDataRaw) {
    try {
      const data = JSON.parse(nextDataRaw);
      const pageProps = data?.props?.pageProps;

      // Wellcome detail pages often have body_text or similar fields
      const bodyText =
        pageProps?.body_text ||
        pageProps?.scheme?.body_text ||
        pageProps?.data?.body_text ||
        null;

      if (bodyText) {
        const descParts: string[] = [];
        const $body = cheerio.load(typeof bodyText === "string" ? bodyText : JSON.stringify(bodyText));
        $body("p").each((_i, el) => {
          const text = $body(el).text().trim();
          if (text.length > 60) descParts.push(text);
        });
        if (descParts.length > 0) {
          return {
            description: descParts.join("\n\n").slice(0, 2000),
            eligibility: null,
          };
        }
      }
    } catch {
      // Fall through to HTML parsing
    }
  }

  // Fall back to HTML parsing
  const descParts: string[] = [];
  $("main p, article p, .content p, [class*='body'] p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /eligibility|who can apply|who is eligible|criteria/i);

  return { description, eligibility };
}

export function parseWellcomePage(html: string): RawWellcomeScheme[] {
  const $ = cheerio.load(html);
  const scriptTag = $("#__NEXT_DATA__").html();
  if (!scriptTag) {
    throw new Error("Wellcome: __NEXT_DATA__ script tag not found");
  }

  const data = JSON.parse(scriptTag);
  const listings: WellcomeApiListing[] = data.props?.pageProps?.initialListings;
  if (!listings) {
    throw new Error("Wellcome: initialListings not found in page data");
  }

  return listings.map((item) => ({
    title: item.title,
    url: item.url.startsWith("http") ? item.url : `${WELLCOME_BASE}${item.url}`,
    status: item.scheme_status,
    deadline: item.scheme_closes_for_applications ?? "",
    fundingLevel: stripHtml(item.level_of_funding),
    duration: stripHtml(item.duration_of_funding),
    careerStage: item.lead_applicant_career_stage.map((s) => s.name).join(", "),
    location: item.location_ref.map((l) => l.name).join(", "),
    description: stripHtml(item.listing_summary),
    frequency: item.frequency,
    eligibility: null,
  }));
}

export async function fetchWellcomeSchemes(): Promise<RawWellcomeScheme[]> {
  console.log(`  Fetching Wellcome schemes: ${SCHEMES_URL}`);

  const response = await fetchWithRetry(SCHEMES_URL);
  if (!response.ok) {
    console.warn(`  Wellcome: HTTP ${response.status} — site may be blocking automated requests. Skipping.`);
    return [];
  }

  const html = await response.text();

  let schemes: RawWellcomeScheme[];
  try {
    schemes = parseWellcomePage(html);
  } catch (err) {
    console.warn(`  Wellcome: failed to parse listing page (${(err as Error).message}) — site may have changed or added bot protection. Skipping.`);
    return [];
  }

  console.log(`  Found ${schemes.length} schemes from Wellcome`);

  // Enrich from detail pages
  for (const item of schemes) {
    if (!item.url) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(item.url);
      if (!res.ok) continue;
      const detailHtml = await res.text();
      const { description, eligibility } = parseWellcomeDetailPage(detailHtml);
      if (description && description.length > (item.description?.length ?? 0)) {
        item.description = description;
      }
      if (eligibility) item.eligibility = eligibility;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return schemes;
}
