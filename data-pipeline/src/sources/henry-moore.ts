import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawHenryMooreScheme } from "../transforms/normalise-henry-moore.js";

const GRANTS_URL = "https://henry-moore.org/what-we-do/grants-fellowships/";

// Categories to include (title substrings matching c-col-title--large headings)
const GRANT_CATEGORIES = new Set([
  "New Projects and Commissions",
  "Acquisitions and Collections",
  "Conferences, Lectures and Publications",
  "Long-Term Research grants",
  "Research and Travel grants",
]);

interface SeasonalWindow {
  season: string;
  isCurrentlyOpen: boolean;
  opensText: string | null;
  closesText: string | null;
}

function parseSeasonalWindows($: ReturnType<typeof cheerio.load>): SeasonalWindow[] {
  const seasons = ["Spring", "Summer", "Autumn", "Winter"];
  const windows: SeasonalWindow[] = [];

  $("h3").each((_i, el) => {
    const text = $(el).text().trim();
    if (!seasons.includes(text)) return;

    const $block = $(el).parent();
    const blockText = $block.text();

    const isCurrentlyOpen = /applications are now open/i.test(blockText);
    const opensMatch = blockText.match(/applications open\s+([^,\n]+(?:,\s*\d+:\d+)?)/i);
    const closesMatch = blockText.match(/submissions close\s+([^\n]+)/i);

    windows.push({
      season: text,
      isCurrentlyOpen,
      opensText: opensMatch ? opensMatch[1].trim() : null,
      closesText: closesMatch ? closesMatch[1].trim() : null,
    });
  });

  return windows;
}

export function parseHenryMoorePage(html: string): RawHenryMooreScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawHenryMooreScheme[] = [];

  // Determine current status and deadline from seasonal windows
  const windows = parseSeasonalWindows($);
  const openWindow = windows.find((w) => w.isCurrentlyOpen);
  const isAnyOpen = openWindow !== undefined;
  const currentDeadline = openWindow?.closesText ?? null;

  // Extract grant categories from h3.c-col-title--large
  $("h3").each((_i, el) => {
    const $h3 = $(el);
    if (!$h3.hasClass("c-col-title--large")) return;

    const title = $h3.text().trim();
    if (!GRANT_CATEGORIES.has(title)) return;

    // Description from the next sibling .c-masthead__intro div
    const $desc = $h3.next(".c-masthead__intro, .c-wysiwyg");
    const description = $desc.text().trim() || null;

    // Amount from description text
    const amountMatch = description?.match(/maximum grant (?:available|awarded) in this category is (£[\d,]+)/i);
    const amountRaw = amountMatch ? amountMatch[1] : null;

    schemes.push({
      title,
      url: GRANTS_URL,
      status: isAnyOpen ? "open" : "closed",
      deadlineRaw: currentDeadline,
      amountRaw,
      description,
      openWindow: openWindow?.season ?? null,
    });
  });

  if (schemes.length === 0) {
    throw new Error("Henry Moore: no grant category headings found — page structure may have changed");
  }

  return schemes;
}

export async function fetchHenryMooreSchemes(): Promise<RawHenryMooreScheme[]> {
  console.log(`  Fetching Henry Moore Foundation grants: ${GRANTS_URL}`);

  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    throw new Error(`Henry Moore error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseHenryMoorePage(html);
  console.log(`  Found ${schemes.length} grant categories from Henry Moore Foundation`);
  return schemes;
}
