import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawRSEAward {
  title: string;
  url: string;
  status: string; // "open" | "closed"
  description: string | null;
  eligibility: string | null;
  deadlineRaw: string | null;
  valueRaw: string | null;
  durationRaw: string | null;
}

export function normaliseRSE(raw: RawRSEAward): NormalisedOpportunity {
  const amount = parseAmount(raw.valueRaw ?? null);
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  return {
    funder_slug: "royal-society-of-edinburgh",
    funder_name: "Royal Society of Edinburgh",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.valueRaw,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    url: raw.url,
    funding_type: "grant",
    description: raw.description,
    eligibility: raw.eligibility || null,
    scope: null,
    source: "rse",
    source_metadata: {
      duration: raw.durationRaw,
    },
  };
}
