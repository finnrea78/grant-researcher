import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawBpsGrant {
  title: string;
  url: string;
  category: string | null;
  status: string;
  deadlineIso: string | null; // ISO date string "YYYY-MM-DD" or null
  amountRaw: string | null;
  description: string | null;
}

export function normaliseBps(raw: RawBpsGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  // deadline_date is already ISO — no need to parse
  const deadlineDate = raw.deadlineIso ?? null;

  const fundingType = raw.category?.toLowerCase().includes("fellowship")
    ? "fellowship"
    : raw.category?.toLowerCase().includes("prize")
    ? "prize"
    : "grant";

  return {
    funder_slug: "british-psychological-society",
    funder_name: "British Psychological Society",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineIso,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: fundingType,
    description: raw.description,
    eligibility: null,
    scope: "psychology, mental health, behavioural science",
    source: "bps",
    source_metadata: {
      category: raw.category,
    },
  };
}
