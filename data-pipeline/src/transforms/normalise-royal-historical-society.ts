import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawRhsGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
  eligibility: string | null;
}

export function normaliseRhs(raw: RawRhsGrant): NormalisedOpportunity {
  // Amount may be "£500 or £1000" — take the higher value as amount_max
  const amountForParsing = raw.amountRaw
    ? raw.amountRaw.replace(/.*or\s+(£[\d,]+)$/i, "$1")
    : null;
  const { min, max, currency } = parseAmount(amountForParsing, "GBP");

  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  const fundingType = titleLower.includes("fellowship") ? "fellowship" : "grant";

  return {
    funder_slug: "royal-historical-society",
    funder_name: "Royal Historical Society",
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
    source: "royal_historical_society",
    source_metadata: {},
  };
}
