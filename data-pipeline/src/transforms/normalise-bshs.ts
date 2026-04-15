import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawBshsGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normaliseBshs(raw: RawBshsGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("fellow")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("travel") || titleLower.includes("bursary") || titleLower.includes("carer")) {
    fundingType = "bursary";
  } else if (titleLower.includes("prize")) {
    fundingType = "prize";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "bshs",
    funder_name: "British Society for the History of Science",
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
    eligibility: null,
    scope: "history of science, technology, medicine",
    source: "bshs",
    source_metadata: {},
  };
}
