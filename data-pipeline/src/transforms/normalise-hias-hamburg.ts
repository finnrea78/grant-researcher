import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";

export interface RawHIASScheme {
  title: string;
  url: string;
  status: string;
  deadlineRaw: string | null;
  description: string | null;
  eligibility: string | null;
}

export function normaliseHIAS(raw: RawHIASScheme): NormalisedOpportunity {
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  return {
    funder_slug: "hias-hamburg",
    funder_name: "Hamburg Institute for Advanced Study",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "EUR",
    url: raw.url,
    funding_type: "fellowship",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "hias_hamburg",
    source_metadata: {
      programme: "HIAS Hamburg Fellowship Calls",
    },
  };
}
