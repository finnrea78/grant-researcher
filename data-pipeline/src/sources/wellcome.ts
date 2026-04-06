import * as cheerio from "cheerio";
import type { RawWellcomeScheme } from "../transforms/normalise-wellcome.js";

const SCHEMES_URL = "https://wellcome.org/grant-funding/schemes";
const WELLCOME_BASE = "https://wellcome.org";

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
}

interface WellcomeApiListing {
  id: string;
  url: string;
  title: string;
  listing_summary: string;
  scheme_status: string;
  level_of_funding: string;
  duration_of_funding: string;
  scheme_closes_for_applications: string | null;
  frequency: string;
  lead_applicant_career_stage: Array<{ name: string }>;
  location_ref: Array<{ name: string }>;
}

export function parseWellcomePage(html: string): RawWellcomeScheme[] {
  const $ = cheerio.load(html);
  const scriptTag = $("#__NEXT_DATA__").html();
  if (!scriptTag) {
    throw new Error("Wellcome: __NEXT_DATA__ script tag not found");
  }

  const data = JSON.parse(scriptTag);
  const listings: WellcomeApiListing[] = data.props?.pageProps?.initialListings;
  if (!listings) {
    throw new Error("Wellcome: initialListings not found in page data");
  }

  return listings.map((item) => ({
    title: item.title,
    url: item.url.startsWith("http") ? item.url : `${WELLCOME_BASE}${item.url}`,
    status: item.scheme_status,
    deadline: item.scheme_closes_for_applications ?? "",
    fundingLevel: stripHtml(item.level_of_funding),
    duration: stripHtml(item.duration_of_funding),
    careerStage: item.lead_applicant_career_stage.map((s) => s.name).join(", "),
    location: item.location_ref.map((l) => l.name).join(", "),
    description: stripHtml(item.listing_summary),
    frequency: item.frequency,
  }));
}

export async function fetchWellcomeSchemes(): Promise<RawWellcomeScheme[]> {
  console.log(`  Fetching Wellcome schemes: ${SCHEMES_URL}`);

  const response = await fetch(SCHEMES_URL);
  if (!response.ok) {
    throw new Error(`Wellcome error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseWellcomePage(html);
  console.log(`  Found ${schemes.length} schemes from Wellcome`);
  return schemes;
}
