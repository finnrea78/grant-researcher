import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawWolfsonScheme {
  title: string;
  url: string;
  status: string;
  description: string | null;
  programme: "places" | "people";
}

export function normaliseWolfson(raw: RawWolfsonScheme): NormalisedOpportunity {
  return {
    funder_slug: "wolfson-foundation",
    funder_name: "Wolfson Foundation",
    name: raw.title.replace(/\s+funding$/i, "").trim(),
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: null,
    deadline_date: null,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "GBP",
    url: raw.url,
    funding_type: raw.programme === "places" ? "capital" : "fellowship",
    description: raw.description,
    eligibility: null,
    scope: null,
    source: "wolfson",
    source_metadata: {
      programme: raw.programme,
    },
  };
}
