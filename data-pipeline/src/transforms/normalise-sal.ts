import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawSalGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normaliseSal(raw: RawSalGrant): NormalisedOpportunity {
  // Amount may be range "£500 to £5,000" — normalise "to" separator for parseAmount
  const amountForParsing = raw.amountRaw
    ? raw.amountRaw.replace(/\s+to\s+/i, " - ")
    : null;
  const { min, max, currency } = parseAmount(amountForParsing, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("fellow")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("travel")) {
    fundingType = "bursary";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "society-of-antiquaries-london",
    funder_name: "Society of Antiquaries of London",
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
    scope: "archaeology, history, heritage, antiquarianism",
    source: "sal",
    source_metadata: {},
  };
}
