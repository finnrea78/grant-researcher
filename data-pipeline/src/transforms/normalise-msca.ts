import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawMSCAScheme {
  title: string;
  url: string;
  status: string;
  description: string | null;
  eligibility: string | null;
}

export function normaliseMSCA(raw: RawMSCAScheme): NormalisedOpportunity {
  return {
    funder_slug: "european-commission",
    funder_name: "Marie Skłodowska-Curie Actions",
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
    funding_type: "fellowship",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "msca",
    source_metadata: {
      programme: "Horizon Europe",
    },
  };
}
