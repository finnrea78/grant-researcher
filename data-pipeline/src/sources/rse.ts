import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawRSEAward } from "../transforms/normalise-rse.js";

// The RSE grants/prizes listing page returns 403.
// Individual award pages are accessible — we maintain a known list.
const AWARD_URLS = [
  "https://rse.org.uk/award/rse-personal-research-fellowships/",
  "https://rse.org.uk/award/rse-research-collaboration-grants/",
  "https://rse.org.uk/award/rse-small-grants/",
  // "https://rse.org.uk/award/rse-international-joint-projects/", // 404 as of 2026-04-15
];

export function parseRSEAwardPage(html: string, url: string): RawRSEAward {
  const $ = cheerio.load(html);

  // Title from <h1> or page-title element
  const title =
    $("h1.page-title, h1").first().text().trim() ||
    "RSE Award";

  // Description from first meaningful paragraph in main content
  let description: string | null = null;
  $("main p, .entry-content p, article p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 40 && !description) {
      description = text;
    }
  });

  // Sidebar metadata: .sidebar-image.event-data .data-item
  // Each .data-item has h3 (label) and p (value)
  let deadlineRaw: string | null = null;
  let valueRaw: string | null = null;
  let durationRaw: string | null = null;

  $(".sidebar-image .data-item, .event-data .data-item").each((_i, el) => {
    const label = $(el).find("h3").text().trim().toLowerCase();
    // Use .text() on all <p>s to handle nested/invalid <p> tags in the source HTML
    const value = $(el).find("p").text().trim() || null;

    if (label === "deadline") deadlineRaw = value;
    else if (label === "value") valueRaw = value;
    else if (label === "duration") durationRaw = value;
  });

  // Detect status: "now closed" in deadline text → closed, else open
  const isClosed =
    !deadlineRaw ||
    /now closed|closed/i.test(deadlineRaw) ||
    /now closed/i.test($("main").text());
  const status = isClosed ? "closed" : "open";

  return { title, url, status, description, deadlineRaw, valueRaw, durationRaw };
}

export async function fetchRSEAwards(): Promise<RawRSEAward[]> {
  const awards: RawRSEAward[] = [];

  for (const url of AWARD_URLS) {
    console.log(`  Fetching RSE award: ${url}`);
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.warn(`  RSE: ${url} returned ${response.status} — skipping`);
      continue;
    }

    const html = await response.text();
    const award = parseRSEAwardPage(html, url);
    awards.push(award);
  }

  console.log(`  Found ${awards.length} RSE awards`);
  return awards;
}
