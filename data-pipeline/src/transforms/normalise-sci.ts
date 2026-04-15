import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawSciGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normaliseSci(raw: RawSciGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("studentship")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("scholarship")) {
    fundingType = "bursary";
  } else if (titleLower.includes("travel") || titleLower.includes("bursary")) {
    fundingType = "bursary";
  } else if (titleLower.includes("prize") || titleLower.includes("award") || titleLower.includes("medal")) {
    fundingType = "prize";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "sci",
    funder_name: "Society of Chemical Industry",
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
    source: "sci",
    source_metadata: {},
  };
}
