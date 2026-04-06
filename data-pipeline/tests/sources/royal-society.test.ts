import { parseRoyalSocietyPage } from "../../src/sources/royal-society";

// Fixture based on Royal Society's actual card structure
const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<body>
<div class="container">
  <div class="grant-search-results">
    <div class="grant-search-result">
      <a href="/grants/apex-awards/" class="grant-search-result__link">
        <div class="grant-search-result__content">
          <h4 class="grant-search-result__title">APEX Awards</h4>
          <p class="grant-search-result__description">Awards for excellent scientists to pursue novel interdisciplinary research.</p>
          <span class="grant-search-result__status">Opening 05 August 2026</span>
        </div>
      </a>
    </div>
    <div class="grant-search-result">
      <a href="/grants/research-grants/" class="grant-search-result__link">
        <div class="grant-search-result__content">
          <h4 class="grant-search-result__title">Research Grants</h4>
          <p class="grant-search-result__description">Support for early-stage innovative research.</p>
          <span class="grant-search-result__status">Closed</span>
        </div>
      </a>
    </div>
    <div class="grant-search-result">
      <a href="/grants/newton-international-fellowships/" class="grant-search-result__link">
        <div class="grant-search-result__content">
          <h4 class="grant-search-result__title">Newton International Fellowships</h4>
          <p class="grant-search-result__description">Bringing researchers to the UK.</p>
          <span class="grant-search-result__status">Closed</span>
        </div>
      </a>
    </div>
  </div>
  <div class="grant-search__count">You've viewed 3 of 28 grants</div>
</div>
</body>
</html>`;

describe("parseRoyalSocietyPage", () => {
  it("extracts grant schemes from listing page", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes).toHaveLength(3);
  });

  it("maps grant titles", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[0].title).toBe("APEX Awards");
    expect(result.schemes[1].title).toBe("Research Grants");
  });

  it("constructs absolute URLs", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[0].url).toBe("https://royalsociety.org/grants/apex-awards/");
  });

  it("detects open status from 'Opening' badge", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[0].status).toBe("open");
  });

  it("detects closed status", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[1].status).toBe("closed");
  });

  it("extracts deadline date from Opening badge", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[0].deadlineText).toBe("05 August 2026");
  });

  it("sets deadlineText to null for closed schemes", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[1].deadlineText).toBeNull();
  });

  it("extracts description", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[0].description).toBe("Awards for excellent scientists to pursue novel interdisciplinary research.");
  });

  it("reports total count from page text", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.totalCount).toBe(28);
  });

  it("throws when no grant cards found", () => {
    expect(() => parseRoyalSocietyPage("<html><body><div></div></body></html>"))
      .toThrow();
  });
});
