import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawBiochemGrant {
  title: string;
  category: string | null;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
}

export function normaliseBiochem(raw: RawBiochemGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  return {
    funder_slug: "biochemical-society",
    funder_name: "Biochemical Society",
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
    funding_type: raw.category?.toLowerCase().includes("fellowship") ? "fellowship" : "grant",
    description: raw.description,
    eligibility: null,
    scope: "biochemistry, molecular biosciences",
    source: "biochemical_society",
    source_metadata: {
      category: raw.category,
    },
  };
}
