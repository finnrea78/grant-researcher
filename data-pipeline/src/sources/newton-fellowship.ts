import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawNewtonFellowship } from "../transforms/normalise-newton.js";

const FELLOWSHIP_URL = "https://royalsociety.org/grants/newton-international/";

export function parseNewtonPage(html: string): RawNewtonFellowship[] {
  const $ = cheerio.load(html);

  // Status: look for a <strong> containing "Open" or "Closed"
  let status = "unknown";
  $("strong").each((_i, el) => {
    const text = $(el).text().trim();
    if (/^open$/i.test(text)) { status = "open"; return false; }
    if (/^closed$/i.test(text)) { status = "closed"; return false; }
  });

  // Dates from definition list (dt/dd pairs)
  let openDateRaw: string | null = null;
  let closeDateRaw: string | null = null;
  let decisionDateRaw: string | null = null;

  $("dt").each((_i, dtEl) => {
    const label = $(dtEl).text().trim().toLowerCase();
    const value = $(dtEl).next("dd").text().trim() || null;
    if (/open\s+date/i.test(label)) openDateRaw = value;
    else if (/close\s+date/i.test(label)) closeDateRaw = value;
    else if (/decision/i.test(label)) decisionDateRaw = value;
  });

  // Amount: look for a paragraph containing a £ amount
  let amountRaw: string | null = null;
  $("p, li").each((_i, el) => {
    const text = $(el).text();
    const match = text.match(/£[\d,]+(?:\s*(?:,\d{3})*)?(?:\s+(?:over|per|for))?/);
    if (match && !amountRaw) {
      // Extract just the amount phrase (up to 40 chars)
      amountRaw = text.trim().slice(0, 80);
    }
  });

  // Description: first non-empty paragraph in main content
  let description: string | null = null;
  $("main p, article p, .page-content p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 30 && !description) {
      description = text;
    }
  });

  // Title from <h1>
  const title = $("h1").first().text().trim() || "Newton International Fellowships";

  return [
    {
      title,
      url: FELLOWSHIP_URL,
      status,
      description,
      amountRaw,
      openDateRaw,
      closeDateRaw,
      decisionDateRaw,
    },
  ];
}

export async function fetchNewtonFellowship(): Promise<RawNewtonFellowship[]> {
  console.log(`  Fetching Newton International Fellowship: ${FELLOWSHIP_URL}`);

  const response = await fetchWithRetry(FELLOWSHIP_URL);
  if (!response.ok) {
    throw new Error(`Newton Fellowship error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseNewtonPage(html);
  console.log(`  Found ${schemes.length} fellowship entries from Royal Society Newton`);
  return schemes;
}
