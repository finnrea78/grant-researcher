import { parseLeverhulmePage } from "../../src/sources/leverhulme";

// Minimal fixture based on Leverhulme's Drupal HTML structure (schemes-at-a-glance page)
const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<body>
<main>
<div class="view-content">

<div class="views-row">
  <h3 class="scheme-title"><a href="/research-project-grants">Research Project Grants</a></h3>
  <div class="field--name-field-scheme-description">
    <p>Support for original research of recognised excellence.</p>
  </div>
  <div class="field--name-field-scheme-status">
    <span class="scheme-status--closed">Currently closed</span>
  </div>
  <div class="field--name-field-scheme-value">£500,000</div>
  <div class="field--name-field-scheme-duration">Up to 5 years</div>
  <div class="field--name-field-next-opening">
    Next opening: 1 January 2027
  </div>
</div>

<div class="views-row">
  <h3 class="scheme-title"><a href="/early-career-fellowships">Early Career Fellowships</a></h3>
  <div class="field--name-field-scheme-description">
    <p>Funding for those at the start of their career.</p>
  </div>
  <div class="field--name-field-scheme-status">
    <span class="scheme-status--open">Current round closes 10 June 2026</span>
  </div>
  <div class="field--name-field-scheme-value">£130,000</div>
  <div class="field--name-field-scheme-duration">3 years</div>
</div>

</div>
</main>
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

  it("detects closed status", () => {
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

  it("extracts next opening text for closed schemes", () => {
    const result = parseLeverhulmePage(FIXTURE_HTML);
    expect(result[0].nextOpeningText).toBe("1 January 2027");
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
