import { parseWellcomePage } from "../../src/sources/wellcome";

const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Wellcome Schemes</title></head>
<body>
<script id="__NEXT_DATA__" type="application/json">
{
  "props": {
    "pageProps": {
      "initialListings": [
        {
          "id": "1001",
          "url": "/research-funding/schemes/discovery-research",
          "title": "Discovery Research",
          "listing_summary": "<p>Curiosity-driven research funding.</p>",
          "scheme_status": "Open",
          "level_of_funding": "<p>Up to £300,000</p>",
          "duration_of_funding": "<p>Up to 2 years</p>",
          "scheme_closes_for_applications": "01 September 2026",
          "frequency": "Annual",
          "lead_applicant_career_stage": [{"id": 1, "name": "Mid-career researcher"}],
          "location_ref": [{"id": 1, "name": "UK"}]
        },
        {
          "id": "1002",
          "url": "/research-funding/schemes/career-development-awards",
          "title": "Career Development Awards",
          "listing_summary": "<p>Supporting the next generation.</p>",
          "scheme_status": "Closed",
          "level_of_funding": "<p>£200,000–£400,000</p>",
          "duration_of_funding": "<p>5 years</p>",
          "scheme_closes_for_applications": null,
          "frequency": "Annual",
          "lead_applicant_career_stage": [{"id": 2, "name": "Early-career researcher"}],
          "location_ref": [{"id": 2, "name": "Worldwide"}]
        }
      ],
      "initialFilters": {},
      "initialPagination": {}
    }
  }
}
</script>
</body>
</html>`;

describe("parseWellcomePage", () => {
  it("extracts schemes from initialListings", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Discovery Research");
    expect(result[1].title).toBe("Career Development Awards");
  });

  it("maps scheme_status to status", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    expect(result[0].status).toBe("Open");
    expect(result[1].status).toBe("Closed");
  });

  it("maps scheme_closes_for_applications to deadline", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    expect(result[0].deadline).toBe("01 September 2026");
    expect(result[1].deadline).toBe("");
  });

  it("strips HTML from level_of_funding", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    expect(result[0].fundingLevel).toBe("Up to £300,000");
  });

  it("strips HTML from listing_summary", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    expect(result[0].description).toBe("Curiosity-driven research funding.");
  });

  it("constructs absolute URL from relative path", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    expect(result[0].url).toBe("https://wellcome.org/research-funding/schemes/discovery-research");
  });

  it("joins career stage names", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    expect(result[0].careerStage).toBe("Mid-career researcher");
  });

  it("throws when __NEXT_DATA__ is missing", () => {
    expect(() => parseWellcomePage("<html><body></body></html>"))
      .toThrow();
  });
});
