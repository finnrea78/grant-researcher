import { parseHfspPage } from "../../src/sources/hfsp";
import { normaliseHfsp } from "../../src/transforms/normalise-hfsp";

const GRANTS_URL = "https://www.hfsp.org/funding/hfsp-funding/research-grants";
const FELLOWSHIPS_URL = "https://www.hfsp.org/funding/hfsp-funding/postdoctoral-fellowships";

// Research Grants fixture — deadlines in <span style="color:#000000;"><strong>
const FIXTURE_GRANTS = `
<!DOCTYPE html>
<html lang="en">
<head><title>Research Grants | Human Frontier Science Program</title></head>
<body>
<div>
  <p>HFSP Research Grants are team grants providing financial support for three years of highly innovative basic research at the frontier of life sciences.</p>
  <p>The amount paid depends on the number of team members (normally 2-4). Typical budgets are around USD 450,000 per year for a 3-member team.</p>

  <h4>Eligibility</h4>
  <p>All team members must be independent researchers. At least one team member must be from a non-G7 country.</p>
  <p>Applicants cannot be current HFSP grantees applying for a renewal of the same project.</p>

  <h4 class="text-align-justify">Deadlines</h4>
  <p class="text-align-justify">i. Compulsory initiation of a letter of Intent by obtaining an LOI ID number by
    <strong> </strong><span style="color:#000000;"><strong>17 March 2026 </strong></span>(updated for each cycle)</p>
  <p class="text-align-justify">ii. Submission of Letters of Intent:
    <span style="color:#000000;"><strong>26 March 2026</strong> </span>(updated for each cycle)</p>
</div>
</body>
</html>`;

// Postdoctoral Fellowships fixture — deadlines in <ul><li><strong>
const FIXTURE_FELLOWSHIPS = `
<!DOCTYPE html>
<html lang="en">
<head><title>Postdoctoral Fellowships | Human Frontier Science Program</title></head>
<body>
<div>
  <p style="color:#333333;">HFSP Postdoctoral Fellowships support interdisciplinary research training.</p>

  <h4 style="color:#e74c3c;"><strong>Deadlines</strong></h4>
  <ul>
    <li>The portal will OPEN on <strong>March 12, 2026</strong>.</li>
    <li>Initiation of a Letter of Intent must be completed BEFORE <strong>May 5, 2026</strong>.</li>
    <li>Submission of a Letter of Intent by <strong>May 12, 2026</strong> at 9:00 am Eastern US Time.</li>
    <li>Submission of Full Proposals for invited applicants by <strong>September 24, 2026</strong>.</li>
  </ul>
</div>
</body>
</html>`;

describe("parseHfspPage (Research Grants)", () => {
  it("extracts title from title tag", () => {
    const result = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    expect(result.title).toBe("Research Grants");
  });

  it("extracts first deadline date from strong tags", () => {
    const result = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    expect(result.deadlineRaw).toContain("March 2026");
  });

  it("collects all deadline dates", () => {
    const result = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    expect(result.allDates.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts multi-paragraph description", () => {
    const result = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    expect(result.description).toContain("HFSP Research Grants");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility from heading section", () => {
    const result = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    expect(result.eligibility).toContain("independent researchers");
  });

  it("sets status to open", () => {
    const result = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    expect(result.status).toBe("open");
  });
});

describe("parseHfspPage (Postdoctoral Fellowships)", () => {
  it("extracts title from title tag", () => {
    const result = parseHfspPage(FIXTURE_FELLOWSHIPS, FELLOWSHIPS_URL, "HFSP Postdoctoral Fellowships", "fellowship");
    expect(result.title).toBe("Postdoctoral Fellowships");
  });

  it("extracts first deadline from list items", () => {
    const result = parseHfspPage(FIXTURE_FELLOWSHIPS, FELLOWSHIPS_URL, "HFSP Postdoctoral Fellowships", "fellowship");
    expect(result.deadlineRaw).toMatch(/March 12, 2026|May/);
  });

  it("collects multiple deadline dates", () => {
    const result = parseHfspPage(FIXTURE_FELLOWSHIPS, FELLOWSHIPS_URL, "HFSP Postdoctoral Fellowships", "fellowship");
    expect(result.allDates.length).toBeGreaterThanOrEqual(3);
  });
});

describe("normaliseHfsp", () => {
  it("sets source to hfsp", () => {
    const raw = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    const result = normaliseHfsp(raw);
    expect(result.source).toBe("hfsp");
  });

  it("sets funder_slug to hfsp", () => {
    const raw = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    const result = normaliseHfsp(raw);
    expect(result.funder_slug).toBe("hfsp");
  });

  it("parses deadline_date from UK-format date", () => {
    const raw = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    // First date is "17 March 2026"
    const result = normaliseHfsp(raw);
    expect(result.deadline_date).toBe("2026-03-17");
  });

  it("parses deadline_date from US-format date (fellowships)", () => {
    const raw = parseHfspPage(FIXTURE_FELLOWSHIPS, FELLOWSHIPS_URL, "HFSP Postdoctoral Fellowships", "fellowship");
    const result = normaliseHfsp(raw);
    // First date is "March 12, 2026" → should parse to 2026-03-12
    expect(result.deadline_date).toBe("2026-03-12");
  });

  it("sets amount fields to null (amounts in PDF only)", () => {
    const raw = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    const result = normaliseHfsp(raw);
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("sets amount_currency to USD", () => {
    const raw = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    const result = normaliseHfsp(raw);
    expect(result.amount_currency).toBe("USD");
  });

  it("stores all deadline dates in source_metadata", () => {
    const raw = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    const result = normaliseHfsp(raw);
    expect((result.source_metadata.all_deadline_dates as string[]).length).toBeGreaterThanOrEqual(2);
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    const raw = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    expect(normaliseHfsp(raw).scope).toBeNull();
  });

  it("passes through eligibility", () => {
    const raw = parseHfspPage(FIXTURE_GRANTS, GRANTS_URL, "HFSP Research Grants", "grant");
    expect(normaliseHfsp(raw).eligibility).toContain("independent researchers");
  });
});
