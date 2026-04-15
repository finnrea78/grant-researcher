import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawBshsGrant } from "../transforms/normalise-bshs.js";

const BASE_URL = "https://www.bshs.org.uk";
const GRANTS_URL = `${BASE_URL}/grants`;

/**
 * Parse the BSHS grants page.
 *
 * Built with Elementor WordPress plugin. Each grant section contains:
 *   - h2.elementor-heading-title: scheme title
 *   - h4.elementor-heading-title: deadline ("Next submission deadline\n15 May 2026")
 *     or status ("Paused", "Currently unavailable")
 *   - p inside .elementor-widget-text-editor: prose with £ amounts
 *
 * Strategy: walk all h2 elements; for each, get the enclosing .e-con-boxed
 * ancestor to scope h4 and p lookups.
 */
export function parseBshsPage(html: string): RawBshsGrant[] {
  const $ = cheerio.load(html);
  const grants: RawBshsGrant[] = [];
  const seen = new Set<string>();

  $("h2.elementor-heading-title").each((_i, h2el) => {
    const title = $(h2el).text().trim();
    if (!title || seen.has(title)) return;
    seen.add(title);

    // Find the enclosing Elementor section (e-con-boxed or section element)
    const $section = $(h2el).closest(".e-con-boxed, section.elementor-section").first();

    // Deadline: h4 containing "deadline" keyword — date on same or next line
    let deadlineRaw: string | null = null;
    $section.find("h4.elementor-heading-title").each((_j, h4) => {
      const text = $(h4).text().trim();
      if (!/deadline/i.test(text) || deadlineRaw) return;

      // Extract "DD Month YYYY" or "D Month YYYY" pattern from the h4 text
      const dateMatch = text.match(/(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})/i);
      if (dateMatch) {
        deadlineRaw = dateMatch[1].replace(/(\d+)(st|nd|rd|th)/i, "$1").trim();
      }
    });

    // Amount: first £ pattern in prose paragraphs
    let amountRaw: string | null = null;
    $section.find("p").each((_j, p) => {
      if (amountRaw) return;
      const text = $(p).text();
      const match = text.match(/£[\d,]+(?:\s*(?:to|-|–)\s*£[\d,]+)?/);
      if (match) amountRaw = match[0].trim();
    });

    // Status: check for paused/unavailable keywords, then deadline comparison
    let status = "open";
    $section.find("h4.elementor-heading-title").each((_j, h4) => {
      if (/Paused|Currently unavailable|not available|on hold/i.test($(h4).text())) {
        status = "closed";
      }
    });
    if (status === "open" && deadlineRaw) {
      const parsed = new Date(deadlineRaw);
      if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
    }

    // Description: first meaningful paragraph
    let description: string | null = null;
    $section.find("p").each((_j, p) => {
      if (description) return;
      const text = $(p).text().trim();
      if (text.length > 40 && !/contact:/i.test(text)) {
        description = text;
      }
    });

    grants.push({ title, url: GRANTS_URL, status, amountRaw, deadlineRaw, description });
  });

  return grants;
}

export async function fetchBshsGrants(): Promise<RawBshsGrant[]> {
  console.log(`  Fetching BSHS grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  BSHS: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseBshsPage(html);
  console.log(`  Found ${grants.length} BSHS grant entries`);
  return grants;
}
