import * as cheerio from "cheerio";
import type { RawLeverhulmeScheme } from "../transforms/normalise-leverhulme.js";

const SCHEMES_URL = "https://www.leverhulme.ac.uk/schemes-at-a-glance";
const BASE_URL = "https://www.leverhulme.ac.uk";

export function parseLeverhulmePage(html: string): RawLeverhulmeScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawLeverhulmeScheme[] = [];

  $(".views-row").each((_i, row) => {
    const $row = $(row);

    const titleEl = $row.find("h3.scheme-title a, h2.scheme-title a, h3 a, h2 a").first();
    const title = titleEl.text().trim();
    if (!title) return;

    const href = titleEl.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    const description = $row.find(
      ".field--name-field-scheme-description p, .scheme-description p"
    ).first().text().trim();

    const statusText = $row.find(
      ".field--name-field-scheme-status, .scheme-status, [class*='scheme-status']"
    ).first().text().trim();

    const isOpen = /current round closes/i.test(statusText);
    const status = isOpen ? "open" : "closed";

    // Extract deadline from "Current round closes 10 June 2026"
    let deadlineText: string | null = null;
    if (isOpen) {
      const match = statusText.match(/current round closes\s+(.+)/i);
      if (match) deadlineText = match[1].trim();
    }

    // Extract next opening from "Next opening: 1 January 2027"
    let nextOpeningText: string | null = null;
    const nextOpeningEl = $row.find(
      ".field--name-field-next-opening, [class*='next-opening']"
    ).first();
    if (nextOpeningEl.length) {
      const text = nextOpeningEl.text().trim();
      const match = text.match(/next opening[:\s]+(.+)/i);
      if (match) nextOpeningText = match[1].trim();
    }

    const value = $row.find(
      ".field--name-field-scheme-value, .scheme-value"
    ).first().text().trim();

    const duration = $row.find(
      ".field--name-field-scheme-duration, .scheme-duration"
    ).first().text().trim();

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
