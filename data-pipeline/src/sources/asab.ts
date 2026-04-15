import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawAsabGrant } from "../transforms/normalise-asab.js";

const BASE_URL = "https://www.asab.org";
const OVERVIEW_URL = `${BASE_URL}/grant-overview`;

// Known grant sub-paths on the ASAB site
const GRANT_PATHS = [
  "/research-grants",
  "/conference-grants",
  "/scholarships",
  "/childcare",
  "/education-grants",
  "/workshop-grants",
  "/accessibility-grants",
  "/public-engagement-grant",
];

/**
 * Extract just the grant name from a long h1 heading that includes description.
 * "Research Grants of up to £15,000 support original research projects."
 * → "Research Grants"
 */
function extractGrantName(h1: string): string {
  return h1
    .replace(/\s+(?:of\s+up\s+to|support[s]?|help[s]?|that\s+|to\s+|are\s+|enabling\s+|for\s+PhD).*$/i, "")
    .replace(/[.!?,]+$/, "")
    .trim();
}

/**
 * Parse an individual ASAB grant page to extract amount, deadline, description and eligibility.
 */
export function parseAsabGrantPage(
  html: string,
  url: string
): Pick<RawAsabGrant, "title" | "amountRaw" | "deadlineRaw" | "description" | "status" | "eligibility"> {
  const $ = cheerio.load(html);

  const h1Text = $("h1").first().text().trim();
  const title = h1Text ? extractGrantName(h1Text) : "";

  // Full prose text from main content
  const bodyText = $("main, .sqs-block-content, .entry-content, article").first().text();

  // Specific next deadline: "next application deadline for X is 1st June 2026"
  const nextDeadlineMatch = bodyText.match(
    /next application deadline[^i]*is\s+(\d+(?:st|nd|rd|th)\s+\w+\s+\d{4})/i
  );
  let deadlineRaw: string | null = null;
  if (nextDeadlineMatch) {
    // Strip ordinal suffix so parseDate handles it: "1st June 2026" → "1 June 2026"
    deadlineRaw = nextDeadlineMatch[1].replace(/(\d+)(?:st|nd|rd|th)/i, "$1");
  }

  // Amount: "up to £15,000", "£750 or less", "£750"
  const amountMatch = bodyText.match(/(?:up\s+to\s+)?(£[\d,]+)/i);
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  // Status: check if deadline has passed
  let status = "open";
  if (deadlineRaw) {
    const parsed = new Date(deadlineRaw);
    if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
  }

  // Description: collect multiple substantive paragraphs
  const descParts: string[] = [];
  $("main p, .sqs-block-content p, article p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 40) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility: extract from heading sections
  let eligibility: string | null = null;
  $("h2, h3, h4").each((_i, el) => {
    if (eligibility !== null) return;
    if (!/eligib|who\s+can\s+apply|who\s+is\s+eligible/i.test($(el).text().trim())) return;
    const parts: string[] = [];
    let sibling = $(el).next();
    while (sibling.length && !sibling.is("h2, h3, h4")) {
      const text = sibling.text().trim();
      if (text) parts.push(text);
      sibling = sibling.next();
    }
    if (parts.length > 0) eligibility = parts.join("\n\n").slice(0, 1500);
  });

  return { title, amountRaw, deadlineRaw, description, status, eligibility };
}

/**
 * Parse the ASAB grant overview page to extract grant page URLs.
 * The overview uses Squarespace image-link cards (a.sqs-block-image-link)
 * that link to individual grant pages.
 */
export function parseAsabOverviewPage(html: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href.startsWith("/")) return;

    // Keep only known grant sub-paths
    const matched = GRANT_PATHS.find(p => href === p || href === p + "/");
    if (!matched) return;

    const url = `${BASE_URL}${matched}`;
    if (seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  });

  // Fall back to all known paths if overview page parsing found nothing
  if (urls.length === 0) {
    return GRANT_PATHS.map(p => `${BASE_URL}${p}`);
  }
  return urls;
}

export async function fetchAsabGrants(): Promise<RawAsabGrant[]> {
  console.log(`  Fetching ASAB grant overview: ${OVERVIEW_URL}`);
  const overviewRes = await fetchWithRetry(OVERVIEW_URL);
  if (!overviewRes.ok) {
    console.warn(`  ASAB: overview returned ${overviewRes.status} — using known paths`);
  }

  let grantUrls: string[];
  if (overviewRes.ok) {
    const overviewHtml = await overviewRes.text();
    grantUrls = parseAsabOverviewPage(overviewHtml);
  } else {
    grantUrls = GRANT_PATHS.map(p => `${BASE_URL}${p}`);
  }

  console.log(`  ASAB: fetching ${grantUrls.length} individual grant pages`);

  const grants: RawAsabGrant[] = [];
  for (const url of grantUrls) {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`  ASAB: ${url} returned ${res.status} — skipping`);
      continue;
    }
    const html = await res.text();
    const parsed = parseAsabGrantPage(html, url);
    if (!parsed.title) continue;
    grants.push({ ...parsed, url });
  }

  console.log(`  Found ${grants.length} ASAB grant entries`);
  return grants;
}
