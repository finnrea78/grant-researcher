import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawPalassGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normalisePalass(raw: RawPalassGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  const titleLower = raw.title.toLowerCase();
  let fundingType: string;
  if (titleLower.includes("fellowship") || titleLower.includes("studentship")) {
    fundingType = "fellowship";
  } else if (titleLower.includes("travel") || titleLower.includes("bursary") || titleLower.includes("bursaries")) {
    fundingType = "bursary";
  } else if (titleLower.includes("award") && !titleLower.includes("grant")) {
    fundingType = "prize";
  } else {
    fundingType = "grant";
  }

  return {
    funder_slug: "palaeontological-association",
    funder_name: "Palaeontological Association",
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
    scope: "palaeontology, palaeobiology, Earth science",
    source: "palass",
    source_metadata: {},
  };
}
