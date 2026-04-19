import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawLeverhulmeScheme } from "../transforms/normalise-leverhulme.js";

const SCHEMES_URL = "https://www.leverhulme.ac.uk/schemes-at-a-glance";
const BASE_URL = "https://www.leverhulme.ac.uk";
const DETAIL_DELAY_MS = 300;

const ELIGIBILITY_STOP = /^(what the trust offers|how to apply|making an application|key dates|contact|value|duration|host university|ineligible|practising artists)/i;

export function parseLeverhulmeDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
} {
  const $ = cheerio.load(html);

  // Description: multi-paragraph from main content
  const descParts: string[] = [];
  $("main p, article p, .field--type-text-long p, .layout__region p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility: Leverhulme uses Drupal accordion (.field--name-field-custom-fields .field--item)
  // Items appear in sequence; "Eligibility" item signals start of that section
  const eligParts: string[] = [];
  let capturing = false;
  $(".field--name-field-custom-fields .field--item").each((_i, el) => {
    const text = $(el).text().trim();
    if (text === "Eligibility") { capturing = true; return; }
    if (capturing) {
      if (ELIGIBILITY_STOP.test(text)) { capturing = false; return; }
      const clean = text.replace(/\s+/g, " ").trim();
      if (clean.length > 40 && !eligParts.includes(clean)) eligParts.push(clean);
    }
  });
  const eligibility = eligParts.length > 0 ? eligParts.join("\n\n").slice(0, 1500) : null;

  return { description, eligibility };
}

export function parseLeverhulmePage(html: string): RawLeverhulmeScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawLeverhulmeScheme[] = [];

  $(".views-row").each((_i, row) => {
    const $row = $(row);

    const titleEl = $row.find(".views-field-title a").first();
    const title = titleEl.text().trim();
    if (!title) return;

    const href = titleEl.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    const description = $row.find(".views-field-field-listing-text .field-content")
      .first().text().trim();

    const statusRaw = $row.find(".views-field-field-scheme-closed .field-content")
      .first().text().trim();

    // Row has class "scheme-closed" when closed
    const isClosed = $row.hasClass("scheme-closed") ||
      /currently closed/i.test(statusRaw);
    const status = isClosed ? "closed" : "open";

    // Deadline: if open, status text contains "Current round closes [date]"
    let deadlineText: string | null = null;
    if (!isClosed) {
      const match = statusRaw.match(/current round closes\s+(.+)/i);
      if (match) deadlineText = match[1].trim();
    }

    // Next opening: extracted from status text for closed schemes
    let nextOpeningText: string | null = null;
    if (isClosed) {
      const match = statusRaw.match(/next opening[:\s]+(.+)/i);
      if (match) nextOpeningText = match[1].trim();
    }

    const value = $row.find(".views-field-field-listing-value .field-content")
      .first().text().trim();

    const duration = $row.find(".views-field-field-listing-duration .field-content")
      .first().text().trim();

    schemes.push({ title, url, status, deadlineText, nextOpeningText, value, duration, description, eligibility: null });
  });

  if (schemes.length === 0) {
    throw new Error("Leverhulme: no schemes found on page — structure may have changed");
  }

  return schemes;
}

export async function fetchLeverhulmeSchemes(): Promise<RawLeverhulmeScheme[]> {
  console.log(`  Fetching Leverhulme schemes: ${SCHEMES_URL}`);

  const response = await fetchWithRetry(SCHEMES_URL);
  if (!response.ok) {
    throw new Error(`Leverhulme error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseLeverhulmePage(html);
  console.log(`  Found ${schemes.length} schemes from Leverhulme`);

  // Enrich with detail-page descriptions and eligibility
  for (const scheme of schemes) {
    if (!scheme.url || scheme.url === SCHEMES_URL) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(scheme.url);
      if (!res.ok) continue;
      const detailHtml = await res.text();
      const { description, eligibility } = parseLeverhulmeDetailPage(detailHtml);
      if (description) scheme.description = description;
      if (eligibility) scheme.eligibility = eligibility;
    } catch { /* skip on error */ }
  }

  return schemes;
}
