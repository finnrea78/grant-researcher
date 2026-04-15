import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawEndocrinologyGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
}

export function normaliseEndocrinology(raw: RawEndocrinologyGrant): NormalisedOpportunity {
  const titleLower = raw.title.toLowerCase();
  const fundingType = titleLower.includes("fellowship")
    ? "fellowship"
    : titleLower.includes("prize") || titleLower.includes("award")
    ? "prize"
    : "grant";

  return {
    funder_slug: "society-for-endocrinology",
    funder_name: "Society for Endocrinology",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: null,
    deadline_date: null,
    amount_raw: raw.amountRaw,
    amount_min: null,
    amount_max: null,
    amount_currency: "GBP",
    url: raw.url,
    funding_type: fundingType,
    description: raw.description,
    eligibility: null,
    scope: "endocrinology, diabetes, metabolism, hormones",
    source: "endocrinology",
    source_metadata: {},
  };
}
