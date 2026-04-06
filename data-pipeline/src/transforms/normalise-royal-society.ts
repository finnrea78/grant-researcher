import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";

export interface RawRoyalSocietyScheme {
  title: string;
  url: string;
  status: string;
  deadlineText: string | null;
  description: string;
}

export function normaliseRoyalSociety(raw: RawRoyalSocietyScheme): NormalisedOpportunity {
  const deadlineDate = raw.deadlineText ? parseDate(raw.deadlineText) : null;

  return {
    funder_slug: "royal-society",
    funder_name: "Royal Society",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineText,
    deadline_date: deadlineDate,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "GBP",
    url: raw.url,
    funding_type: null,
    description: raw.description || null,
    eligibility: null,
    scope: null,
    source: "royal_society",
    source_metadata: {},
  };
}
