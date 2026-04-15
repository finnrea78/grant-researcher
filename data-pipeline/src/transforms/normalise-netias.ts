import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawNETIASScheme {
  title: string;
  ias: string;
  url: string;
  status: string;
  deadlineRaw: string | null;
  deadlineDatetime: string | null;
  description: string | null;
}

export function normaliseNETIAS(raw: RawNETIASScheme): NormalisedOpportunity {
  // deadlineDatetime is ISO format from datetime attribute e.g. "2026-07-14T22:00:00Z"
  const deadlineDate = raw.deadlineDatetime
    ? raw.deadlineDatetime.substring(0, 10)
    : null;

  return {
    funder_slug: "netias",
    funder_name: raw.ias || "NETIAS Network",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "EUR",
    url: raw.url,
    funding_type: "fellowship",
    description: raw.description,
    eligibility: null,
    scope: null,
    source: "netias",
    source_metadata: {
      ias: raw.ias,
      network: "NETIAS — Network of European Institutes for Advanced Study",
    },
  };
}
