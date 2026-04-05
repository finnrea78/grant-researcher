import { extractOrcidFields } from "@/lib/extractOrcidFields";

const ORCID = "0000-0001-2345-6789";

function makeRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    person: {
      name: {
        "given-names": { value: "Jane" },
        "family-name": { value: "Smith" },
      },
    },
    "activities-summary": {
      employments: {
        "affiliation-group": [
          {
            summaries: [
              {
                "employment-summary": {
                  organization: {
                    name: "University of Cambridge",
                    address: { country: "GB" },
                  },
                  "department-name": "Computer Science",
                },
              },
            ],
          },
        ],
      },
      educations: {
        "affiliation-group": [
          {
            summaries: [
              {
                "education-summary": {
                  "role-title": "PhD",
                  "end-date": { year: { value: "2018" } },
                },
              },
            ],
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("extractOrcidFields", () => {
  it("always includes the orcid identifier", () => {
    const result = extractOrcidFields(ORCID, {});
    expect(result.identifiers?.orcid).toBe(ORCID);
  });

  it("extracts full name from given + family", () => {
    const result = extractOrcidFields(ORCID, makeRecord());
    expect(result.name).toBe("Jane Smith");
  });

  it("extracts name with only given name", () => {
    const record = makeRecord({
      person: { name: { "given-names": { value: "Jane" } } },
    });
    const result = extractOrcidFields(ORCID, record);
    expect(result.name).toBe("Jane");
  });

  it("extracts name with only family name", () => {
    const record = makeRecord({
      person: { name: { "family-name": { value: "Smith" } } },
    });
    const result = extractOrcidFields(ORCID, record);
    expect(result.name).toBe("Smith");
  });

  it("sets no name when person is missing", () => {
    const record = makeRecord({ person: undefined });
    const result = extractOrcidFields(ORCID, record);
    expect(result.name).toBeUndefined();
  });

  it("extracts institution from first employment", () => {
    const result = extractOrcidFields(ORCID, makeRecord());
    expect(result.institution).toBe("University of Cambridge");
  });

  it("extracts department from employment", () => {
    const result = extractOrcidFields(ORCID, makeRecord());
    expect(result.department).toBe("Computer Science");
  });

  it("extracts institution_country from employment address", () => {
    const result = extractOrcidFields(ORCID, makeRecord());
    expect(result.institution_country).toBe("GB");
  });

  it("sets no institution when activities-summary is missing", () => {
    const record = makeRecord({ "activities-summary": undefined });
    const result = extractOrcidFields(ORCID, record);
    expect(result.institution).toBeUndefined();
    expect(result.department).toBeUndefined();
  });

  it("sets no institution when employments array is empty", () => {
    const record = makeRecord({
      "activities-summary": {
        employments: { "affiliation-group": [] },
        educations: { "affiliation-group": [] },
      },
    });
    const result = extractOrcidFields(ORCID, record);
    expect(result.institution).toBeUndefined();
  });

  it("extracts phd_year for role-title 'PhD'", () => {
    const result = extractOrcidFields(ORCID, makeRecord());
    expect(result.eligibility?.phd_year).toBe(2018);
  });

  it("extracts phd_year for role-title 'DPhil'", () => {
    const record = makeRecord({
      "activities-summary": {
        employments: { "affiliation-group": [] },
        educations: {
          "affiliation-group": [
            {
              summaries: [
                {
                  "education-summary": {
                    "role-title": "DPhil in Computer Science",
                    "end-date": { year: { value: "2020" } },
                  },
                },
              ],
            },
          ],
        },
      },
    });
    const result = extractOrcidFields(ORCID, record);
    expect(result.eligibility?.phd_year).toBe(2020);
  });

  it("extracts phd_year for role-title 'Doctoral Researcher'", () => {
    const record = makeRecord({
      "activities-summary": {
        employments: { "affiliation-group": [] },
        educations: {
          "affiliation-group": [
            {
              summaries: [
                {
                  "education-summary": {
                    "role-title": "Doctoral Researcher",
                    "end-date": { year: { value: "2015" } },
                  },
                },
              ],
            },
          ],
        },
      },
    });
    const result = extractOrcidFields(ORCID, record);
    expect(result.eligibility?.phd_year).toBe(2015);
  });

  it("does not extract phd_year for non-PhD education", () => {
    const record = makeRecord({
      "activities-summary": {
        employments: { "affiliation-group": [] },
        educations: {
          "affiliation-group": [
            {
              summaries: [
                {
                  "education-summary": {
                    "role-title": "BSc",
                    "end-date": { year: { value: "2010" } },
                  },
                },
              ],
            },
          ],
        },
      },
    });
    const result = extractOrcidFields(ORCID, record);
    expect(result.eligibility?.phd_year).toBeUndefined();
  });

  it("does not set phd_year when end-date is missing", () => {
    const record = makeRecord({
      "activities-summary": {
        employments: { "affiliation-group": [] },
        educations: {
          "affiliation-group": [
            {
              summaries: [
                {
                  "education-summary": {
                    "role-title": "PhD",
                  },
                },
              ],
            },
          ],
        },
      },
    });
    const result = extractOrcidFields(ORCID, record);
    expect(result.eligibility?.phd_year).toBeUndefined();
  });

  it("returns only orcid identifier for an empty record", () => {
    const result = extractOrcidFields(ORCID, {});
    expect(result).toEqual({ identifiers: { orcid: ORCID } });
  });
});
