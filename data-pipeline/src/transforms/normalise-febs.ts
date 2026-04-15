import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawFebsGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normaliseFebs(raw: RawFebsGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "EUR");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("fellowships")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("award")) {
    fundingType = "prize";
  } else if (titleLower.includes("meeting") || titleLower.includes("attendance") || titleLower.includes("event")) {
    fundingType = "bursary";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "febs",
    funder_name: "Federation of European Biochemical Societies",
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
    source: "febs",
    source_metadata: {},
  };
}
