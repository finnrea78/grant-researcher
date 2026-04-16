import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawEsebGrant } from "../transforms/normalise-eseb.js";

const BASE_URL = "https://eseb.org";
const PRIZES_URL = `${BASE_URL}/prizes-funding/`;

const DETAIL_DELAY_MS = 300;

function extractSection($: cheerio.CheerioAPI, headingPattern: RegExp): string | null {
  let result: string | null = null;
  $("h2, h3, h4").each((_i, el) => {
    if (result !== null) return;
    if (!headingPattern.test($(el).text().trim())) return;
    const parts: string[] = [];
    let sibling = $(el).next();
    while (sibling.length && !sibling.is("h2, h3, h4")) {
      const text = sibling.text().trim();
      if (text) parts.push(text);
      sibling = sibling.next();
    }
    if (parts.length > 0) result = parts.join("\n\n").slice(0, 1500);
  });
  return result;
}

export function parseEsebDetailPage(html: string): { description: string | null; eligibility: string | null } {
  const $ = cheerio.load(html);

  const descParts: string[] = [];
  $("main p, article p, .entry-content p, .wp-block-group p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /eligibility|who can apply|who is eligible|requirements/i);

  return { description, eligibility };
}

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

    grants.push({ title, url, status: "open", description, amountRaw: null, eligibility: null });
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

  // Enrich from detail pages
  for (const item of grants) {
    if (!item.url || item.url === PRIZES_URL) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const res = await fetchWithRetry(item.url);
      if (!res.ok) continue;
      const detailHtml = await res.text();
      const { description, eligibility } = parseEsebDetailPage(detailHtml);
      if (description) item.description = description;
      if (eligibility) item.eligibility = eligibility;
    } catch {
      // Skip failed detail fetches — listing data is still valid
    }
  }

  return grants;
}
