import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawBloodCancerUKScheme } from "../transforms/normalise-blood-cancer-uk.js";

const FUNDING_URL = "https://bloodcancer.org.uk/research/funding/apply-for-funding/";
const BASE_URL = "https://bloodcancer.org.uk";

export function parseBloodCancerUKPage(html: string): RawBloodCancerUKScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawBloodCancerUKScheme[] = [];

  $("section > div").each((_i, el) => {
    const $link = $(el).find("a").first();
    if (!$link.length) return;

    const title = $link.find("h3").text().trim();
    if (!title) return;

    const href = $link.attr("href") ?? "";
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Description: first <p> inside the link
    const description = $link.find("p").first().text().trim() || null;

    // Status from first <strong> inside the link
    // "Call closed" → closed, "Call open" / "Now open" / etc → open
    const statusText = $link.find("strong").first().text().trim().toLowerCase();
    const status = /open/i.test(statusText) ? "open" : "closed";

    // Next call from strong elements — look for one containing "Next call:"
    let nextCallRaw: string | null = null;
    $link.find("strong").each((_j, strongEl) => {
      const text = $(strongEl).text().trim();
      if (/next call:/i.test(text)) {
        nextCallRaw = text.replace(/^next call:\s*/i, "").trim();
      }
    });

    schemes.push({ title, url, status, description, nextCallRaw });
  });

  if (schemes.length === 0) {
    throw new Error("Blood Cancer UK: no funding scheme entries found — page structure may have changed");
  }

  return schemes;
}

export async function fetchBloodCancerUKSchemes(): Promise<RawBloodCancerUKScheme[]> {
  console.log(`  Fetching Blood Cancer UK funding schemes: ${FUNDING_URL}`);

  const response = await fetchWithRetry(FUNDING_URL);
  if (!response.ok) {
    throw new Error(`Blood Cancer UK error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseBloodCancerUKPage(html);
  console.log(`  Found ${schemes.length} funding schemes from Blood Cancer UK`);
  return schemes;
}
