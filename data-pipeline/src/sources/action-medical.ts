import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawActionMedicalGrant } from "../transforms/normalise-action-medical.js";

const BASE_URL = "https://action.org.uk";

// Known grant type pages — each has open call sections or a #no-calls indicator
const GRANT_PAGES = [
  {
    url: `${BASE_URL}/research/apply-research-grant/apply-project-grant`,
    defaultTitle: "Project Grants",
  },
  {
    url: `${BASE_URL}/research/apply-research-grant/apply-research-training-fellowship`,
    defaultTitle: "Research Training Fellowships",
  },
];

/**
 * Extract label→value pairs from a .simple-toggle__child section.
 * Labels are in <strong> tags, values follow as plain text in the same <p>.
 */
function extractKeyValues($child: ReturnType<typeof cheerio.load>): Record<string, string> {
  const result: Record<string, string> = {};

  // Re-use the cheerio instance for the child element
  $child("p").each((_i, el) => {
    const $p = $child(el);
    // Each <p> may have a <strong> label followed by plain text
    const strongText = $p.find("strong").text().trim().replace(/:?\s*$/, "").toLowerCase();
    if (!strongText) return;

    // Get full paragraph text, strip the label
    const fullText = $p.text().trim();
    const labelEnd = fullText.indexOf(":");
    const value = labelEnd >= 0 ? fullText.slice(labelEnd + 1).trim() : "";
    if (value) result[strongText] = value;
  });

  return result;
}

export function parseActionMedicalPage(
  html: string,
  pageUrl: string,
  defaultTitle: string
): RawActionMedicalGrant[] {
  const $ = cheerio.load(html);
  const grants: RawActionMedicalGrant[] = [];

  // If #no-calls is present and no open-call sections exist, the grant type is closed
  const hasNoCalls = $("#no-calls").length > 0;

  // Title from h1 or page heading
  const pageTitle = $("h1").first().text().trim() || defaultTitle;

  // Collect open call sections: only those appearing BEFORE #past-calls in DOM order.
  // Past calls may be siblings (not descendants) of #past-calls, so we use document
  // position rather than DOM ancestor checks.
  const openSections: Array<{ title: string; $section: cheerio.Cheerio<cheerio.Element> }> = [];
  let pastCallsSeen = false;

  $("section[id]").each((_i, el) => {
    const $el = $(el);
    const id = $el.attr("id") ?? "";

    if (id === "past-calls") {
      pastCallsSeen = true;
      return;
    }
    if (pastCallsSeen) return; // skip everything after #past-calls
    if (id === "no-calls") return;

    // Must have a heading with call-related text
    const heading = $el.find(".hgroup__title, h2").first().text().trim();
    if (!heading || /past calls/i.test(heading)) return;

    // Must have a toggle with call details
    const $toggle = $el.find(".simple-toggle__child");
    if (!$toggle.length) return;

    openSections.push({ title: heading, $section: $el });
  });

  if (openSections.length === 0 && hasNoCalls) {
    // Grant type is closed — return a single closed entry
    grants.push({
      title: pageTitle,
      url: pageUrl,
      status: "closed",
      description: null,
      openDateRaw: null,
      deadlineRaw: null,
      fullDeadlineRaw: null,
    });
    return grants;
  }

  for (const { title, $section } of openSections) {
    const $toggle = $section.find(".simple-toggle__child");
    const toggleHtml = $.html($toggle[0]);
    const $toggleDoc = cheerio.load(toggleHtml);

    const kvs = extractKeyValues($toggleDoc);

    const openDateRaw =
      kvs["applications open"] ?? kvs["applications open"] ?? null;
    const deadlineRaw =
      kvs["outline application deadline"] ?? kvs["outline deadline"] ?? null;
    const fullDeadlineRaw =
      kvs["full application deadline"] ?? null;

    // Description: first <p> text in toggle
    const description = $toggle.find("p").first().text().trim() || null;

    grants.push({
      title,
      url: pageUrl,
      status: "open",
      description,
      openDateRaw: openDateRaw ?? null,
      deadlineRaw: deadlineRaw ?? null,
      fullDeadlineRaw: fullDeadlineRaw ?? null,
    });
  }

  return grants;
}

export async function fetchActionMedicalGrants(): Promise<RawActionMedicalGrant[]> {
  const allGrants: RawActionMedicalGrant[] = [];

  for (const { url, defaultTitle } of GRANT_PAGES) {
    console.log(`  Fetching Action Medical Research grants: ${url}`);
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      console.warn(`  Action Medical: ${url} returned ${response.status} — skipping`);
      continue;
    }

    const html = await response.text();
    const grants = parseActionMedicalPage(html, url, defaultTitle);
    allGrants.push(...grants);
  }

  console.log(`  Found ${allGrants.length} grant entries from Action Medical Research`);
  return allGrants;
}
