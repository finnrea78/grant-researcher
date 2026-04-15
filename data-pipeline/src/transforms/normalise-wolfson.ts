import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawWolfsonScheme {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
  programme: "places" | "people";
}

export function normaliseWolfson(raw: RawWolfsonScheme): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  let deadlineDate: string | null = null;
  if (raw.deadlineRaw) {
    const dateMatch = raw.deadlineRaw.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    if (dateMatch) deadlineDate = parseDate(dateMatch[1]);
  }

  return {
    funder_slug: "wolfson-foundation",
    funder_name: "Wolfson Foundation",
    name: raw.title.replace(/\s+funding$/i, "").trim(),
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: raw.programme === "places" ? "capital" : "fellowship",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "wolfson",
    source_metadata: {
      programme: raw.programme,
    },
  };
}
