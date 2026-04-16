import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawImaGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  eligibility: string | null;
}

export function normaliseIma(raw: RawImaGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  return {
    funder_slug: "institute-of-mathematics-and-its-applications",
    funder_name: "Institute of Mathematics and its Applications",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: null,
    deadline_date: null,
    amount_raw: raw.amountRaw,
    amount_min: min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: "grant",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "ima",
    source_metadata: {},
  };
}
