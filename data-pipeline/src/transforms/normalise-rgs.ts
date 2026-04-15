import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";

export interface RawRgsGrant {
  name: string;
  url: string;
  status: string;
  deadlineRaw: string | null; // "DD Month YYYY"
  description: string | null;
}

export function normaliseRgs(raw: RawRgsGrant): NormalisedOpportunity {
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  return {
    funder_slug: "royal-geographical-society",
    funder_name: "Royal Geographical Society",
    name: raw.name,
    slug: slugify(raw.name),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "GBP",
    url: raw.url,
    funding_type: raw.name.toLowerCase().includes("fellowship") ? "fellowship" : "grant",
    description: raw.description,
    eligibility: null,
    scope: "geography, exploration, fieldwork, environment",
    source: "rgs",
    source_metadata: {},
  };
}
