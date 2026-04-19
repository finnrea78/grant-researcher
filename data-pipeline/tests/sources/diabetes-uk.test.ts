import { parseDiabetesUkPage } from "../../src/sources/diabetes-uk";
import { normaliseDiabetesUk } from "../../src/transforms/normalise-diabetes-uk";

const PAGE_URL = "https://www.diabetes.org.uk/research/for-researchers/apply-for-a-grant/project-grants";

const OPEN_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Project grants</h1>
  <p>We support high-quality, hypothesis-driven diabetes research projects lasting up to five years.
     Applications will close on 1 June 2026. Funding decisions are expected in October 2026.</p>
  <p>Grant awards of up to £500,000 are available for research projects addressing diabetes
     and its complications across the spectrum from basic to clinical science.</p>
  <h2>Eligibility</h2>
  <p>Applicants must hold a tenured research position at a UK university or NHS Trust.
     Your salary must be covered for the full duration of the grant.</p>
  <h2>How to apply</h2>
  <p>Applications must be submitted via the Diabetes UK Grants Management System.</p>
</main>
</body>
</html>`;

const FELLOWSHIP_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>RD Lawrence Fellowship</h1>
  <p>The RD Lawrence Fellowship supports postdoctoral researchers in diabetes science who are
     working to establish their independence. Preliminary applications open May 5, 2026.</p>
  <p>Awards of up to a total of £525,000 are available over five years.</p>
  <h2>Eligibility</h2>
  <p>Applicants must have three to ten years of postdoctoral experience in diabetes or related fields.</p>
</main>
</body>
</html>`;

const HOLD_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Harry Keen Intermediate Clinical Fellowship</h1>
  <p>This scheme is currently on hold and not accepting applications at this time.
     We hope to reopen the scheme in the future.</p>
  <p>When open, awards of up to £1,000,000 are available for clinically qualified professionals.</p>
</main>
</body>
</html>`;

describe("parseDiabetesUkPage", () => {
  it("extracts title from h1", () => {
    const result = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.title).toBe("Project grants");
  });

  it("sets url from parameter", () => {
    const result = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.url).toBe(PAGE_URL);
  });

  it("sets fundingType from parameter", () => {
    const grant = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(grant.fundingType).toBe("grant");
    const fellowship = parseDiabetesUkPage(FELLOWSHIP_FIXTURE, PAGE_URL, "fellowship");
    expect(fellowship.fundingType).toBe("fellowship");
  });

  it("extracts description from main paragraphs", () => {
    const result = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.description).toContain("diabetes research projects");
  });

  it("extracts eligibility under Eligibility heading", () => {
    const result = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.eligibility).toContain("tenured research position");
  });

  it("returns null eligibility when section absent", () => {
    const html = `<html><body><main><h1>Test Grant</h1>
      <p>A substantial description of this diabetes research grant that is quite long enough.</p></main></body></html>`;
    const result = parseDiabetesUkPage(html, PAGE_URL, "grant");
    expect(result.eligibility).toBeNull();
  });

  it("extracts amount from £ pattern", () => {
    const result = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.amountRaw).toContain("£500,000");
  });

  it("extracts amount including 'total of' phrasing", () => {
    const result = parseDiabetesUkPage(FELLOWSHIP_FIXTURE, PAGE_URL, "fellowship");
    expect(result.amountRaw).toContain("£525,000");
  });

  it("extracts deadline after 'applications will close on'", () => {
    const result = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.deadlineRaw).toBe("1 June 2026");
  });

  it("returns null deadline when absent", () => {
    const result = parseDiabetesUkPage(HOLD_FIXTURE, PAGE_URL, "fellowship");
    expect(result.deadlineRaw).toBeNull();
  });

  it("marks status as open by default", () => {
    const result = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.status).toBe("open");
  });

  it("marks status as closed when 'currently on hold' found", () => {
    const result = parseDiabetesUkPage(HOLD_FIXTURE, PAGE_URL, "fellowship");
    expect(result.status).toBe("closed");
  });
});

describe("normaliseDiabetesUk", () => {
  it("sets correct funder identifiers", () => {
    const raw = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    const result = normaliseDiabetesUk(raw);
    expect(result.funder_slug).toBe("diabetes-uk");
    expect(result.funder_name).toBe("Diabetes UK");
  });

  it("sets correct source", () => {
    const raw = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    const result = normaliseDiabetesUk(raw);
    expect(result.source).toBe("diabetes_uk");
  });

  it("parses amount in pence", () => {
    const raw = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    const result = normaliseDiabetesUk(raw);
    expect(result.amount_max).toBe(50_000_000); // £500,000 in pence
    expect(result.amount_currency).toBe("GBP");
  });

  it("passes through open status", () => {
    const raw = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(normaliseDiabetesUk(raw).status).toBe("open");
  });

  it("passes through closed status", () => {
    const raw = parseDiabetesUkPage(HOLD_FIXTURE, PAGE_URL, "fellowship");
    expect(normaliseDiabetesUk(raw).status).toBe("closed");
  });

  it("parses deadline date", () => {
    const raw = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    const result = normaliseDiabetesUk(raw);
    expect(result.deadline_date).toBe("2026-06-01");
  });

  it("generates a non-empty slug", () => {
    const raw = parseDiabetesUkPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(normaliseDiabetesUk(raw).slug).toBeTruthy();
  });
});
