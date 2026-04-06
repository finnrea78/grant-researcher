import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";

export interface RawFindAGrant {
  grantName: string;
  label: string;
  grantShortDescription: string;
  grantFunder: string;
  grantApplicationOpenDate: string;
  grantApplicationCloseDate: string;
  grantMinimumAward: number;
  grantMaximumAward: number;
  grantTotalAwardAmount: number;
  grantLocation: string[];
  grantApplicantType: string[];
  grantWebpageUrl: string;
  id: string;
}

const FIND_A_GRANT_BASE = "https://www.find-government-grants.service.gov.uk/grants";

export function normaliseFindAGrant(raw: RawFindAGrant): NormalisedOpportunity {
  const closeDate = raw.grantApplicationCloseDate
    ? new Date(raw.grantApplicationCloseDate)
    : null;

  const deadlineDate = closeDate && !isNaN(closeDate.getTime())
    ? closeDate.toISOString().slice(0, 10)
    : null;

  const status = closeDate && closeDate < new Date() ? "closed" : "open";

  const amountMin = raw.grantMinimumAward > 0 ? raw.grantMinimumAward * 100 : null;
  const amountMax = raw.grantMaximumAward > 0 ? raw.grantMaximumAward * 100 : null;

  const url = raw.grantWebpageUrl || `${FIND_A_GRANT_BASE}/${raw.label}`;

  return {
    funder_slug: slugify(raw.grantFunder),
    funder_name: raw.grantFunder,
    name: raw.grantName,
    slug: raw.label,
    status,
    deadline_raw: raw.grantApplicationCloseDate || null,
    deadline_date: deadlineDate,
    amount_raw: null,
    amount_min: amountMin,
    amount_max: amountMax,
    amount_currency: "GBP",
    url,
    funding_type: null,
    description: raw.grantShortDescription || null,
    eligibility: null,
    scope: null,
    source: "find_a_grant",
    source_metadata: {
      contentful_id: raw.id,
      location: raw.grantLocation,
      applicant_type: raw.grantApplicantType,
      total_award_amount: raw.grantTotalAwardAmount,
      open_date: raw.grantApplicationOpenDate,
    },
  };
}
