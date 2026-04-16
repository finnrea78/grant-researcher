import { parseCarnegieTrustPage, parseCarnegieTrustDetailPage } from "../../src/sources/carnegie-trust";

// Minimal fixture matching real Carnegie Trust WordPress HTML structure
const FIXTURE_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
<div class="grant-programmes-grid">

  <a href="/award-schemes/undergraduate-tuition-fee-grants/" target="" class="card-preview">
    <div class="card-preview_image-wrapper">
      <img src="/img/undergrads.jpg" alt="Undergraduates" class="card-preview_image">
    </div>
    <div class="card-preview_content">
      <div class="card-preview_title-wrapper">
        <h2 class="h4 fw-normal mb-0">Undergraduate Tuition Fee Grants</h2>
      </div>
      <div class="text-body">
        The foundation of our grant schemes is our Undergraduate Tuition Fee Grants which provide
        funding for individuals from low-income households who want to study for a first degree.
      </div>
      <div class="card-preview_link">Learn More</div>
    </div>
  </a>

  <a href="/award-schemes/vacation-scholarships/" target="" class="card-preview">
    <div class="card-preview_image-wrapper">
      <img src="/img/library.jpg" alt="Library" class="card-preview_image">
    </div>
    <div class="card-preview_content">
      <div class="card-preview_title-wrapper">
        <h2 class="h4 fw-normal mb-0">Vacation Scholarships</h2>
      </div>
      <div class="text-body">
        We are offering Vacation Scholarships which encourage undergraduate students to develop
        their research skills by undertaking a short research project in the summer vacation.
      </div>
      <div class="card-preview_link">Learn More</div>
    </div>
  </a>

  <a href="/award-schemes/research-incentive-grants/" target="" class="card-preview">
    <div class="card-preview_image-wrapper">
      <img src="/img/research.jpg" alt="Research" class="card-preview_image">
    </div>
    <div class="card-preview_content">
      <div class="card-preview_title-wrapper">
        <h2 class="h4 fw-normal mb-0">Research Incentive Grants</h2>
      </div>
      <div class="text-body">
        The Trust has offered support to Early Career researchers.

        This scheme is currently closed to new applicants whilst we review our grant programmes.
      </div>
      <div class="card-preview_link">Learn More</div>
    </div>
  </a>

</div>
</body>
</html>`;

const DETAIL_FIXTURE = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Undergraduate Tuition Fee Grants</h1>
  <p>The Carnegie Trust provides grants to support undergraduate students from Scotland.</p>
  <p>Funding is available for those studying for a first undergraduate degree at a Scottish university.</p>
  <h3>Eligibility</h3>
  <p>Applicants must be domiciled in Scotland and studying at a Scottish university.</p>
  <p>Household income must be below the threshold set by Student Awards Agency Scotland.</p>
</main>
</body>
</html>`;

describe("parseCarnegieTrustPage", () => {
  it("extracts all scheme cards", () => {
    const result = parseCarnegieTrustPage(FIXTURE_HTML);
    expect(result).toHaveLength(3);
  });

  it("maps scheme title from h2 inside card", () => {
    const result = parseCarnegieTrustPage(FIXTURE_HTML);
    expect(result[0].title).toBe("Undergraduate Tuition Fee Grants");
    expect(result[1].title).toBe("Vacation Scholarships");
    expect(result[2].title).toBe("Research Incentive Grants");
  });

  it("constructs absolute URL from relative href", () => {
    const result = parseCarnegieTrustPage(FIXTURE_HTML);
    expect(result[0].url).toBe(
      "https://carnegie-trust.org/award-schemes/undergraduate-tuition-fee-grants/"
    );
  });

  it("detects open status for schemes without closed indicator", () => {
    const result = parseCarnegieTrustPage(FIXTURE_HTML);
    expect(result[0].status).toBe("open");
    expect(result[1].status).toBe("open");
  });

  it("detects closed status from 'currently closed' text", () => {
    const result = parseCarnegieTrustPage(FIXTURE_HTML);
    expect(result[2].status).toBe("closed");
  });

  it("extracts description from text-body", () => {
    const result = parseCarnegieTrustPage(FIXTURE_HTML);
    expect(result[0].description).toContain("Undergraduate Tuition Fee Grants");
    expect(result[0].description).toContain("low-income households");
  });

  it("sets eligibility to null (populated by detail fetch)", () => {
    const result = parseCarnegieTrustPage(FIXTURE_HTML);
    expect(result[0].eligibility).toBeNull();
  });

  it("throws on page with no card-preview elements", () => {
    expect(() =>
      parseCarnegieTrustPage("<html><body><main></main></body></html>")
    ).toThrow();
  });
});

describe("parseCarnegieTrustDetailPage", () => {
  it("extracts multi-paragraph description from main content", () => {
    const result = parseCarnegieTrustDetailPage(DETAIL_FIXTURE);
    expect(result.description).toContain("Carnegie Trust");
    expect(result.description).toContain("first undergraduate degree");
  });

  it("extracts eligibility from Eligibility heading section", () => {
    const result = parseCarnegieTrustDetailPage(DETAIL_FIXTURE);
    expect(result.eligibility).toContain("domiciled in Scotland");
  });

  it("returns null eligibility when no eligibility heading found", () => {
    const result = parseCarnegieTrustDetailPage("<html><body><main><p>Some content about the scheme.</p></main></body></html>");
    expect(result.eligibility).toBeNull();
  });
});
