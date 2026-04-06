import * as cheerio from "cheerio";
import type { RawLeverhulmeScheme } from "../transforms/normalise-leverhulme.js";

const SCHEMES_URL = "https://www.leverhulme.ac.uk/schemes-at-a-glance";
const BASE_URL = "https://www.leverhulme.ac.uk";

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

    schemes.push({ title, url, status, deadlineText, nextOpeningText, value, duration, description });
  });

  if (schemes.length === 0) {
    throw new Error("Leverhulme: no schemes found on page — structure may have changed");
  }

  return schemes;
}

export async function fetchLeverhulmeSchemes(): Promise<RawLeverhulmeScheme[]> {
  console.log(`  Fetching Leverhulme schemes: ${SCHEMES_URL}`);

  const response = await fetch(SCHEMES_URL);
  if (!response.ok) {
    throw new Error(`Leverhulme error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseLeverhulmePage(html);
  console.log(`  Found ${schemes.length} schemes from Leverhulme`);
  return schemes;
}
