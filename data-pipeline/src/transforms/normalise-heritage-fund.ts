import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawHeritageFundScheme {
  title: string;
  url: string;
  description: string | null;
  eligibility: string | null;
}

export function normaliseHeritageFund(raw: RawHeritageFundScheme): NormalisedOpportunity {
  // Amount range is embedded in the title, e.g. "£10,000 to £250,000"
  const amount = parseAmount(raw.title);

  return {
    funder_slug: "national-lottery-heritage-fund",
    funder_name: "National Lottery Heritage Fund",
    name: raw.title,
    slug: slugify(raw.title),
    status: "open",
    deadline_raw: null,
    deadline_date: null,
    amount_raw: raw.title.match(/£[\d,]+.*?£[\d,]+/)?.[0] ?? null,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    url: raw.url,
    funding_type: "grant",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "heritage_fund",
    source_metadata: {},
  };
}
