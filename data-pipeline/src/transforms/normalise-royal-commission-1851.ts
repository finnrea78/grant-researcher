import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawRc1851Grant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
}

export function normaliseRc1851(raw: RawRc1851Grant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("fellow")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("studentship") || titleLower.includes("student")) {
    fundingType = "studentship";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "royal-commission-1851",
    funder_name: "Royal Commission for the Exhibition of 1851",
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
    scope: "science, engineering, design, technology",
    source: "royal_commission_1851",
    source_metadata: {},
  };
}
