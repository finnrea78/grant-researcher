import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawBenhsGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
  eligibility: string | null;
}

export function normaliseBenhs(raw: RawBenhsGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType = "grant";
  if (titleLower.includes("travel") || titleLower.includes("bursary")) {
    fundingType = "bursary";
  }

  return {
    funder_slug: "benhs",
    funder_name: "British Entomological and Natural History Society",
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
    source: "benhs",
    source_metadata: {},
  };
}
