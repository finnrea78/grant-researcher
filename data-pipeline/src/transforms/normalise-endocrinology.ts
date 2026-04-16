import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawEndocrinologyGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normaliseEndocrinology(raw: RawEndocrinologyGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  let deadlineDate: string | null = null;
  if (raw.deadlineRaw) {
    const dateMatch = raw.deadlineRaw.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    if (dateMatch) deadlineDate = parseDate(dateMatch[1]);
  }

  const titleLower = raw.title.toLowerCase();
  const fundingType = titleLower.includes("fellowship")
    ? "fellowship"
    : titleLower.includes("prize") || titleLower.includes("award")
    ? "prize"
    : "grant";

  return {
    funder_slug: "society-for-endocrinology",
    funder_name: "Society for Endocrinology",
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
    source: "endocrinology",
    source_metadata: {},
  };
}
