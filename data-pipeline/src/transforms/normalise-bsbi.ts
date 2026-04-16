import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawBsbiGrant {
  title: string;
  url: string;
  status: string;
  amountRaw: string | null;
  deadlineRaw: string | null;
  description: string | null;
  eligibility: string | null;
}

export function normaliseBsbi(raw: RawBsbiGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("studentship")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("publication")) {
    fundingType = "grant";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "bsbi",
    funder_name: "Botanical Society of Britain and Ireland",
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
    description: raw.description || null,
    eligibility: raw.eligibility || null,
    scope: null,
    source: "bsbi",
    source_metadata: {},
  };
}
