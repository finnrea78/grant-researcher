import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawBenhsGrant } from "../transforms/normalise-benhs.js";

const BASE_URL = "https://benhs.org.uk";
const WP_API_URL = `${BASE_URL}/wp-json/wp/v2/pages?slug=grants-and-awards&_fields=content.rendered`;
const GRANTS_URL = `${BASE_URL}/grants-and-awards/`;

// Section headers and award/closed titles to skip
const SKIP_TITLE_RE = /^(GRANTS|AWARDS|The following grants)/i;
// Honorary awards to skip (match anywhere in title)
const HONORARY_RE = /Marsh Award|Gold Medal/i;
const CLOSED_RE = /\(closed\)/i;

/**
 * Resolve an annually-recurring "DD Month" deadline to the next future date.
 */
function resolveAnnualDeadline(day: number, month: string): string | null {
  const now = new Date();
  const thisYear = new Date(`${month} ${day}, ${now.getFullYear()}`);
  if (thisYear > now) return `${day} ${month} ${now.getFullYear()}`;
  return `${day} ${month} ${now.getFullYear() + 1}`;
}

/**
 * Parse BENHS grants page HTML (from WP REST API rendered content).
 *
 * Two repeating grant h2 sections (WPBakery renders content twice).
 * Skips AWARDS section, honorary awards, and closed bursary.
 */
export function parseBenhsGrantsPage(html: string): RawBenhsGrant[] {
  const $ = cheerio.load(html);
  const grants: RawBenhsGrant[] = [];
  const seen = new Set<string>();

  $("h2").each((_i, el) => {
    const $h2 = $(el);
    const rawTitle = $h2.text().trim();

    // Skip section headers and honorary awards
    if (!rawTitle) return;
    if (SKIP_TITLE_RE.test(rawTitle)) return;
    if (HONORARY_RE.test(rawTitle)) return;

    // Normalise title (strip "(closed)" suffix) before deduplication
    const title = rawTitle.replace(CLOSED_RE, "").trim();

    // Always add to seen — whether we process or skip — so the second WPBakery
    // render (which omits "(closed)") doesn't create a duplicate entry.
    if (seen.has(title)) return;
    seen.add(title);

    // Skip closed entries (after adding to seen so duplicates are blocked)
    if (CLOSED_RE.test(rawTitle)) return;

    // Collect following sibling p elements until the next h2
    let amountRaw: string | null = null;
    let deadlineRaw: string | null = null;
    const descParts: string[] = [];

    $h2.nextUntil("h2").filter("p, ul").each((_j, sibling) => {
      const text = $(sibling).text().trim();
      if (!text) return;

      // Amount: "unlikely to exceed £NNN"
      if (!amountRaw) {
        const amtMatch = text.match(/(?:unlikely to exceed|up to)\s+(£[\d,]+)/i);
        if (amtMatch) amountRaw = amtMatch[1];
      }

      // Deadline: "closing date for applications is DDst/nd/rd/th Month"
      if (!deadlineRaw) {
        const dlMatch = text.match(
          /closing date for applications is\s+(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i
        );
        if (dlMatch) {
          const day = parseInt(dlMatch[1], 10);
          const month = dlMatch[2].charAt(0).toUpperCase() + dlMatch[2].slice(1).toLowerCase();
          deadlineRaw = resolveAnnualDeadline(day, month);
        }
      }

      // Description: collect substantial paragraphs
      if (text.length > 40 && !text.match(/closing date/i)) {
        descParts.push(text);
      }
    });

    // Determine status: if deadline is in the past → closed
    let status = "open";
    if (deadlineRaw) {
      const parsed = new Date(deadlineRaw);
      if (!isNaN(parsed.getTime()) && parsed < new Date()) status = "closed";
    }

    // Extract eligibility: look for "open to" or "awards are open" pattern
    let eligibility: string | null = null;
    for (const part of descParts) {
      if (/open to|eligible|applicants must|awards are/i.test(part)) {
        eligibility = part.slice(0, 500);
        break;
      }
    }

    const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

    grants.push({
      title,
      url: GRANTS_URL,
      status,
      description,
      eligibility,
      amountRaw: amountRaw ? `up to ${amountRaw}` : null,
      deadlineRaw,
    });
  });

  return grants;
}

export async function fetchBenhsGrants(): Promise<RawBenhsGrant[]> {
  console.log(`  Fetching BENHS grants via WP REST API`);

  const res = await fetchWithRetry(WP_API_URL);
  if (!res.ok) {
    console.warn(`  BENHS: WP API ${res.status} — skipping`);
    return [];
  }

  const pages: Array<{ content: { rendered: string } }> = await res.json();
  if (!pages.length) {
    console.warn(`  BENHS: no page found`);
    return [];
  }

  const html = pages[0].content.rendered;
  const grants = parseBenhsGrantsPage(html);
  console.log(`  Found ${grants.length} BENHS grants`);
  return grants;
}
