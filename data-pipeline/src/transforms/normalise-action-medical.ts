import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";

export interface RawActionMedicalGrant {
  title: string;
  url: string;
  status: string; // "open" | "closed"
  description: string | null;
  openDateRaw: string | null;
  deadlineRaw: string | null;
  fullDeadlineRaw: string | null;
  eligibility: string | null;
}

const BASE_URL = "https://action.org.uk";

export function normaliseActionMedical(raw: RawActionMedicalGrant): NormalisedOpportunity {
  // Prefer full application deadline over outline deadline for deadline_date
  const deadlineDate = raw.fullDeadlineRaw
    ? parseDate(raw.fullDeadlineRaw)
    : raw.deadlineRaw
    ? parseDate(raw.deadlineRaw)
    : null;

  return {
    funder_slug: "action-medical-research",
    funder_name: "Action Medical Research",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.fullDeadlineRaw ?? raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "GBP",
    url: raw.url.startsWith("http") ? raw.url : `${BASE_URL}${raw.url}`,
    funding_type: "grant",
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "action_medical",
    source_metadata: {
      open_date: raw.openDateRaw,
    },
  };
}
