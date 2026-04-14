import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawNuffieldScheme {
  title: string;
  url: string;
  status: string;
  amountRaw: string | null;
  deadlineRaw: string | null;
  durationRaw: string | null;
  description: string | null;
}

export function normaliseNuffield(raw: RawNuffieldScheme): NormalisedOpportunity {
  // Deadline text may be prefixed: "Outline application deadline: October 2026"
  let deadlineText: string | null = null;
  if (raw.deadlineRaw) {
    const match = raw.deadlineRaw.match(/deadline[:\s]+(.+)/i);
    deadlineText = match ? match[1].trim() : raw.deadlineRaw;
  }

  const deadlineDate = deadlineText ? parseDate(deadlineText) : null;
  const amount = parseAmount(raw.amountRaw ?? null);

  return {
    funder_slug: "nuffield-foundation",
    funder_name: "Nuffield Foundation",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    url: raw.url,
    funding_type: null,
    description: raw.description,
    eligibility: null,
    scope: null,
    source: "nuffield",
    source_metadata: {
      duration: raw.durationRaw,
    },
  };
}
