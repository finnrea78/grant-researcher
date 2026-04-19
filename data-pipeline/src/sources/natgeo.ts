import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import { sleep } from "../utils/sleep.js";
import type { RawNatgeoGrant } from "../transforms/normalise-natgeo.js";

const LISTING_URL = "https://www.nationalgeographic.org/society/grants-and-investments/";
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

export function parseNatgeoListingPage(html: string): RawNatgeoGrant[] {
  const $ = cheerio.load(html);
  const grants: RawNatgeoGrant[] = [];

  // Elementor WordPress layout: each grant lives in a div.elementor-widget-wrap that contains an h3.
  // Within it: h3 (title), h5 (deadline), .elementor-text-editor p (description), a.elementor-button-link (URL).
  // Fallback: iterate h3 elements in plain HTML context (fixture tests).
  const containers = $("div.elementor-widget-wrap").filter((_i, el) => $(el).find("h3").length > 0);

  if (containers.length > 0) {
    containers.each((_i, container) => {
      const $c = $(container);

      const title = $c.find("h3").first().text().trim();
      if (!title) return;

      const h5Text = $c.find("h5").first().text().trim();
      let deadlineRaw: string | null = null;
      if (h5Text) {
        const m = h5Text.match(/(?:submission\s+)?deadline[:\s]+(.+)/i);
        deadlineRaw = m ? m[1].trim() : h5Text;
      }

      const descParts: string[] = [];
      $c.find(".elementor-text-editor p, .elementor-widget-text-editor p").each((_j, p) => {
        const text = $(p).text().trim();
        if (text.length > 30) descParts.push(text);
      });
      const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

      const applyLink = $c.find("a.elementor-button-link, a[href*='rfp'], a[href*='grants-and-investments']").first();
      const href = applyLink.attr("href") ?? null;
      const url = href ? (href.startsWith("http") ? href : `https://www.nationalgeographic.org${href}`) : null;

      if (!url) return;

      grants.push({ title, url, deadlineRaw, description, eligibility: null, amountRaw: null, fundingType: "grant" });
    });
  } else {
    // Plain HTML fallback (used by unit test fixtures)
    $("h3").each((_i, h3El) => {
      const title = $(h3El).text().trim();
      if (!title) return;

      const $parent = $(h3El).parent();
      const h5Text = $parent.find("h5").first().text().trim() || $(h3El).nextAll("h5").first().text().trim();
      let deadlineRaw: string | null = null;
      if (h5Text) {
        const m = h5Text.match(/(?:submission\s+)?deadline[:\s]+(.+)/i);
        deadlineRaw = m ? m[1].trim() : h5Text;
      }

      const descParts: string[] = [];
      $(h3El).nextUntil("h3", "p").each((_j, p) => {
        const text = $(p).text().trim();
        if (text.length > 30) descParts.push(text);
      });
      const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

      const applyLink = $(h3El).nextAll("a").first();
      const href = applyLink.attr("href") ?? null;
      const url = href ? (href.startsWith("http") ? href : `https://www.nationalgeographic.org${href}`) : null;

      if (!url) return;

      grants.push({ title, url, deadlineRaw, description, eligibility: null, amountRaw: null, fundingType: "grant" });
    });
  }

  return grants;
}

export function parseNatgeoDetailPage(html: string): {
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
} {
  const $ = cheerio.load(html);

  // Description: collect substantial paragraphs from main content
  const descParts: string[] = [];
  $("main p, article p, .content p, body p").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.length > 60) descParts.push(text);
  });
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  // Eligibility
  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

  // Amount: look for $ figures
  let amountRaw: string | null = null;
  const bodyText = $("body").text();
  const amountMatch = bodyText.match(/\$[\d,]+(?:\s*(?:k|K|million|M))?\b[^.]*(?:\bup\s+to\b[^.]*)?/);
  if (amountMatch) amountRaw = amountMatch[0].trim().slice(0, 80);

  // Deadline from strong tags or "Submission Deadline:" text
  let deadlineRaw: string | null = null;
  $("strong").each((_i, el) => {
    if (deadlineRaw) return;
    const text = $(el).text().trim();
    // Strong tag containing a date
    if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(text) && text.length < 100) {
      deadlineRaw = text;
    }
  });
  if (!deadlineRaw) {
    const m = bodyText.match(/(?:submission\s+)?deadline[:\s]+([A-Za-z]+ \d+,? \d{4}[^.\n]*)/i);
    if (m) deadlineRaw = m[1].trim();
  }

  return { description, eligibility, amountRaw, deadlineRaw };
}

export async function fetchNatgeoGrants(): Promise<RawNatgeoGrant[]> {
  console.log(`  Fetching National Geographic Society grants: ${LISTING_URL}`);

  const res = await fetchWithRetry(LISTING_URL);
  if (!res.ok) {
    throw new Error(`NatGeo listing error: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const grants = parseNatgeoListingPage(html);
  console.log(`  Found ${grants.length} grant listings`);

  // Enrich from detail pages
  for (const grant of grants) {
    if (!grant.url) continue;
    await sleep(DETAIL_DELAY_MS);
    try {
      const detailRes = await fetchWithRetry(grant.url);
      if (!detailRes.ok) {
        console.warn(`  NatGeo detail fetch failed: ${detailRes.status} ${grant.url}`);
        continue;
      }
      const detail = parseNatgeoDetailPage(await detailRes.text());
      if (detail.description) grant.description = detail.description;
      if (detail.eligibility) grant.eligibility = detail.eligibility;
      if (detail.amountRaw) grant.amountRaw = detail.amountRaw;
      if (detail.deadlineRaw && !grant.deadlineRaw) grant.deadlineRaw = detail.deadlineRaw;
    } catch {
      // Skip failed detail fetches — listing data still valid
    }
  }

  return grants;
}
