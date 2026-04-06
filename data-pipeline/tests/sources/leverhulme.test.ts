import { parseLeverhulmePage } from "../../src/sources/leverhulme";

// Fixture matches real Leverhulme Drupal HTML structure
const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<body>
<div class="view view-schemes-at-a-glance">
<div class="view-content">

<div class="scheme-closed views-row">
  <div class="view-column view-column-first">
    <div class="views-field views-field-title">
      <span class="field-content"><a href="/research-project-grants">Research Project Grants</a></span>
    </div>
    <div class="views-field views-field-field-listing-text">
      <div class="field-content">Support for original research of recognised excellence.</div>
    </div>
  </div>
  <div class="view-column view-column-last">
    <div class="views-field views-field-field-listing-value">
      <span class="views-label">Value</span>
      <div class="field-content">£500,000</div>
    </div>
    <div class="views-field views-field-field-listing-duration">
      <span class="views-label views-label-field-listing-duration">Duration</span>
      <div class="field-content">Up to 5 years</div>
    </div>
    <div class="views-field views-field-field-scheme-closed">
      <div class="field-content">Currently closed</div>
    </div>
  </div>
</div>

<div class="views-row">
  <div class="view-column view-column-first">
    <div class="views-field views-field-title">
      <span class="field-content"><a href="/early-career-fellowships">Early Career Fellowships</a></span>
    </div>
    <div class="views-field views-field-field-listing-text">
      <div class="field-content">Funding for those at the start of their career.</div>
    </div>
  </div>
  <div class="view-column view-column-last">
    <div class="views-field views-field-field-listing-value">
      <span class="views-label">Value</span>
      <div class="field-content">£130,000</div>
    </div>
    <div class="views-field views-field-field-listing-duration">
      <span class="views-label views-label-field-listing-duration">Duration</span>
      <div class="field-content">3 years</div>
    </div>
    <div class="views-field views-field-field-scheme-closed">
      <div class="field-content">Current round closes 10 June 2026</div>
    </div>
  </div>
</div>

</div>
</div>
</body>
</html>`;

describe("parseLeverhulmePage", () => {
  it("extracts all schemes from the page", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result).toHaveLength(2);
  });

  it("maps scheme title", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[0].title).toBe("Research Project Grants");
    expect(result[1].title).toBe("Early Career Fellowships");
  });

  it("constructs absolute URL from relative href", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[0].url).toBe("https://www.leverhulme.ac.uk/research-project-grants");
  });

  it("detects closed status from scheme-closed class", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[0].status).toBe("closed");
  });

  it("detects open status from current round text", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[1].status).toBe("open");
  });

  it("extracts deadline for open schemes", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[1].deadlineText).toBe("10 June 2026");
  });

  it("sets deadlineText null for closed schemes", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[0].deadlineText).toBeNull();
  });

  it("extracts value and duration", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[0].value).toBe("£500,000");
    expect(result[0].duration).toBe("Up to 5 years");
  });

  it("extracts description", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[0].description).toBe("Support for original research of recognised excellence.");
  });

  it("throws on empty page with no schemes", () => {
    expect(() => parseLeverhulmePage("<html><body><main></main></body></html>"))
      .toThrow();
  });
});
