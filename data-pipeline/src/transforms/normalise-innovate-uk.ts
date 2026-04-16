import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawInnovateUKCompetition {
  title: string;
  url: string;
  status: string; // "open" | "opening_soon" | "closed"
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  openDateRaw: string | null;
  closeDateRaw: string | null;
}

const BASE_URL = "https://apply-for-innovation-funding.service.gov.uk";

export function normaliseInnovateUK(raw: RawInnovateUKCompetition): NormalisedOpportunity {
  const amount = parseAmount(raw.amountRaw ?? null);
  const deadlineDate = raw.closeDateRaw ? parseDate(raw.closeDateRaw) : null;

  return {
    funder_slug: "innovate-uk",
    funder_name: "Innovate UK",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.closeDateRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    url: raw.url.startsWith("http") ? raw.url : `${BASE_URL}${raw.url}`,
    funding_type: "grant",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "innovate_uk",
    source_metadata: {
      open_date: raw.openDateRaw,
    },
  };
}
