import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawVivensaGrant } from "../transforms/normalise-vivensa.js";

const BASE_URL = "https://vivensafoundation.org.uk";
const GRANTS_URL = `${BASE_URL}/apply-for-funding/`;

const SKIP_HEADINGS = /^(open calls and deadlines|regular and closed|apply now|check our deadlines|eligibility q&a|provide an orcid|apply online|where experts|find out about call|support and resources|read about some|find out about our team)$/i;

/**
 * Extract grants from the Vivensa Foundation apply-for-funding page.
 *
 * The page uses Gutenberg block containers (gb-container). Each grant
 * has an <h2> title inside a narrow header sub-container; the full grant
 * content (description, status, amount) is in the grandparent container.
 * Status is in the first <strong>; description in subsequent <p>s.
 */
export function parseVivensaPage(html: string): RawVivensaGrant[] {
  const $ = cheerio.load(html);
  const grants: RawVivensaGrant[] = [];
  const seen = new Set<string>();

  $("h2, h3").each((_i, el) => {
    const title = $(el).text().trim();
    if (!title || seen.has(title) || SKIP_HEADINGS.test(title) || title.length > 100) return;
    seen.add(title);

    // Walk up to find the container that holds the full grant content
    // h2 -> parent (narrow header container) -> parent (full grant container)
    const container = $(el).parent().parent();

    // Status / deadline from first <strong>
    const statusRaw = container.find("strong").first().text().trim();
    const status = /now open|rolling/i.test(statusRaw) ? "open" : "closed";

    // Deadline: extract from statusRaw
    let deadlineRaw: string | null = null;
    const deadlineMatch = statusRaw.match(
      /deadline[^:]*?(?:5pm\s+on\s+|by\s+)?(\d{1,2}\s+\w+\s+\d{4})/i
    );
    if (deadlineMatch) {
      deadlineRaw = deadlineMatch[1];
    } else if (/rolling/i.test(statusRaw)) {
      deadlineRaw = "Rolling";
    }

    // Amount: first <p> containing £
    let amountRaw: string | null = null;
    container.find("p").each((_j, p) => {
      if (amountRaw) return;
      const pText = $(p).text().trim();
      if (pText.includes("£")) {
        amountRaw = pText.replace(/£([\d.]+)M\b/g, "£$1 million");
      }
    });

    // Description: collect substantial paragraphs, skip browser-notice and status paras
    const descParts: string[] = [];
    container.find("p").each((_j, p) => {
      const pText = $(p).text().trim();
      if (pText.length < 50) return;
      if (/if your browser|drop-down|dropdown/i.test(pText)) return;
      if ($(p).find("strong").length > 0 && /now open|now closed|deadline/i.test(pText)) return;
      descParts.push(pText);
    });
    const description = descParts.length > 0
      ? descParts.join("\n\n").slice(0, 2000)
      : null;

    // Eligibility: paragraphs that specifically mention eligibility criteria / who can apply
    const eligParts: string[] = [];
    container.find("p").each((_j, p) => {
      const pText = $(p).text().trim();
      if (pText.length < 50) return;
      if (/eligib|who\s+(will|can)\s+(we\s+)?fund|who\s+is\s+eligible|career\s+stage.*year|years.*postdoctoral.*experience/i.test(pText)) {
        if (!eligParts.includes(pText)) eligParts.push(pText);
      }
    });
    const eligibility = eligParts.length > 0
      ? eligParts.join("\n\n").slice(0, 1500)
      : null;

    grants.push({
      title,
      url: GRANTS_URL,
      status,
      statusRaw: statusRaw || null,
      deadlineRaw,
      amountRaw,
      description,
      eligibility,
    });
  });

  return grants;
}

export async function fetchVivensaGrants(): Promise<RawVivensaGrant[]> {
  console.log(`  Fetching Vivensa Foundation grants: ${GRANTS_URL}`);
  const response = await fetchWithRetry(GRANTS_URL);
  if (!response.ok) {
    console.warn(`  Vivensa Foundation: ${GRANTS_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseVivensaPage(html);
  console.log(`  Found ${grants.length} grant entries from Vivensa Foundation`);
  return grants;
}
