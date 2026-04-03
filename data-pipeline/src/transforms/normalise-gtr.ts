import type { GtrProject, GtrClassificationItem, NormalisedScheme, Classification } from "../types.js";
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

export function normaliseGtrProject(project: GtrProject): NormalisedScheme {
  const funderName = project.leadFunder ?? "ukri";
  const funderSlug = COUNCIL_SLUGS[funderName] ?? slugify(funderName);

  const classifications: Classification[] = [
    ...extractClassifications(project.researchSubjects?.researchSubject, "research_subject"),
    ...extractClassifications(project.researchTopics?.researchTopic, "research_topic"),
    ...extractClassifications(project.healthCategories?.healthCategory, "health_category"),
  ];

  return {
    funder_slug: funderSlug,
    name: project.title,
    slug: slugify(project.title),
    status: mapStatus(project.status),
    deadline_raw: null,
    deadline_date: null,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "GBP",
    duration: null,
    career_stage: project.grantCategory ?? null,
    institutional_eligibility: null,
    thematic_priorities: null,
    application_process: null,
    url: `https://gtr.ukri.org/projects?ref=${extractGrantRef(project) ?? project.id}`,
    grant_reference: extractGrantRef(project),
    source: "gtr",
    source_metadata: {
      gtr_id: project.id,
      abstract: project.abstractText ?? null,
      technical_summary: project.technicalSummary ?? null,
      impact_text: project.potentialImpactText ?? null,
      grant_category: project.grantCategory ?? null,
    },
    classifications,
  };
}
