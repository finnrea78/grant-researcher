import * as cheerio from "cheerio";
import type { RawWellcomeScheme } from "../transforms/normalise-wellcome.js";

const SCHEMES_URL = "https://wellcome.org/grant-funding/schemes";

export function parseWellcomePage(html: string): RawWellcomeScheme[] {
  const $ = cheerio.load(html);
  const scriptTag = $("#__NEXT_DATA__").html();
  if (!scriptTag) {
    throw new Error("Wellcome: __NEXT_DATA__ script tag not found");
  }

  const data = JSON.parse(scriptTag);
  const schemes = data.props?.pageProps?.data?.schemes;
  if (!schemes) {
    throw new Error("Wellcome: schemes not found in page data");
  }

  return schemes as RawWellcomeScheme[];
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
