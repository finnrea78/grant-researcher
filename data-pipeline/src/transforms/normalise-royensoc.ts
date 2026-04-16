import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawRoyEnSocGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
  deadlineRaw: string | null;
  amountRaw: string | null;
}

export function normaliseRoyEnSoc(raw: RawRoyEnSocGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  let deadlineDate: string | null = null;
  if (raw.deadlineRaw) {
    const dateMatch = raw.deadlineRaw.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    if (dateMatch) deadlineDate = parseDate(dateMatch[1]);
  }

  return {
    funder_slug: "royal-entomological-society",
    funder_name: "Royal Entomological Society",
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
    funding_type: raw.title.toLowerCase().includes("bursari") ? "bursary" : "grant",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "royensoc",
    source_metadata: {},
  };
}
