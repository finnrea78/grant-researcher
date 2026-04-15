import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawHIASScheme } from "../transforms/normalise-hias-hamburg.js";

const CALLS_URL = "https://hias-hamburg.de/en/fellowship/application/";
const BASE_URL = "https://hias-hamburg.de";

export function parseHIASPage(html: string): RawHIASScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawHIASScheme[] = [];

  // WordPress Accordion blocks: <div class="... Accordion__item ...">
  $("[class*='Accordion__item']").each((_i, el) => {
    const $el = $(el);

    // Title from h3.Accordion__title
    const title = $el.find("[class*='Accordion__title']").first().text().trim();
    if (!title) return;

    // Description: collect substantial paragraphs from accordion content
    const $content = $el.find("[class*='Accordion__content']");
    const fullText = $content.text();

    const descParts: string[] = [];
    $content.find("p").each((_j, p) => {
      const text = $(p).text().replace(/\s+/g, " ").trim();
      if (text.length > 60) descParts.push(text);
    });
    const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

    // Eligibility: look for label pattern in text
    let eligibility: string | null = null;
    const eligMatch = fullText.match(/[Ee]ligibility[:\s]+([^\n]{20,500})/);
    if (eligMatch) {
      eligibility = eligMatch[1].replace(/\s+/g, " ").trim().slice(0, 500);
    }

    // Status: closed/paused if specific phrases found in content
    const isClosed = /paused until further notice|is closed|closed\*\*\*|call.*closed|deadline.*ended/i.test(fullText);
    const status = isClosed ? "closed" : "open";

    // Deadline: look for deadline text
    let deadlineRaw: string | null = null;
    const deadlineMatch = fullText.match(/[Dd]eadline[:\s]+([^\n]+?)(?:\n|$)/);
    if (deadlineMatch) {
      deadlineRaw = deadlineMatch[1].replace(/\s+/g, " ").trim();
    }

    // URL: first external link or the page URL
    let url = CALLS_URL;
    $content.find("a[href]").each((_j, link) => {
      const href = $(link).attr("href") ?? "";
      if (href.startsWith("http") && !href.includes("hias-hamburg.de/en/about")) {
        url = href;
        return false; // break
      }
    });

    schemes.push({ title, url, status, deadlineRaw, description, eligibility });
  });

  if (schemes.length === 0) {
    throw new Error("HIAS Hamburg: no accordion items found — page structure may have changed");
  }

  return schemes;
}

export async function fetchHIASSchemes(): Promise<RawHIASScheme[]> {
  console.log(`  Fetching HIAS Hamburg fellowship calls: ${CALLS_URL}`);

  const response = await fetchWithRetry(CALLS_URL);
  if (!response.ok) {
    throw new Error(`HIAS Hamburg error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseHIASPage(html);
  const open = schemes.filter(s => s.status === "open").length;
  console.log(`  Found ${schemes.length} fellowship calls (${open} open) from HIAS Hamburg`);
  return schemes;
}
