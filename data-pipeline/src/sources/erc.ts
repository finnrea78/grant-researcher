import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawERCScheme } from "../transforms/normalise-erc.js";

const APPLY_URL = "https://erc.europa.eu/apply-grant";
const BASE_URL = "https://erc.europa.eu";

// ERC grant types to include (matched against aria-label on card anchors)
const INCLUDE_TYPES = [
  "ERC Starting Grant",
  "ERC Consolidator Grant",
  "ERC Advanced Grant",
  "ERC Proof of Concept",
  "ERC Synergy Grant",
  "ERC Plus Grant",
];

export function parseERCApplyPage(html: string): Array<{ title: string; url: string }> {
  const $ = cheerio.load(html);
  const items: Array<{ title: string; url: string }> = [];

  // Grant type cards: <a arial-label="ERC ..."> within .card-oe-rich elements
  $("a[arial-label]").each((_i, el) => {
    const $el = $(el);
    const label = ($el.attr("arial-label") ?? "").trim();
    if (!INCLUDE_TYPES.includes(label)) return;

    const href = $el.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    items.push({ title: label, url });
  });

  if (items.length === 0) {
    throw new Error("ERC: no grant type cards found — page structure may have changed");
  }

  return items;
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

async function fetchGrantDetail(url: string): Promise<{ description: string | null; eligibility: string | null }> {
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return { description: null, eligibility: null };
    const html = await response.text();
    const $ = cheerio.load(html);

    const descParts: string[] = [];
    $("main p, .paragraph p, .field--name-body p, article p").each((_i, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 60) descParts.push(text);
    });
    const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

    const eligibility = extractSection($, /eligibility|who can apply|who is eligible|requirements/i);

    return { description, eligibility };
  } catch {
    return { description: null, eligibility: null };
  }
}

export async function fetchERCSchemes(): Promise<RawERCScheme[]> {
  console.log(`  Fetching ERC grant types: ${APPLY_URL}`);

  const response = await fetchWithRetry(APPLY_URL);
  if (!response.ok) {
    throw new Error(`ERC error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const items = parseERCApplyPage(html);

  // Fetch descriptions and eligibility in parallel
  const withDetails = await Promise.all(
    items.map(async (item) => {
      const { description, eligibility } = await fetchGrantDetail(item.url);
      return { ...item, description, eligibility };
    })
  );

  console.log(`  Found ${withDetails.length} ERC grant types`);

  return withDetails.map((item) => ({
    title: item.title,
    url: item.url,
    status: "open",
    description: item.description,
    eligibility: item.eligibility,
  }));
}
