import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawBloodCancerUKScheme } from "../transforms/normalise-blood-cancer-uk.js";

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

export function parseBloodCancerUKDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
} {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  $("main p, article p, .entry-content p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /eligibilit|who\s+can\s+apply|who\s+is\s+eligible/i);

  return { description, eligibility };
}

const FUNDING_URL = "https://bloodcancer.org.uk/research/funding/apply-for-funding/";
const BASE_URL = "https://bloodcancer.org.uk";

export function parseBloodCancerUKPage(html: string): RawBloodCancerUKScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawBloodCancerUKScheme[] = [];

  $("section > div").each((_i, el) => {
    const $link = $(el).find("a").first();
    if (!$link.length) return;

    const title = $link.find("h3").text().trim();
    if (!title) return;

    const href = $link.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Description: first <p> inside the link
    const description = $link.find("p").first().text().trim() || null;

    // Status from first <strong> inside the link
    // "Call closed" → closed, "Call open" / "Now open" / etc → open
    const statusText = $link.find("strong").first().text().trim().toLowerCase();
    const status = /open/i.test(statusText) ? "open" : "closed";

    // Next call from strong elements — look for one containing "Next call:"
    let nextCallRaw: string | null = null;
    $link.find("strong").each((_j, strongEl) => {
      const text = $(strongEl).text().trim();
      if (/next call:/i.test(text)) {
        nextCallRaw = text.replace(/^next call:\s*/i, "").trim();
      }
    });

    schemes.push({ title, url, status, description, eligibility: null, nextCallRaw });
  });

  if (schemes.length === 0) {
    throw new Error("Blood Cancer UK: no funding scheme entries found — page structure may have changed");
  }

  return schemes;
}

export async function fetchBloodCancerUKSchemes(): Promise<RawBloodCancerUKScheme[]> {
  console.log(`  Fetching Blood Cancer UK funding schemes: ${FUNDING_URL}`);

  const response = await fetchWithRetry(FUNDING_URL);
  if (!response.ok) {
    throw new Error(`Blood Cancer UK error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseBloodCancerUKPage(html);
  console.log(`  Found ${schemes.length} funding schemes from Blood Cancer UK`);

  // Enrich with detail-page descriptions and eligibility
  for (const scheme of schemes) {
    if (!scheme.url || scheme.url === FUNDING_URL) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(scheme.url);
      if (!res.ok) continue;
      const detailHtml = await res.text();
      const { description, eligibility } = parseBloodCancerUKDetailPage(detailHtml);
      if (description) scheme.description = description;
      if (eligibility) scheme.eligibility = eligibility;
    } catch { /* skip on error */ }
  }

  return schemes;
}
