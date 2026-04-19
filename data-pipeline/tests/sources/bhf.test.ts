import { parseBhfPage } from "../../src/sources/bhf";
import { normaliseBhf } from "../../src/transforms/normalise-bhf";

const PAGE_URL = "https://www.bhf.org.uk/for-professionals/information-for-researchers/what-we-fund/project-grants";

const OPEN_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>BHF Project Grants</h1>
  <p>Entry requirements</p>
  <h2>Entry requirements</h2>
  <p>Applicants must hold a relevant academic post at a UK institution.</p>
  <p>We fund cardiovascular research across the full spectrum from basic science to clinical studies.
     Grants of up to £250,000 are available for up to 3 years of research.
     Deadline: 15 March 2025.
  </p>
</main>
</body>
</html>`;

const CLOSED_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>BHF Senior Research Fellowship</h1>
  <p>Applications are currently not accepting new submissions at this time.</p>
  <p>We offer fellowships worth up to £1,500,000 for senior cardiovascular researchers
     wanting to develop an independent research programme.</p>
</main>
</body>
</html>`;

const ROLLING_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>BHF Small Meetings Fund</h1>
  <p>We support small scientific meetings. No closing dates — apply at any time throughout the year.
     Awards of up to £5,000 are available.</p>
</main>
</body>
</html>`;

describe("parseBhfPage", () => {
  it("extracts title from h1", () => {
    const result = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.title).toBe("BHF Project Grants");
  });

  it("sets url from parameter", () => {
    const result = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.url).toBe(PAGE_URL);
  });

  it("sets fundingType from parameter", () => {
    const grant = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(grant.fundingType).toBe("grant");
    const fellowship = parseBhfPage(CLOSED_FIXTURE, PAGE_URL, "fellowship");
    expect(fellowship.fundingType).toBe("fellowship");
  });

  it("extracts description from main paragraphs", () => {
    const result = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.description).toContain("cardiovascular research");
  });

  it("extracts eligibility under Entry requirements heading", () => {
    const result = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.eligibility).toContain("UK institution");
  });

  it("returns null eligibility when section absent", () => {
    const result = parseBhfPage(CLOSED_FIXTURE, PAGE_URL, "fellowship");
    expect(result.eligibility).toBeNull();
  });

  it("extracts amount from £ pattern", () => {
    const result = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.amountRaw).toContain("£250,000");
  });

  it("extracts larger amount value", () => {
    const result = parseBhfPage(CLOSED_FIXTURE, PAGE_URL, "fellowship");
    expect(result.amountRaw).toContain("£1,500,000");
  });

  it("extracts deadline near keyword", () => {
    const result = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.deadlineRaw).toBe("15 March 2025");
  });

  it("returns null deadline when absent", () => {
    const result = parseBhfPage(ROLLING_FIXTURE, PAGE_URL, "bursary");
    expect(result.deadlineRaw).toBeNull();
  });

  it("marks status as open by default", () => {
    const result = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    expect(result.status).toBe("open");
  });

  it("marks status as closed when 'currently not accepting' found", () => {
    const result = parseBhfPage(CLOSED_FIXTURE, PAGE_URL, "fellowship");
    expect(result.status).toBe("closed");
  });
});

describe("normaliseBhf", () => {
  it("sets correct funder_slug", () => {
    const raw = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    const result = normaliseBhf(raw);
    expect(result.funder_slug).toBe("british-heart-foundation");
    expect(result.funder_name).toBe("British Heart Foundation");
  });

  it("sets correct source", () => {
    const raw = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    const result = normaliseBhf(raw);
    expect(result.source).toBe("bhf");
  });

  it("parses amount min/max from amountRaw", () => {
    const raw = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    const result = normaliseBhf(raw);
    expect(result.amount_max).toBe(25_000_000); // stored in pence
    expect(result.amount_currency).toBe("GBP");
  });

  it("normalises closed status", () => {
    const raw = parseBhfPage(CLOSED_FIXTURE, PAGE_URL, "fellowship");
    const result = normaliseBhf(raw);
    expect(result.status).toBe("closed");
  });

  it("sets funding_type from raw", () => {
    const raw = parseBhfPage(CLOSED_FIXTURE, PAGE_URL, "fellowship");
    const result = normaliseBhf(raw);
    expect(result.funding_type).toBe("fellowship");
  });

  it("generates a slug from title", () => {
    const raw = parseBhfPage(OPEN_FIXTURE, PAGE_URL, "grant");
    const result = normaliseBhf(raw);
    expect(result.slug).toBeTruthy();
    expect(result.slug).toContain("bhf");
  });
});
