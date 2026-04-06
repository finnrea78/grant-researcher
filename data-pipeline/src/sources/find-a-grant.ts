import * as cheerio from "cheerio";
import { sleep } from "../utils/sleep.js";
import type { RawFindAGrant } from "../transforms/normalise-find-a-grant.js";

const BASE_URL = "https://www.find-government-grants.service.gov.uk/grants";
const PAGE_SIZE = 10;
const DELAY_MS = 500;

export interface FindAGrantPageData {
  grants: RawFindAGrant[];
  totalGrants: number;
}

export function parseFindAGrantPage(html: string): FindAGrantPageData {
  const $ = cheerio.load(html);
  const scriptTag = $("#__NEXT_DATA__").html();
  if (!scriptTag) {
    throw new Error("Find a Grant: __NEXT_DATA__ script tag not found");
  }

  const data = JSON.parse(scriptTag);
  const pageProps = data.props?.pageProps;
  if (!pageProps?.searchResult) {
    throw new Error("Find a Grant: searchResult not found in page data");
  }

  return {
    grants: pageProps.searchResult as RawFindAGrant[],
    totalGrants: pageProps.totalGrants ?? 0,
  };
}

export async function fetchFindAGrantOpportunities(
  limit?: number
): Promise<RawFindAGrant[]> {
  const firstUrl = `${BASE_URL}?page=1`;
  console.log(`  Fetching Find a Grant: ${firstUrl}`);

  const firstResponse = await fetch(firstUrl);
  if (!firstResponse.ok) {
    throw new Error(`Find a Grant error: ${firstResponse.status} ${firstResponse.statusText}`);
  }

  const firstHtml = await firstResponse.text();
  const firstPage = parseFindAGrantPage(firstHtml);
  const allGrants: RawFindAGrant[] = [...firstPage.grants];

  const totalPages = Math.ceil(firstPage.totalGrants / PAGE_SIZE);
  const maxGrants = limit ?? Infinity;

  for (let page = 2; page <= totalPages && allGrants.length < maxGrants; page++) {
    await sleep(DELAY_MS);
    const url = `${BASE_URL}?page=${page}`;
    console.log(`  Fetching page ${page}/${totalPages}: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`  Page ${page} failed: ${response.status} — skipping`);
      continue;
    }

    const html = await response.text();
    const pageData = parseFindAGrantPage(html);
    allGrants.push(...pageData.grants);
  }

  const result = limit ? allGrants.slice(0, limit) : allGrants;
  console.log(`  Found ${result.length} opportunities from Find a Grant`);
  return result;
}
