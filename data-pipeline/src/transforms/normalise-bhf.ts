import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawBhfScheme {
  title: string;
  url: string;
  fundingType: string;
  status: string;
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normaliseBhf(raw: RawBhfScheme): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  return {
    funder_slug: "british-heart-foundation",
    funder_name: "British Heart Foundation",
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
    funding_type: raw.fundingType,
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "bhf",
    source_metadata: {},
  };
}
