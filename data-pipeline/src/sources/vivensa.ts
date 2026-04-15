import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawVivensaGrant } from "../transforms/normalise-vivensa.js";

const BASE_URL = "https://vivensafoundation.org.uk";
const GRANTS_URL = `${BASE_URL}/apply-for-funding/`;

/**
 * Extract grants from the Vivensa Foundation apply-for-funding page.
 *
 * The page structure is flat WordPress prose under an #open-calls-and-deadlines
 * anchor.  Each grant occupies an <h3> heading followed by sibling <p> tags
 * until the next <h3>.  The first <p><strong> contains status + deadline text;
 * any <p> containing "£" contains the amount.
 */
export function parseVivensaPage(html: string): RawVivensaGrant[] {
  const $ = cheerio.load(html);
  const grants: RawVivensaGrant[] = [];

  $("h3").each((_i, el) => {
    const $h3 = $(el);
    const title = $h3.text().trim();
    if (!title) return;

    // Collect sibling elements until the next h3 (or end of parent)
    const $siblings = $h3.nextUntil("h3, h2");

    // Status / deadline: first <strong> text in the sibling set
    const statusRaw = $siblings.find("strong").first().text().trim();
    const status = /now open/i.test(statusRaw) ? "open" : "closed";

    // Deadline: extract date from statusRaw for open grants
    // Pattern: "Now open – deadline for applications 5pm on 22 May 2026"
    //          "Now open – deadline for nominations 5pm on 22 May 2026"
    let deadlineRaw: string | null = null;
    const deadlineMatch = statusRaw.match(
      /deadline[^:]*?(?:5pm\s+on\s+|by\s+)?(\d{1,2}\s+\w+\s+\d{4})/i
    );
    if (deadlineMatch) {
      deadlineRaw = deadlineMatch[1];
    } else if (/rolling/i.test(statusRaw)) {
      deadlineRaw = "Rolling";
    }

    // Amount: first <p> containing "£" in the siblings
    let amountRaw: string | null = null;
    $siblings.filter("p, li").each((_j, p) => {
      if (amountRaw) return;
      const pText = $(p).text().trim();
      if (pText.includes("£")) {
        // Expand shorthand M → million so parseAmount handles it
        amountRaw = pText.replace(/£([\d.]+)M\b/g, "£$1 million");
      }
    });

    // Description: first <p> that is NOT the status paragraph
    let description: string | null = null;
    $siblings.filter("p").each((_j, p) => {
      if (description) return;
      const pText = $(p).text().trim();
      if (!pText || $(p).find("strong").length > 0) return; // skip status para
      description = pText.length > 20 ? pText : null;
    });

    grants.push({
      title,
      url: GRANTS_URL,
      status,
      statusRaw,
      deadlineRaw,
      amountRaw,
      description,
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
