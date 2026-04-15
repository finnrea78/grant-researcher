import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawCarnegieTrustScheme {
  title: string;
  url: string;
  status: string;
  description: string | null;
}

export function normaliseCarnegie(raw: RawCarnegieTrustScheme): NormalisedOpportunity {
  return {
    funder_slug: "carnegie-trust",
    funder_name: "Carnegie Trust for the Universities of Scotland",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: null,
    deadline_date: null,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "GBP",
    url: raw.url,
    funding_type: null,
    description: raw.description,
    eligibility: null,
    scope: null,
    source: "carnegie_trust",
    source_metadata: {},
  };
}
