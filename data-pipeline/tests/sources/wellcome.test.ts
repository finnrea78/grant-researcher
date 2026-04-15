import { parseWellcomePage, parseWellcomeDetailPage } from "../../src/sources/wellcome";
import { normaliseWellcome } from "../../src/transforms/normalise-wellcome";

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

const FIXTURE_DETAIL_HTML = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Discovery Research</h1>
  <p>Wellcome Discovery Research funds imaginative research that answers questions about life, health and wellbeing.</p>
  <p>It supports established researchers who want to pursue a curiosity-driven question that could lead to significant new understanding.</p>
  <h2>Eligibility</h2>
  <p>Applicants must hold a permanent or equivalent position at an eligible organisation in the UK, Republic of Ireland, or a low- or middle-income country.</p>
  <p>You must have at least 5 years of active research experience at independent level.</p>
  <h2>What we fund</h2>
  <p>Salaries, research costs, and indirect costs associated with the project.</p>
</main>
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

  it("sets eligibility to null initially (populated by detail fetch)", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    result.forEach(r => expect(r.eligibility).toBeNull());
  });

  it("throws when __NEXT_DATA__ is missing", () => {
    expect(() => parseWellcomePage("<html><body></body></html>"))
      .toThrow();
  });
});

describe("parseWellcomeDetailPage", () => {
  it("extracts multi-paragraph description from HTML", () => {
    const result = parseWellcomeDetailPage(FIXTURE_DETAIL_HTML);
    expect(result.description).toContain("Wellcome Discovery Research");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility section", () => {
    const result = parseWellcomeDetailPage(FIXTURE_DETAIL_HTML);
    expect(result.eligibility).toContain("permanent or equivalent position");
  });
});

describe("normaliseWellcome", () => {
  const raw = {
    title: "Discovery Research",
    url: "https://wellcome.org/research-funding/schemes/discovery-research",
    status: "Open",
    deadline: "01 September 2026",
    fundingLevel: "Up to £300,000",
    duration: "Up to 2 years",
    careerStage: "Mid-career researcher",
    location: "UK",
    description: "Curiosity-driven research funding.",
    frequency: "Annual",
    eligibility: "Applicants must hold a permanent position at an eligible organisation.",
  };

  it("sets source to wellcome", () => {
    expect(normaliseWellcome(raw).source).toBe("wellcome");
  });

  it("passes through eligibility", () => {
    expect(normaliseWellcome(raw).eligibility).toContain("permanent position");
  });

  it("passes through null eligibility", () => {
    const noElig = { ...raw, eligibility: null };
    expect(normaliseWellcome(noElig).eligibility).toBeNull();
  });

  it("sets scope to null", () => {
    expect(normaliseWellcome(raw).scope).toBeNull();
  });

  it("parses amount_max from funding level", () => {
    expect(normaliseWellcome(raw).amount_max).toBe(30_000_000);
  });
});
