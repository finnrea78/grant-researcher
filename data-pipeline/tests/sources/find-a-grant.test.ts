import { parseFindAGrantPage, type FindAGrantPageData } from "../../src/sources/find-a-grant";

const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Find a grant</title></head>
<body>
<script id="__NEXT_DATA__" type="application/json">
{
  "props": {
    "pageProps": {
      "searchResult": [
        {
          "grantName": "Test Grant Alpha",
          "label": "test-grant-alpha",
          "grantShortDescription": "A test grant for alpha testing.",
          "grantFunder": "Department for Testing",
          "grantApplicationOpenDate": "2024-01-01T00:01",
          "grantApplicationCloseDate": "2027-06-30T23:59",
          "grantMinimumAward": 5000,
          "grantMaximumAward": 50000,
          "grantMinimumAwardDisplay": "GBP 5,000",
          "grantMaximumAwardDisplay": "GBP 50,000",
          "grantTotalAwardAmount": 1000000,
          "grantTotalAwardDisplay": "GBP 1,000,000",
          "grantLocation": ["England"],
          "grantApplicantType": ["Non-profit"],
          "grantWebpageUrl": "https://www.gov.uk/test-grant-alpha",
          "id": "entry-001"
        },
        {
          "grantName": "Test Grant Beta",
          "label": "test-grant-beta",
          "grantShortDescription": "A test grant for beta testing.",
          "grantFunder": "Arts Council England",
          "grantApplicationOpenDate": "2024-03-15T00:01",
          "grantApplicationCloseDate": "2027-09-01T23:59",
          "grantMinimumAward": 1000,
          "grantMaximumAward": 15000,
          "grantMinimumAwardDisplay": "GBP 1,000",
          "grantMaximumAwardDisplay": "GBP 15,000",
          "grantTotalAwardAmount": 500000,
          "grantTotalAwardDisplay": "GBP 500,000",
          "grantLocation": ["England", "Scotland"],
          "grantApplicantType": ["Individual"],
          "grantWebpageUrl": "",
          "id": "entry-002"
        }
      ],
      "totalGrants": 2,
      "currentPage": 1
    }
  }
}
</script>
</body>
</html>`;

describe("parseFindAGrantPage", () => {
  it("extracts grants from __NEXT_DATA__ script tag", () => {
    const result = parseFindAGrantPage(FIXTURE_HTML);
    expect(result.grants).toHaveLength(2);
    expect(result.grants[0].grantName).toBe("Test Grant Alpha");
    expect(result.grants[1].grantName).toBe("Test Grant Beta");
  });

  it("extracts totalGrants for pagination", () => {
    const result = parseFindAGrantPage(FIXTURE_HTML);
    expect(result.totalGrants).toBe(2);
  });

  it("maps all required fields from the JSON", () => {
    const result = parseFindAGrantPage(FIXTURE_HTML);
    const grant = result.grants[0];
    expect(grant.grantFunder).toBe("Department for Testing");
    expect(grant.grantMinimumAward).toBe(5000);
    expect(grant.grantMaximumAward).toBe(50000);
    expect(grant.grantApplicationCloseDate).toBe("2027-06-30T23:59");
    expect(grant.grantLocation).toEqual(["England"]);
    expect(grant.grantApplicantType).toEqual(["Non-profit"]);
    expect(grant.id).toBe("entry-001");
  });

  it("throws when __NEXT_DATA__ is missing", () => {
    expect(() => parseFindAGrantPage("<html><body></body></html>"))
      .toThrow();
  });
});
