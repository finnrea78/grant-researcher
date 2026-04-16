import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawChallengerSocietyGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
  eligibility: string | null;
}

export function normaliseChallengerSociety(raw: RawChallengerSocietyGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("fellowships")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("bursary") || titleLower.includes("travel")) {
    fundingType = "bursary";
  } else if (titleLower.includes("prize") || titleLower.includes("award")) {
    fundingType = "prize";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "challenger-society",
    funder_name: "Challenger Society for Marine Science",
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
    source: "challenger_society",
    source_metadata: {},
  };
}
