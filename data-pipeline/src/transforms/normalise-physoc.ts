import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawPhysocGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normalisePhysoc(raw: RawPhysocGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  const fundingType = titleLower.includes("fellowship")
    ? "fellowship"
    : titleLower.includes("bursary") || titleLower.includes("prize")
    ? "studentship"
    : "grant";

  return {
    funder_slug: "physiological-society",
    funder_name: "Physiological Society",
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
    source: "physoc",
    source_metadata: {},
  };
}
