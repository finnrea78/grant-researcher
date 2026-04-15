import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawERCScheme {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
}

export function normaliseERC(raw: RawERCScheme): NormalisedOpportunity {
  return {
    funder_slug: "european-research-council",
    funder_name: "European Research Council",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: null,
    deadline_date: null,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "EUR",
    url: raw.url,
    funding_type: "grant",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "erc",
    source_metadata: {
      programme: "Horizon Europe",
    },
  };
}
