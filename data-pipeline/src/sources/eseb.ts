import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawEsebGrant } from "../transforms/normalise-eseb.js";

const BASE_URL = "https://eseb.org";
const PRIZES_URL = `${BASE_URL}/prizes-funding/`;

/**
 * Parse the ESEB prizes & funding listing page.
 *
 * Structure: div.entry-content with alternating h2 + p + "More …" links.
 *   <h2 class="wp-block-heading" id="slug">Title</h2>
 *   <p>Description…</p>
 *   <a href="URL">More …</a>
 *
 * No amounts or deadlines on listing page. Individual pages have sparse data.
 * Status defaults to "open" (contact ESEB to confirm individual cycles).
 */
export function parseEsebPage(html: string): RawEsebGrant[] {
  const $ = cheerio.load(html);
  const grants: RawEsebGrant[] = [];

  const $content = $(".entry-content").first();
  if (!$content.length) return grants;

  $content.find("h2.wp-block-heading").each((_i, el) => {
    const $h2 = $(el);
    const title = $h2.text().replace(/\u00A0/g, " ").trim();
    if (!title) return;

    // Get the "More …" link from the next siblings until the next h2
    let url: string | null = null;
    let description: string | null = null;

    $h2.nextUntil("h2").each((_j, sibling) => {
      const $s = $(sibling);
      const tag = $s.prop("tagName")?.toLowerCase();

      if (tag === "p" && !description) {
        const text = $s.text().trim();
        if (text && !text.match(/^More/i)) description = text;
      }

      if (tag === "p" || tag === "div") {
        $s.find("a").each((_k, a) => {
          const href = $(a).attr("href");
          if (href && href.includes("eseb.org/prizes-funding/") && !url) {
            url = href;
          }
        });
      }
    });

    if (!url) url = PRIZES_URL;

    grants.push({ title, url, status: "open", description, amountRaw: null });
  });

  return grants;
}

export async function fetchEsebGrants(): Promise<RawEsebGrant[]> {
  console.log(`  Fetching ESEB prizes & funding: ${PRIZES_URL}`);
  const response = await fetchWithRetry(PRIZES_URL);
  if (!response.ok) {
    console.warn(`  ESEB: ${PRIZES_URL} returned ${response.status} — skipping`);
    return [];
  }
  const html = await response.text();
  const grants = parseEsebPage(html);
  console.log(`  Found ${grants.length} ESEB funding entries`);
  return grants;
}
