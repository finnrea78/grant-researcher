import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawRaengGrant } from "../transforms/normalise-raeng.js";

const BASE_URL = "https://raeng.org.uk";

const PROGRAMME_PAGES: { url: string; defaultTitle: string; fundingType: string }[] = [
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/research-fellowships/`,
    defaultTitle: "RAEng Research Fellowships",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/apex-awards/`,
    defaultTitle: "APEX Awards",
    fundingType: "grant",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/chair-in-emerging-technologies/`,
    defaultTitle: "Chair in Emerging Technologies",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/gff/`,
    defaultTitle: "Green Future Fellowships",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/research-ready/`,
    defaultTitle: "Google DeepMind Research Ready",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/industrial-fellowships/`,
    defaultTitle: "RAEng Industrial Fellowships",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/raeng-leverhulme-trust-research-fellowships/`,
    defaultTitle: "RAEng / Leverhulme Trust Research Fellowships",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/research-chairs-and-senior-research-fellowships/`,
    defaultTitle: "Research Chairs and Senior Research Fellowships",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/research-internships-scheme/`,
    defaultTitle: "RAEng Research Internships Scheme",
    fundingType: "bursary",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/uk-ic-postdoctoral-research-fellowships/`,
    defaultTitle: "UK IC Postdoctoral Research Fellowships",
    fundingType: "fellowship",
  },
  {
    url: `${BASE_URL}/programmes-and-prizes/programmes/uk-grants-and-prizes/ingenious-public-engagement-grants-scheme/`,
    defaultTitle: "Ingenious Public Engagement Grants",
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

export function parseRaengPage(
  html: string,
  pageUrl: string,
  defaultTitle: string,
  fundingType: string
): RawRaengGrant {
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

  const eligibility = extractSection($, /eligibility|who can apply|who is eligible/i);

  const bodyText = $("main, article, .entry-content, body").first().text();

  // Amount: £N,NNN or £NM or "£N million over N years" — take the first match
  const amountMatch = bodyText.match(
    /£[\d,.]+(?:\s*(?:k|m|million|billion))?(?:\s+(?:per\s+\w+|over\s+\d+\s+years?))?/i
  );
  const amountRaw = amountMatch ? amountMatch[0].trim() : null;

  // Deadline: look for dates near deadline/closing keywords
  let deadlineRaw: string | null = null;
  const DATE_RE = /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i;
  const datePatterns = [
    /(?:deadline|closes?|closing date|applications?\s+(?:close|by))[:\s]+/i,
    /(?:opening|open(?:ing)?)[:\s]+(?:in\s+)?/i,
  ];
  for (const prefix of datePatterns) {
    const prefixMatch = bodyText.match(prefix);
    if (!prefixMatch) continue;
    const after = bodyText.slice(prefixMatch.index! + prefixMatch[0].length);
    const dateMatch = after.match(DATE_RE);
    if (dateMatch) { deadlineRaw = dateMatch[1].trim(); break; }
  }

  // Status: if the page explicitly says applications closed/paused
  const closedSignals = /applications?\s+are\s+now\s+closed|paused\s+for\s+(?:a\s+)?review|currently\s+(?:closed|paused)/i;
  const status = closedSignals.test(bodyText) ? "closed" : "open";

  return { title, url: pageUrl, fundingType, status, description, eligibility, amountRaw, deadlineRaw };
}

export async function fetchRaengGrants(): Promise<RawRaengGrant[]> {
  const grants: RawRaengGrant[] = [];

  for (const { url, defaultTitle, fundingType } of PROGRAMME_PAGES) {
    console.log(`  Fetching RAEng programme: ${url}`);
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      console.warn(`  RAEng: ${url} returned ${res.status} — skipping`);
      continue;
    }
    const html = await res.text();
    grants.push(parseRaengPage(html, url, defaultTitle, fundingType));
  }

  console.log(`  Found ${grants.length} RAEng grant entries`);
  return grants;
}
