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
      "data": {
        "schemes": [
          {
            "title": "Discovery Research",
            "url": "/grant-funding/schemes/discovery-research",
            "status": "Open",
            "deadline": "1 September 2026",
            "fundingLevel": "Up to £300,000",
            "duration": "Up to 2 years",
            "careerStage": "Mid-career researchers",
            "location": "UK-based",
            "description": "Curiosity-driven research funding.",
            "frequency": "Annual"
          },
          {
            "title": "Career Development Awards",
            "url": "/grant-funding/schemes/career-development-awards",
            "status": "Closed",
            "deadline": "",
            "fundingLevel": "£200,000-£400,000",
            "duration": "5 years",
            "careerStage": "Early-career researchers",
            "location": "Worldwide",
            "description": "Supporting the next generation.",
            "frequency": "Annual"
          }
        ]
      }
    }
  }
}
</script>
</body>
</html>`;

describe("parseWellcomePage", () => {
  it("extracts schemes from __NEXT_DATA__", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Discovery Research");
    expect(result[1].title).toBe("Career Development Awards");
  });

  it("maps all required fields", () => {
    const result = parseWellcomePage(FIXTURE_HTML);
    const scheme = result[0];
    expect(scheme.status).toBe("Open");
    expect(scheme.fundingLevel).toBe("Up to £300,000");
    expect(scheme.careerStage).toBe("Mid-career researchers");
  });

  it("throws when __NEXT_DATA__ is missing", () => {
    expect(() => parseWellcomePage("<html><body></body></html>"))
      .toThrow();
  });
});
