import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawAcMedSciGrant {
  title: string;
  url: string;
  status: string;
  deadlineRaw: string | null;
  amountRaw: string | null;
  description: string | null;
  eligibility: string | null;
}

export function normaliseAcMedSci(raw: RawAcMedSciGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  // Parse the first date-like string found in deadlineRaw
  let deadlineDate: string | null = null;
  if (raw.deadlineRaw) {
    const dateMatch = raw.deadlineRaw.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    if (dateMatch) deadlineDate = parseDate(dateMatch[1]);
  }

  return {
    funder_slug: "academy-of-medical-sciences",
    funder_name: "Academy of Medical Sciences",
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
    funding_type: raw.title.toLowerCase().includes("fellowship") ? "fellowship" : "grant",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "acmedsci",
    source_metadata: {},
  };
}
