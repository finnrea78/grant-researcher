import { parseHeritageFundPage } from "../../src/sources/heritage-fund";

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
