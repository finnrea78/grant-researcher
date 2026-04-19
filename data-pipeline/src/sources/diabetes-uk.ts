import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawDiabetesUkScheme } from "../transforms/normalise-diabetes-uk.js";

const BASE_URL = "https://www.diabetes.org.uk";

const SCHEME_PAGES: { path: string; fundingType: string }[] = [
  { path: "/research/for-researchers/apply-for-a-grant/project-grants", fundingType: "grant" },
  { path: "/research/for-researchers/apply-for-a-grant/small-grants", fundingType: "grant" },
  { path: "/our-research/for-researchers/applying-for-funding/funding-schemes/highlight-notices", fundingType: "grant" },
  { path: "/research/for-researchers/apply-for-a-grant/strategic-research-calls", fundingType: "grant" },
  { path: "/research/for-researchers/apply-for-a-grant/rd-lawrence-fellowship", fundingType: "fellowship" },
  { path: "/research/for-researchers/apply-for-a-grant/harry-keen-intermediate-clinical-fellowship", fundingType: "fellowship" },
  { path: "/research/for-researchers/apply-for-a-grant/sir-george-alberti-research-training-fellowship", fundingType: "fellowship" },
  { path: "/our-research/for-researchers/applying-for-funding/funding-schemes/black-leaders-in-diabetes-phd-studentship-scheme", fundingType: "studentship" },
  { path: "/our-research/for-researchers/applying-for-funding/funding-schemes/phd-studentships", fundingType: "studentship" },
];

function extractSection($: ReturnType<typeof cheerio.load>, headingPattern: RegExp): string | null {
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

export function parseDiabetesUkPage(
  html: string,
  pageUrl: string,
  fundingType: string
): RawDiabetesUkScheme {
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim();

  const descParts: string[] = [];
  const descSelectors = ["main p", "article p", ".entry-content p", ".page-content p", "body p"];
  for (const sel of descSelectors) {
    $(sel).each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > 60) descParts.push(text);
    });
    if (descParts.length > 0) break;
  }
  const description = descParts.length > 0 ? descParts.join("\n\n").slice(0, 2000) : null;

  const eligibility = extractSection($, /^eligibility$/i);

  const bodyText = $("main, article, .entry-content, body").first().text();

  // Amount: "up to £N" or "£N,NNN"
  const amountMatch = bodyText.match(
    /(?:up\s+to\s+(?:a\s+total\s+of\s+)?)?(£[\d,.]+(?:\s*(?:k|m|million))?)/i
  );
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  // Deadline: look for date patterns near closing keywords
  let deadlineRaw: string | null = null;
  const DATE_RE = /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i;
  const deadlineContextRE = /(?:applications?\s+(?:will\s+)?close|deadline|closing)[:\s]+/i;
  const ctxMatch = bodyText.match(deadlineContextRE);
  if (ctxMatch) {
    const after = bodyText.slice(ctxMatch.index! + ctxMatch[0].length);
    const dateMatch = after.match(DATE_RE);
    if (dateMatch) deadlineRaw = dateMatch[1].trim();
  }

  // Status: "on hold", "not accepting", "currently closed" → closed; else open
  const closedSignals = /currently\s+(?:on\s+hold|closed|not\s+accepting)|not\s+(?:currently\s+)?accepting\s+applications?/i;
  const status = closedSignals.test(bodyText) ? "closed" : "open";

  return { title, url: pageUrl, fundingType, status, description, eligibility, amountRaw, deadlineRaw };
}

export async function fetchDiabetesUkSchemes(): Promise<RawDiabetesUkScheme[]> {
  const schemes: RawDiabetesUkScheme[] = [];

  for (const { path, fundingType } of SCHEME_PAGES) {
    const url = `${BASE_URL}${path}`;
    console.log(`  Fetching Diabetes UK scheme: ${url}`);
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`  Diabetes UK: ${url} returned ${res.status} — skipping`);
      continue;
    }
    const html = await res.text();
    const scheme = parseDiabetesUkPage(html, url, fundingType);
    if (!scheme.title) continue;
    schemes.push(scheme);
  }

  console.log(`  Found ${schemes.length} Diabetes UK scheme entries`);
  return schemes;
}
