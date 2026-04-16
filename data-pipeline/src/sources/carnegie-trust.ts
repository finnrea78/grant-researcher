import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawCarnegieTrustScheme } from "../transforms/normalise-carnegie-trust.js";

const SCHEMES_URL = "https://carnegie-trust.org/award-schemes/";
const BASE_URL = "https://carnegie-trust.org";

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

export function parseCarnegieTrustPage(html: string): RawCarnegieTrustScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawCarnegieTrustScheme[] = [];

  $("a.card-preview").each((_i, el) => {
    const $el = $(el);

    const href = $el.attr("href") ?? "";
    if (!href) return;
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    const title = $el.find("h2").first().text().trim();
    if (!title) return;

    const bodyText = $el.find(".text-body").text().trim();

    // Detect closed status from body text
    const isClosed = /currently closed|not.*accepting|no longer accepting/i.test(bodyText);
    const status = isClosed ? "closed" : "open";

    // Description: body text from the card
    const description = bodyText || null;

    schemes.push({ title, url, status, description, eligibility: null });
  });

  if (schemes.length === 0) {
    throw new Error("Carnegie Trust: no scheme cards found — page structure may have changed");
  }

  return schemes;
}

/**
 * Parse a Carnegie Trust detail page for richer description and eligibility.
 */
export function parseCarnegieTrustDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
} {
  const $ = cheerio.load(html);

  // Multi-paragraph description from main content
  const descParts: string[] = [];
  $("main p, article p, .entry-content p, .page-content p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility from heading section
  const eligibility = extractSection($, /eligib|who\s+can\s+apply|who\s+is\s+eligible/i);

  return { description, eligibility };
}

export async function fetchCarnegieTrustSchemes(): Promise<RawCarnegieTrustScheme[]> {
  console.log(`  Fetching Carnegie Trust schemes: ${SCHEMES_URL}`);

  const response = await fetchWithRetry(SCHEMES_URL);
  if (!response.ok) {
    throw new Error(`Carnegie Trust error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseCarnegieTrustPage(html);
  console.log(`  Found ${schemes.length} schemes from Carnegie Trust`);

  // Enrich with detail-page descriptions and eligibility
  for (const scheme of schemes) {
    if (!scheme.url || scheme.url === SCHEMES_URL) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(scheme.url);
      if (!res.ok) continue;
      const detailHtml = await res.text();
      const { description, eligibility } = parseCarnegieTrustDetailPage(detailHtml);
      if (description) scheme.description = description;
      if (eligibility) scheme.eligibility = eligibility;
    } catch { /* skip on error */ }
  }

  return schemes;
}
