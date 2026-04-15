import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawMicrobiologySocietyGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
}

export function normaliseMicrobiologySociety(raw: RawMicrobiologySocietyGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  return {
    funder_slug: "microbiology-society",
    funder_name: "Microbiology Society",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: null,
    deadline_date: null,
    amount_raw: raw.amountRaw,
    amount_min: min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: "grant",
    description: raw.description,
    eligibility: null,
    scope: "microbiology, virology, mycology, bacteriology",
    source: "microbiology_society",
    source_metadata: {},
  };
}
