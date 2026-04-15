import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawGeolsocGrant {
  name: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null; // global cycle deadline
}

export function normaliseGeolsoc(raw: RawGeolsocGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  return {
    funder_slug: "geological-society-of-london",
    funder_name: "Geological Society of London",
    name: raw.name,
    slug: slugify(raw.name),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: "grant",
    description: raw.description,
    eligibility: null,
    scope: "geology, earth sciences, geoscience",
    source: "geolsoc",
    source_metadata: {},
  };
}
