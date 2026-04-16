import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawBouGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
  eligibility: string | null;
}

export function normaliseBou(raw: RawBouGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("fellowships")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("bursary") || titleLower.includes("bursaries") || titleLower.includes("travel")) {
    fundingType = "bursary";
  } else if (titleLower.includes("prize") || titleLower.includes("award")) {
    fundingType = "prize";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "british-ornithological-union",
    funder_name: "British Ornithological Union",
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
    source: "bou",
    source_metadata: {},
  };
}
