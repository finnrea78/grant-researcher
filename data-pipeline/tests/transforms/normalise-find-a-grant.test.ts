import { normaliseFindAGrant, type RawFindAGrant } from "../../src/transforms/normalise-find-a-grant";

function makeGrant(overrides: Partial<RawFindAGrant> = {}): RawFindAGrant {
  return {
    grantName: "Community Ownership Fund Round 4",
    label: "community-ownership-fund-round-4",
    grantShortDescription: "Funding for community groups to take ownership of vital assets.",
    grantFunder: "Department for Levelling Up, Housing and Communities",
    grantApplicationOpenDate: "2024-06-01T00:01",
    grantApplicationCloseDate: "2026-12-31T23:59",
    grantMinimumAward: 10000,
    grantMaximumAward: 250000,
    grantTotalAwardAmount: 50000000,
    grantLocation: ["England", "Wales"],
    grantApplicantType: ["Non-profit", "Public Sector"],
    grantWebpageUrl: "https://www.gov.uk/government/publications/community-ownership-fund",
    id: "abc123",
    ...overrides,
  };
}

describe("normaliseFindAGrant", () => {
  it("maps grantName to name", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.name).toBe("Community Ownership Fund Round 4");
  });

  it("uses label as slug", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.slug).toBe("community-ownership-fund-round-4");
  });

  it("derives funder_slug from grantFunder", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.funder_slug).toBe("department-for-levelling-up-housing-and-communities");
  });

  it("preserves funder_name from grantFunder", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.funder_name).toBe("Department for Levelling Up, Housing and Communities");
  });

  it("parses grantApplicationCloseDate to deadline_date", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.deadline_date).toBe("2026-12-31");
  });

  it("sets deadline_date to null when close date is missing", () => {
    const result = normaliseFindAGrant(makeGrant({ grantApplicationCloseDate: "" }));
    expect(result.deadline_date).toBeNull();
  });

  it("converts award amounts to pence", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.amount_min).toBe(1000000);   // 10000 * 100
    expect(result.amount_max).toBe(25000000);  // 250000 * 100
    expect(result.amount_currency).toBe("GBP");
  });

  it("handles zero/null award amounts", () => {
    const result = normaliseFindAGrant(makeGrant({
      grantMinimumAward: 0,
      grantMaximumAward: 0,
    }));
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("maps grantShortDescription to description", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.description).toBe("Funding for community groups to take ownership of vital assets.");
  });

  it("uses grantWebpageUrl as url", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.url).toBe("https://www.gov.uk/government/publications/community-ownership-fund");
  });

  it("falls back to Find a Grant detail URL when grantWebpageUrl is missing", () => {
    const result = normaliseFindAGrant(makeGrant({ grantWebpageUrl: "" }));
    expect(result.url).toBe("https://www.find-government-grants.service.gov.uk/grants/community-ownership-fund-round-4");
  });

  it("sets source to find_a_grant", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.source).toBe("find_a_grant");
  });

  it("stores location and applicant type in source_metadata", () => {
    const result = normaliseFindAGrant(makeGrant());
    expect(result.source_metadata).toEqual({
      contentful_id: "abc123",
      location: ["England", "Wales"],
      applicant_type: ["Non-profit", "Public Sector"],
      total_award_amount: 50000000,
      open_date: "2024-06-01T00:01",
    });
  });

  it("sets status to open when close date is in the future", () => {
    const result = normaliseFindAGrant(makeGrant({
      grantApplicationCloseDate: "2099-12-31T23:59",
    }));
    expect(result.status).toBe("open");
  });

  it("sets status to closed when close date is in the past", () => {
    const result = normaliseFindAGrant(makeGrant({
      grantApplicationCloseDate: "2020-01-01T00:00",
    }));
    expect(result.status).toBe("closed");
  });
});
