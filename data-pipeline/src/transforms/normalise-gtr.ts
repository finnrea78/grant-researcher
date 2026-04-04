import type { GtrProject, GtrClassificationItem, NormalisedGrant, Classification } from "../types.js";
import { slugify } from "./slugify.js";

/** Map UKRI council display names to slugs. */
const COUNCIL_SLUGS: Record<string, string> = {
  AHRC: "ahrc",
  BBSRC: "bbsrc",
  EPSRC: "epsrc",
  ESRC: "esrc",
  MRC: "mrc",
  NERC: "nerc",
  STFC: "stfc",
  "Innovate UK": "innovate-uk",
  "Research England": "research-england",
  UKRI: "ukri",
};

function mapStatus(gtrStatus?: string): string {
  if (!gtrStatus) return "closed_award";
  if (/active/i.test(gtrStatus)) return "active_award";
  return "closed_award";
}

function extractGrantRef(project: GtrProject): string | null {
  const ids = project.identifiers?.identifier;
  if (!ids) return null;
  const idList = Array.isArray(ids) ? ids : [ids];
  const rcuk = idList.find((id) => id.type === "RCUK");
  return rcuk?.value ?? null;
}

function extractClassifications(
  items: GtrClassificationItem | GtrClassificationItem[] | undefined,
  type: string
): Classification[] {
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  return list
    .filter((c) => c.text)
    .map((c) => ({ type, name: c.text!, percentage: c.percentage ?? null }));
}

export function normaliseGtrProject(project: GtrProject): NormalisedGrant {
  const funderName = project.leadFunder ?? "ukri";
  const funderSlug = COUNCIL_SLUGS[funderName] ?? slugify(funderName);
  const grantRef = extractGrantRef(project);

  const classifications: Classification[] = [
    ...extractClassifications(project.researchSubjects?.researchSubject, "research_subject"),
    ...extractClassifications(project.researchTopics?.researchTopic, "research_topic"),
    ...extractClassifications(project.healthCategories?.healthCategory, "health_category"),
  ];

  return {
    funder_slug: funderSlug,
    name: project.title,
    slug: slugify(project.title),
    grant_reference: grantRef,
    status: mapStatus(project.status),
    abstract: project.abstractText ?? null,
    technical_summary: project.technicalSummary ?? null,
    impact_text: project.potentialImpactText ?? null,
    grant_category: project.grantCategory ?? null,
    fund_start: project.fund?.start?.slice(0, 10) ?? null,
    fund_end: project.fund?.end?.slice(0, 10) ?? null,
    amount: project.valuePounds ?? null,
    amount_currency: "GBP",
    url: `https://gtr.ukri.org/projects?ref=${grantRef ?? project.id}`,
    source: "gtr",
    source_metadata: { gtr_id: project.id },
    classifications,
  };
}
