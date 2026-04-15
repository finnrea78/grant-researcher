import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawLmsGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
}

export function normaliseLms(raw: RawLmsGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  const titleLower = raw.title.toLowerCase();
  const fundingType = titleLower.includes("fellowship")
    ? "fellowship"
    : titleLower.includes("scholarship") || titleLower.includes("bursari")
    ? "studentship"
    : "grant";

  return {
    funder_slug: "london-mathematical-society",
    funder_name: "London Mathematical Society",
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
    funding_type: fundingType,
    description: raw.description,
    eligibility: null,
    scope: "mathematics, statistics, computer science",
    source: "lms",
    source_metadata: {},
  };
}
