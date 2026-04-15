import { parseHeritageFundPage, parseHeritageFundDetailPage } from "../../src/sources/heritage-fund";
import { normaliseHeritageFund } from "../../src/transforms/normalise-heritage-fund";

// Minimal fixture matching real Drupal CMS structure at heritagefund.org.uk
const FIXTURE_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
<div class="view-programmes">
  <div class="views-row">
    <article class="programme is-promoted search-result clearfix">
      <div class="content">
        <div class="search-result__image">
          <p class="image-badge search-result__image-badge"><b>Programme</b></p>
        </div>
        <h2 class="search-result__title">
          <a href="/funding/national-lottery-heritage-grants-10k-250k" rel="bookmark">
            <span>National Lottery Heritage Grants £10,000 to £250,000</span>
          </a>
        </h2>
        <div class="search-result__content">
          <div class="field field--name-body field--type-text-with-summary field--label-hidden field--item">
            Our funding programme for all types of heritage projects in the UK.
          </div>
          <div class="field--type-datetime search-result__date-time"></div>
        </div>
      </div>
    </article>
  </div>

  <div class="views-row">
    <article class="programme is-promoted search-result clearfix">
      <div class="content">
        <div class="search-result__image">
          <p class="image-badge search-result__image-badge"><b>Programme</b></p>
        </div>
        <h2 class="search-result__title">
          <a href="/funding/national-lottery-heritage-grants-250k-10m" rel="bookmark">
            <span>National Lottery Heritage Grants £250,000 to £10million</span>
          </a>
        </h2>
        <div class="search-result__content">
          <div class="field field--name-body field--type-text-with-summary field--label-hidden field--item">
            Our funding programme for larger heritage projects of at least £250,000.
          </div>
          <div class="field--type-datetime search-result__date-time"></div>
        </div>
      </div>
    </article>
  </div>
</div>
</body>
</html>`;

const FIXTURE_DETAIL = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>National Lottery Heritage Grants £10,000 to £250,000</h1>
  <p>The National Lottery Heritage Fund finances initiatives that connect people and communities to the national, regional and local heritage of the UK.</p>
  <p>Projects may address various heritage types including buildings, landscapes, cultures, museums, and community heritage. Eligible activities include volunteer expenses, staff training, and conservation work.</p>
  <h2>Who can apply</h2>
  <p>Not-for-profit organisations, charities, community groups, faith organisations, local authorities, and public sector bodies are eligible to apply.</p>
  <p>Applicants must maintain a bank account, governing document, and at least two unrelated board members.</p>
</main>
</body>
</html>`;

describe("parseHeritageFundDetailPage", () => {
  it("extracts multi-paragraph description", () => {
    const result = parseHeritageFundDetailPage(FIXTURE_DETAIL);
    expect(result.description).not.toBeNull();
    expect(result.description).toContain("National Lottery Heritage Fund");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility from who can apply section", () => {
    const result = parseHeritageFundDetailPage(FIXTURE_DETAIL);
    expect(result.eligibility).not.toBeNull();
    expect(result.eligibility).toContain("Not-for-profit");
  });
});

describe("normaliseHeritageFund", () => {
  it("maps eligibility field", () => {
    const raw = { title: "Grant", url: "https://example.com", description: "desc", eligibility: "Not-for-profit orgs" };
    expect(normaliseHeritageFund(raw).eligibility).toBe("Not-for-profit orgs");
  });

  it("sets eligibility to null when not provided", () => {
    const raw = { title: "Grant", url: "https://example.com", description: "desc", eligibility: null };
    expect(normaliseHeritageFund(raw).eligibility).toBeNull();
  });
});

describe("parseHeritageFundPage", () => {
  it("extracts all programme articles", () => {
    const result = parseHeritageFundPage(FIXTURE_HTML);
    expect(result).toHaveLength(2);
  });

  it("maps programme title from span inside h2 link", () => {
    const result = parseHeritageFundPage(FIXTURE_HTML);
    expect(result[0].title).toBe("National Lottery Heritage Grants £10,000 to £250,000");
    expect(result[1].title).toBe("National Lottery Heritage Grants £250,000 to £10million");
  });

  it("constructs absolute URL from relative href", () => {
    const result = parseHeritageFundPage(FIXTURE_HTML);
    expect(result[0].url).toBe(
      "https://www.heritagefund.org.uk/funding/national-lottery-heritage-grants-10k-250k"
    );
  });

  it("extracts description from body field", () => {
    const result = parseHeritageFundPage(FIXTURE_HTML);
    expect(result[0].description).toBe(
      "Our funding programme for all types of heritage projects in the UK."
    );
  });

  it("throws on page with no programme articles", () => {
    expect(() =>
      parseHeritageFundPage("<html><body><div class='view-programmes'></div></body></html>")
    ).toThrow();
  });
});
