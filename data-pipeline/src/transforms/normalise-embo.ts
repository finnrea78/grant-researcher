import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";

export interface RawEmboGrant {
  title: string;
  url: string;
  fundingType: string;
  status: string;
  deadlineRaw: string | null;
  deadlineDateRaw: string | null; // extracted parseable date portion
  description: string | null;
  eligibility: string | null;
}

export function normaliseEmbo(raw: RawEmboGrant): NormalisedOpportunity {
  const deadlineDate = raw.deadlineDateRaw ? parseDate(raw.deadlineDateRaw) : null;

  return {
    funder_slug: "embo",
    funder_name: "European Molecular Biology Organization",
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
    funding_type: raw.fundingType,
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "embo",
    source_metadata: {
      deadline_date_raw: raw.deadlineDateRaw,
    },
  };
}
