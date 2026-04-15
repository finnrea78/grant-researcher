import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawRoyEnSocGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
}

export function normaliseRoyEnSoc(raw: RawRoyEnSocGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");

  return {
    funder_slug: "royal-entomological-society",
    funder_name: "Royal Entomological Society",
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
    funding_type: raw.title.toLowerCase().includes("bursari") ? "bursary" : "grant",
    description: raw.description,
    eligibility: null,
    scope: "entomology, insect science, ecology",
    source: "royensoc",
    source_metadata: {},
  };
}
