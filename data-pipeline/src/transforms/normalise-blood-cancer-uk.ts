import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawBloodCancerUKScheme {
  title: string;
  url: string;
  status: string; // "open" | "closed"
  description: string | null;
  eligibility: string | null;
  nextCallRaw: string | null;
}

const BASE_URL = "https://bloodcancer.org.uk";

export function normaliseBloodCancerUK(raw: RawBloodCancerUKScheme): NormalisedOpportunity {
  return {
    funder_slug: "blood-cancer-uk",
    funder_name: "Blood Cancer UK",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: null,
    deadline_date: null,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "GBP",
    url: raw.url.startsWith("http") ? raw.url : `${BASE_URL}${raw.url}`,
    funding_type: "grant",
    description: raw.description,
    eligibility: raw.eligibility || null,
    scope: null,
    source: "blood_cancer_uk",
    source_metadata: {
      next_call: raw.nextCallRaw,
    },
  };
}
