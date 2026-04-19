import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawRscGrant } from "../transforms/normalise-rsc.js";

const BASE_URL = "https://www.rsc.org";

// Research-relevant grant and funding schemes from the sitemap
const SCHEME_PAGES: { url: string; defaultTitle: string; fundingType: string }[] = [
  {
    url: `${BASE_URL}/funding-and-support/funding/research-fund/`,
    defaultTitle: "RSC Research Fund",
    fundingType: "grant",
  },
  {
    url: `${BASE_URL}/funding-and-support/funding/researcher-collaborations-grants/`,
    defaultTitle: "RSC Researcher Collaborations Grants",
    fundingType: "grant",
  },
  {
    url: `${BASE_URL}/funding-and-support/funding/researcher-development-and-travel-grant/`,
    defaultTitle: "RSC Researcher Development and Travel Grant",
    fundingType: "bursary",
  },
  {
    url: `${BASE_URL}/funding-and-support/funding/outreach-fund/`,
    defaultTitle: "RSC Outreach Fund",
    fundingType: "grant",
  },
  {
    url: `${BASE_URL}/funding-and-support/funding/undergraduate-research-bursaries/`,
    defaultTitle: "RSC Undergraduate Research Bursaries",
    fundingType: "bursary",
  },
  {
    url: `${BASE_URL}/funding-and-support/funding/accessibility-grants/`,
    defaultTitle: "RSC Accessibility Grants",
    fundingType: "grant",
  },
  {
    url: `${BASE_URL}/funding-and-support/funding/inclusion-and-diversity-fund/`,
    defaultTitle: "RSC Inclusion and Diversity Fund",
    fundingType: "grant",
  },
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

export function parseRscPage(
  html: string,
  pageUrl: string,
  defaultTitle: string,
  fundingType: string
): RawRscGrant {
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim() || defaultTitle;

  // Description: substantial paragraphs from main content
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

  // Amount: "up to £N,NNN" or "£N,NNN"
  const amountMatch = bodyText.match(
    /(?:up\s+to\s+)?(£[\d,]+(?:\s*(?:k|m|million))?)/i
  );
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  // Deadline: look for closing date patterns in application timeline sections
  let deadlineRaw: string | null = null;
  const DATE_RE = /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i;
  const deadlineContextRE = /(?:close|closes?|closing|deadline)[:\s]+/i;
  const ctxMatch = bodyText.match(deadlineContextRE);
  if (ctxMatch) {
    const after = bodyText.slice(ctxMatch.index! + ctxMatch[0].length);
    const dateMatch = after.match(DATE_RE);
    if (dateMatch) deadlineRaw = dateMatch[1].trim();
  }

  // Status: RSC uses "Applications are now open" / "Applications are now closed"
  const status = /applications?\s+are\s+now\s+(?:open|available)/i.test(bodyText) ? "open" : "closed";

  return { title, url: pageUrl, fundingType, status, description, eligibility, amountRaw, deadlineRaw };
}

export async function fetchRscGrants(): Promise<RawRscGrant[]> {
  const grants: RawRscGrant[] = [];

  for (const { url, defaultTitle, fundingType } of SCHEME_PAGES) {
    console.log(`  Fetching RSC scheme: ${url}`);
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`  RSC: ${url} returned ${res.status} — skipping`);
      continue;
    }
    const html = await res.text();
    grants.push(parseRscPage(html, url, defaultTitle, fundingType));
  }

  console.log(`  Found ${grants.length} RSC grant entries`);
  return grants;
}
