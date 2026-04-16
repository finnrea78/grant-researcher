import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawRc1851Grant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  eligibility: string | null;
  deadlineRaw: string | null;
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

  let deadlineDate: string | null = null;
  if (raw.deadlineRaw) {
    const dateMatch = raw.deadlineRaw.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    if (dateMatch) deadlineDate = parseDate(dateMatch[1]);
  }

  return {
    funder_slug: "royal-commission-1851",
    funder_name: "Royal Commission for the Exhibition of 1851",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: fundingType,
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "royal_commission_1851",
    source_metadata: {},
  };
}
