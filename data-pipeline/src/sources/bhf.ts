import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawBhfScheme } from "../transforms/normalise-bhf.js";

const BASE_URL = "https://www.bhf.org.uk";
const BASE_PATH = "/for-professionals/information-for-researchers/what-we-fund";

const SCHEME_PAGES: { path: string; fundingType: string }[] = [
  { path: "/project-grants", fundingType: "grant" },
  { path: "/special-project-grants", fundingType: "grant" },
  { path: "/programme-grant", fundingType: "grant" },
  { path: "/clinical-study", fundingType: "grant" },
  { path: "/research-professorships", fundingType: "fellowship" },
  { path: "/pump-priming-awards", fundingType: "grant" },
  { path: "/translational-grant", fundingType: "grant" },
  { path: "/early-career-research-fellowship", fundingType: "fellowship" },
  { path: "/future-leader-fellowship", fundingType: "fellowship" },
  { path: "/senior-research-fellowship", fundingType: "fellowship" },
  { path: "/clinical-research-training-fellowships", fundingType: "fellowship" },
  { path: "/clinical-early-career-research-fellowship", fundingType: "fellowship" },
  { path: "/clinical-future-leader-fellowship", fundingType: "fellowship" },
  { path: "/clinical-senior-research-fellowship", fundingType: "fellowship" },
  { path: "/research-training-fellowships-for-healthcare-professionals", fundingType: "fellowship" },
  { path: "/career-development-research-fellowships-for-healthcare-professionals", fundingType: "fellowship" },
  { path: "/bhf-daphne-jackson-trust-fellowships", fundingType: "fellowship" },
  { path: "/starter-grants-for-clinical-lecturers", fundingType: "grant" },
  { path: "/small-meetingsevents-funds", fundingType: "bursary" },
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

export function parseBhfPage(
  html: string,
  pageUrl: string,
  fundingType: string
): RawBhfScheme {
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim();

  // Description: first substantial paragraphs from main content
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

  // Eligibility: under "Entry requirements" or "Requirements" heading
  const eligibility = extractSection($, /entry\s+requirements?|^requirements?$/i);

  const bodyText = $("main, article, .entry-content, body").first().text();

  // Amount: £N,NNN or "up to £N"
  const amountMatch = bodyText.match(
    /(?:up\s+to\s+)?(£[\d,.]+(?:\s*(?:k|m|million))?)/i
  );
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  // Deadline: look for date patterns near deadline/closing keywords
  let deadlineRaw: string | null = null;
  const DATE_RE = /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i;
  const closedContextRE = /(?:deadline|closes?|closing date|applications?\s+(?:close|by))[:\s]+/i;
  const ctxMatch = bodyText.match(closedContextRE);
  if (ctxMatch) {
    const after = bodyText.slice(ctxMatch.index! + ctxMatch[0].length);
    const dateMatch = after.match(DATE_RE);
    if (dateMatch) deadlineRaw = dateMatch[1].trim();
  }

  // Rolling = "no closing dates" or "no set closing dates"
  const isRolling = /no\s+(?:set\s+)?closing\s+dates?|rolling\s+submission/i.test(bodyText);

  // Status: BHF pages are usually open (rolling). Check for explicit "closed" or "currently not"
  const isClosed = /currently\s+(?:not\s+)?(?:accepting|open)|applications?\s+are\s+(?:currently\s+)?closed/i.test(bodyText);
  const status = isClosed ? "closed" : "open";

  if (isRolling) deadlineRaw = deadlineRaw ?? null; // rolling = no specific deadline

  return { title, url: pageUrl, fundingType, status, description, eligibility, amountRaw, deadlineRaw };
}

export async function fetchBhfSchemes(): Promise<RawBhfScheme[]> {
  const schemes: RawBhfScheme[] = [];

  for (const { path, fundingType } of SCHEME_PAGES) {
    const url = `${BASE_URL}${BASE_PATH}${path}`;
    console.log(`  Fetching BHF scheme: ${url}`);
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`  BHF: ${url} returned ${res.status} — skipping`);
      continue;
    }
    const html = await res.text();
    const scheme = parseBhfPage(html, url, fundingType);
    if (!scheme.title) continue;
    schemes.push(scheme);
  }

  console.log(`  Found ${schemes.length} BHF scheme entries`);
  return schemes;
}
