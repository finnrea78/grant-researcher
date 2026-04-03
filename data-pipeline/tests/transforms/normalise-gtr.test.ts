import { normaliseGtrProject } from "../../src/transforms/normalise-gtr";
import type { GtrProjectOverview } from "../../src/types";

const sampleProject: GtrProjectOverview = {
  projectComposition: {
    project: {
      title: "Digital Heritage Mapping",
      status: "Active",
      grantCategory: "Research Grant",
      abstractText: "A study of digital heritage...",
      technicalSummary: "Using GIS and 3D modelling...",
      potentialImpactText: "Museums and galleries will benefit...",
      fund: {
        funder: { name: "AHRC" },
        valuePounds: 250000,
        start: "2024-01-01",
        end: "2027-01-01",
        type: "INCOME_ACTUAL",
      },
      researchSubjects: {
        classification: [
          { text: "Art History", percentage: 60 },
          { text: "Digital Humanities", percentage: 40 },
        ],
      },
      researchTopics: { classification: [] },
      identifiers: {
        identifier: [{ value: "AH/T001011/1", type: "RCUK" }],
      },
    },
    leadResearchOrganisation: { name: "University of Exeter" },
    personRoles: {
      personRole: [
        {
          firstName: "Jane",
          surname: "Smith",
          roles: { role: [{ name: "PRINCIPAL_INVESTIGATOR" }] },
        },
      ],
    },
  },
};

describe("normaliseGtrProject", () => {
  it("maps title and grant reference", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.name).toBe("Digital Heritage Mapping");
    expect(result.grant_reference).toBe("AH/T001011/1");
  });

  it("sets source to gtr", () => {
    expect(normaliseGtrProject(sampleProject).source).toBe("gtr");
  });

  it("maps Active status to active_award", () => {
    expect(normaliseGtrProject(sampleProject).status).toBe("active_award");
  });

  it("parses fund amount in pence", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.amount_min).toBe(25000000);
    expect(result.amount_max).toBe(25000000);
  });

  it("extracts classifications with percentages", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.classifications).toEqual([
      { type: "research_subject", name: "Art History", percentage: 60 },
      { type: "research_subject", name: "Digital Humanities", percentage: 40 },
    ]);
  });

  it("stores PI and org in source_metadata", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.source_metadata).toMatchObject({
      pi_name: "Jane Smith",
      lead_organisation: "University of Exeter",
      abstract: "A study of digital heritage...",
    });
  });

  it("maps funder name to slug", () => {
    expect(normaliseGtrProject(sampleProject).funder_slug).toBe("ahrc");
  });
});
