import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawLmsGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
  deadlineRaw: string | null;
  amountRaw: string | null;
}

export function normaliseLms(raw: RawLmsGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  let deadlineDate: string | null = null;
  if (raw.deadlineRaw) {
    const dateMatch = raw.deadlineRaw.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    if (dateMatch) deadlineDate = parseDate(dateMatch[1]);
  }

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
    source: "lms",
    source_metadata: {},
  };
}
