import { parseRSEAwardPage } from "../../src/sources/rse";
import { normaliseRSE } from "../../src/transforms/normalise-rse";

const TEST_URL = "https://rse.org.uk/award/rse-personal-research-fellowships/";

const FIXTURE_HTML_CLOSED = `
<!DOCTYPE html>
<html lang="en">
<body>
<main class="wrapper">
  <h1 class="page-title">RSE Personal Research Fellowships</h1>
  <div class="container">
    <div class="row">
      <div class="column column-70">
        <p class="text-large">RSE Personal Research Fellowships allow eligible applicants to focus on a research project of their choice for up to twelve months.</p>
        <p>The award provides funding for the appointment of a temporary replacement to enable the awardee to take research leave.</p>
      </div>
      <div class="column column-30">
        <div class="sidebar-image event-data bg-grey">
          <div class="related-content">
            <div class="data-item">
              <h3>Deadline</h3>
              <p>This award is now closed.</p>
            </div>
            <div class="data-item">
              <h3>Value</h3>
              <p><p>Salary up to £52k plus research costs of £5k per year</p></p>
            </div>
            <div class="data-item">
              <h3>Duration</h3>
              <p><p>up to 12 months</p></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
</body>
</html>`;

const FIXTURE_HTML_OPEN = `
<!DOCTYPE html>
<html lang="en">
<body>
<main class="wrapper">
  <h1 class="page-title">RSE Small Research Grants</h1>
  <div class="column column-30">
    <div class="sidebar-image event-data bg-grey">
      <div class="related-content">
        <div class="data-item">
          <h3>Deadline</h3>
          <p>15 October 2026</p>
        </div>
        <div class="data-item">
          <h3>Value</h3>
          <p>£500–£5,000</p>
        </div>
        <div class="data-item">
          <h3>Duration</h3>
          <p>12 months</p>
        </div>
      </div>
    </div>
  </div>
  <p>The RSE Small Research Grants scheme provides funding for individual researchers.</p>
</main>
</body>
</html>`;

describe("parseRSEAwardPage", () => {
  it("extracts title from h1", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_CLOSED, TEST_URL);
    expect(result.title).toBe("RSE Personal Research Fellowships");
  });

  it("preserves the page URL", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_CLOSED, TEST_URL);
    expect(result.url).toBe(TEST_URL);
  });

  it("detects closed status when deadline says 'now closed'", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_CLOSED, TEST_URL);
    expect(result.status).toBe("closed");
  });

  it("detects open status when deadline is a date", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_OPEN, "https://rse.org.uk/award/rse-small-grants/");
    expect(result.status).toBe("open");
  });

  it("extracts value/amount text from sidebar", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_CLOSED, TEST_URL);
    expect(result.valueRaw).toContain("£52k");
  });

  it("extracts deadline text from sidebar", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_CLOSED, TEST_URL);
    expect(result.deadlineRaw).toContain("closed");
  });

  it("extracts deadline date for open award", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_OPEN, "https://rse.org.uk/award/rse-small-grants/");
    expect(result.deadlineRaw).toBe("15 October 2026");
  });

  it("extracts duration", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_CLOSED, TEST_URL);
    expect(result.durationRaw).toContain("12 months");
  });

  it("extracts description from first paragraph", () => {
    const result = parseRSEAwardPage(FIXTURE_HTML_CLOSED, TEST_URL);
    expect(result.description).toContain("research project");
  });
});

describe("normaliseRSE", () => {
  it("normalises a closed RSE award", () => {
    const raw = parseRSEAwardPage(FIXTURE_HTML_CLOSED, TEST_URL);
    const result = normaliseRSE(raw);

    expect(result.source).toBe("rse");
    expect(result.funder_slug).toBe("royal-society-of-edinburgh");
    expect(result.status).toBe("closed");
    expect(result.amount_max).toBeGreaterThan(0); // £52k detected
  });

  it("normalises an open award with deadline date", () => {
    const raw = parseRSEAwardPage(FIXTURE_HTML_OPEN, "https://rse.org.uk/award/rse-small-grants/");
    const result = normaliseRSE(raw);
    expect(result.status).toBe("open");
    expect(result.deadline_date).toBe("2026-10-15");
  });
});
