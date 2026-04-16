import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawEsebGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  eligibility: string | null;
}

const PRIZE_KEYWORDS = /prize|award|fellowship|medal/i;
const GRANT_KEYWORDS = /fund|grant|initiative|stipend|travel|network|meeting/i;

export function normaliseEseb(raw: RawEsebGrant): NormalisedOpportunity {
  const titleLower = raw.title.toLowerCase();
  const fundingType = PRIZE_KEYWORDS.test(titleLower) && !GRANT_KEYWORDS.test(titleLower)
    ? "prize"
    : titleLower.includes("fellowship")
    ? "fellowship"
    : "grant";

  return {
    funder_slug: "eseb",
    funder_name: "European Society for Evolutionary Biology",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: null,
    deadline_date: null,
    amount_raw: raw.amountRaw,
    amount_min: null,
    amount_max: null,
    amount_currency: "EUR",
    url: raw.url,
    funding_type: fundingType,
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "eseb",
    source_metadata: {},
  };
}
