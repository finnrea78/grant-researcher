import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawCarnegieTrustScheme } from "../transforms/normalise-carnegie-trust.js";

const SCHEMES_URL = "https://carnegie-trust.org/award-schemes/";
const BASE_URL = "https://carnegie-trust.org";

export function parseCarnegieTrustPage(html: string): RawCarnegieTrustScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawCarnegieTrustScheme[] = [];

  $("a.card-preview").each((_i, el) => {
    const $el = $(el);

    const href = $el.attr("href") ?? "";
    if (!href) return;
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    const title = $el.find("h2").first().text().trim();
    if (!title) return;

    const bodyText = $el.find(".text-body").text().trim();

    // Detect closed status from body text
    const isClosed = /currently closed|not.*accepting|no longer accepting/i.test(bodyText);
    const status = isClosed ? "closed" : "open";

    // Description: body text, trimmed at first sentence or 300 chars
    const description = bodyText || null;

    schemes.push({ title, url, status, description });
  });

  if (schemes.length === 0) {
    throw new Error("Carnegie Trust: no scheme cards found — page structure may have changed");
  }

  return schemes;
}

export async function fetchCarnegieTrustSchemes(): Promise<RawCarnegieTrustScheme[]> {
  console.log(`  Fetching Carnegie Trust schemes: ${SCHEMES_URL}`);

  const response = await fetchWithRetry(SCHEMES_URL);
  if (!response.ok) {
    throw new Error(`Carnegie Trust error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseCarnegieTrustPage(html);
  console.log(`  Found ${schemes.length} schemes from Carnegie Trust`);
  return schemes;
}
