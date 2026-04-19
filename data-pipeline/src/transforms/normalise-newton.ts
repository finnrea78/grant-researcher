import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawNewtonFellowship {
  title: string;
  url: string;
  status: string; // "open" | "closed"
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  openDateRaw: string | null;
  closeDateRaw: string | null;
  decisionDateRaw: string | null;
}

export function normaliseNewton(raw: RawNewtonFellowship): NormalisedOpportunity {
  const amount = parseAmount(raw.amountRaw ?? null);
  const deadlineDate = raw.closeDateRaw ? parseDate(raw.closeDateRaw) : null;

  return {
    funder_slug: "royal-society",
    funder_name: "Royal Society",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.closeDateRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    url: raw.url,
    funding_type: "fellowship",
    description: raw.description,
    eligibility: raw.eligibility || null,
    scope: null,
    source: "newton_fellowship",
    source_metadata: {
      open_date: raw.openDateRaw,
      decision_date: raw.decisionDateRaw,
    },
  };
}
