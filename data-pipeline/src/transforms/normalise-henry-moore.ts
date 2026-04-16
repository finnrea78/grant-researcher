import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawHenryMooreScheme {
  title: string;
  url: string;
  status: string;
  deadlineRaw: string | null;
  amountRaw: string | null;
  description: string | null;
  openWindow: string | null;
}

export function normaliseHenryMoore(raw: RawHenryMooreScheme): NormalisedOpportunity {
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;
  const amount = parseAmount(raw.amountRaw ?? null);

  return {
    funder_slug: "henry-moore-foundation",
    funder_name: "Henry Moore Foundation",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: null,
    amount_max: amount.max,
    amount_currency: amount.currency,
    url: raw.url,
    funding_type: "grant",
    description: raw.description,
    eligibility: null,
    scope: null,
    source: "henry_moore",
    source_metadata: {
      open_window: raw.openWindow,
    },
  };
}
