import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawGerdaHenkelGrant {
  title: string;
  url: string;
  fundingType: string;
  status: string;
  deadlineRaw: string | null;
  amountRaw: string | null;
  description: string | null;
  eligibility: string | null;
}

export function normaliseGerdaHenkel(raw: RawGerdaHenkelGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "EUR");

  return {
    funder_slug: "gerda-henkel-foundation",
    funder_name: "Gerda Henkel Foundation",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: null, // all Gerda Henkel programmes are rolling; no fixed date
    amount_raw: raw.amountRaw,
    amount_min: min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: raw.fundingType,
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "gerda_henkel_foundation",
    source_metadata: {},
  };
}
