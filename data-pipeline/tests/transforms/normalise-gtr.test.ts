import { normaliseGtrProject } from "../../src/transforms/normalise-gtr";
import type { GtrProject } from "../../src/types";

const sampleProject: GtrProject = {
  id: "abc123",
  title: "Digital Heritage Mapping",
  status: "Active",
  grantCategory: "Research Grant",
  leadFunder: "AHRC",
  abstractText: "A study of digital heritage...",
  technicalSummary: "Using GIS and 3D modelling...",
  potentialImpactText: "Museums and galleries will benefit...",
  identifiers: {
    identifier: [{ value: "AH/T001011/1", type: "RCUK" }],
  },
  researchSubjects: {
    researchSubject: [
      { text: "Art History", percentage: 60 },
      { text: "Digital Humanities", percentage: 40 },
    ],
  },
  researchTopics: { researchTopic: [] },
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

  it("amount is null (not provided by GtR list API)", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.amount).toBeNull();
  });

  it("extracts classifications with percentages", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.classifications).toEqual([
      { type: "research_subject", name: "Art History", percentage: 60 },
      { type: "research_subject", name: "Digital Humanities", percentage: 40 },
    ]);
  });

  it("maps abstract to top-level field", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.abstract).toBe("A study of digital heritage...");
  });

  it("stores gtr_id in source_metadata", () => {
    const result = normaliseGtrProject(sampleProject);
    expect(result.source_metadata).toMatchObject({ gtr_id: "abc123" });
  });

  it("maps funder name to slug", () => {
    expect(normaliseGtrProject(sampleProject).funder_slug).toBe("ahrc");
  });
});
