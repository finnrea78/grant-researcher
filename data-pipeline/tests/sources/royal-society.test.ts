import { parseRoyalSocietyPage } from "../../src/sources/royal-society";

// Fixture matches real Royal Society card HTML structure
const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<body>
<div class="container">
  <article class="card card--grant">
    <a class="card__link" href="/grants/apex-awards/">
      <div class="card__text">
        <h4 class="card__title">APEX Awards</h4>
        <div class="card__desc"><p>Awards for excellent scientists to pursue novel interdisciplinary research.</p></div>
        <div class="card__meta">
          <div><strong>Opening 05 August 2026</strong></div>
        </div>
      </div>
      <span class="card__tag category-tag">Closed </span>
    </a>
  </article>
  <article class="card card--grant">
    <a class="card__link" href="/grants/research-grants/">
      <div class="card__text">
        <h4 class="card__title">Research Grants</h4>
        <div class="card__desc"><p>Support for early-stage innovative research.</p></div>
        <div class="card__meta">
          <div><strong></strong></div>
        </div>
      </div>
      <span class="card__tag category-tag">Closed </span>
    </a>
  </article>
  <article class="card card--grant">
    <a class="card__link" href="/grants/newton-international/">
      <div class="card__text">
        <h4 class="card__title">Newton International Fellowships</h4>
        <div class="card__desc"><p>Bringing researchers to the UK.</p></div>
        <div class="card__meta">
          <div><strong></strong></div>
        </div>
      </div>
      <span class="card__tag category-tag">Open </span>
    </a>
  </article>
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

  it("detects open status from card__tag badge", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[2].status).toBe("open");
  });

  it("detects closed status from card__tag badge", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[1].status).toBe("closed");
  });

  it("extracts next opening date from card__meta strong", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[0].deadlineText).toBe("05 August 2026");
  });

  it("sets deadlineText to null when card__meta is empty", () => {
    const result = parseRoyalSocietyPage(FIXTURE_HTML);
    expect(result.schemes[1].deadlineText).toBeNull();
  });

  it("extracts description from card__desc", () => {
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
