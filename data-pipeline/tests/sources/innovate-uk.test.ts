import { parseInnovateUKPage, extractNextPageUrl } from "../../src/sources/innovate-uk";
import { normaliseInnovateUK } from "../../src/transforms/normalise-innovate-uk";

const FIXTURE_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
<div class="govuk-grid-column-two-thirds">
  <ul class="govuk-list">

    <li>
      <h2 class="govuk-heading-m govuk-!-margin-top-0 govuk-!-margin-bottom-6">
        <a class="govuk-link" href="/competition/2424/overview/abc123">Frontier AI Benchmarking Datasets</a>
      </h2>
      <div class="wysiwyg-styles govuk-!-margin-bottom-4">UK registered organisations can apply for a share of up to £4.5 million to create benchmarks for AI systems.</div>
      <h3 class="govuk-heading-s govuk-!-margin-bottom-0">Eligibility</h3>
      <div class="wysiwyg-styles govuk-!-margin-bottom-4"><div>This competition is open to collaborations only.</div></div>
      <h3 class="govuk-heading-s govuk-!-margin-bottom-0">Opening soon</h3>
      <dl class="date-definition-list govuk-!-margin-top-0">
        <dt>Opens:</dt>
        <dd>21 April 2026</dd>
        <dt>Closes:</dt>
        <dd>27 May 2026</dd>
      </dl>
      <hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible"/>
    </li>

    <li>
      <h2 class="govuk-heading-m govuk-!-margin-top-0 govuk-!-margin-bottom-6">
        <a class="govuk-link" href="/competition/2422/overview/def456">Frontier AI Discovery</a>
      </h2>
      <div class="wysiwyg-styles govuk-!-margin-bottom-4">UK registered organisations can apply for a share of up to £2.5 million to develop feasibility studies for frontier AI and foundation models.</div>
      <h3 class="govuk-heading-s govuk-!-margin-bottom-0">Eligibility</h3>
      <div class="wysiwyg-styles govuk-!-margin-bottom-4"><div>This competition is open to single applicants only.</div></div>
      <h3 class="govuk-heading-s govuk-!-margin-bottom-0">Open now</h3>
      <dl class="date-definition-list govuk-!-margin-top-0">
        <dt>Opened:</dt>
        <dd>14 April 2026</dd>
        <dt>Closes:</dt>
        <dd>10 June 2026</dd>
      </dl>
      <hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible"/>
    </li>

    <li>
      <h2 class="govuk-heading-m govuk-!-margin-top-0 govuk-!-margin-bottom-6">
        <a class="govuk-link" href="/competition/2426/overview/ghi789">Contracts for Innovation: Quantum Networking</a>
      </h2>
      <div class="wysiwyg-styles govuk-!-margin-bottom-4">Organisations can apply for a share of £20 million, inclusive of VAT, to develop quantum networking prototypes.</div>
      <h3 class="govuk-heading-s govuk-!-margin-bottom-0">Eligibility</h3>
      <div class="wysiwyg-styles govuk-!-margin-bottom-4"><div>Open to UK organisations of any size.</div></div>
      <h3 class="govuk-heading-s govuk-!-margin-bottom-0">Open now</h3>
      <dl class="date-definition-list govuk-!-margin-top-0">
        <dt>Opened:</dt>
        <dd>14 April 2026</dd>
        <dt>Closes:</dt>
        <dd>20 May 2026</dd>
      </dl>
      <hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible"/>
    </li>

  </ul>
</div>
<ul class="pagination">
  <li class="next">
    <a class="govuk-link" href="?page=1" rel="next" title="Navigate to next part">
      <span class="pagination-label">Next</span>
      <span class="pagination-part-title">11 to 20</span>
    </a>
  </li>
</ul>
</body>
</html>`;

const NO_PAGINATION_HTML = FIXTURE_HTML.replace(/<ul class="pagination">[\s\S]*?<\/ul>/, "");

describe("parseInnovateUKPage", () => {
  it("extracts all competition listings", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result).toHaveLength(3);
  });

  it("maps title from h2 > a", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result[0].title).toBe("Frontier AI Benchmarking Datasets");
    expect(result[1].title).toBe("Frontier AI Discovery");
    expect(result[2].title).toBe("Contracts for Innovation: Quantum Networking");
  });

  it("constructs absolute URL from relative href", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result[0].url).toBe(
      "https://apply-for-innovation-funding.service.gov.uk/competition/2424/overview/abc123"
    );
  });

  it("detects opening_soon status", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result[0].status).toBe("opening_soon");
  });

  it("detects open status for open now competitions", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result[1].status).toBe("open");
    expect(result[2].status).toBe("open");
  });

  it("extracts close date from Closes: field", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result[0].closeDateRaw).toBe("27 May 2026");
    expect(result[1].closeDateRaw).toBe("10 June 2026");
  });

  it("extracts open date (Opened: for open, Opens: for opening soon)", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result[0].openDateRaw).toBe("21 April 2026");
    expect(result[1].openDateRaw).toBe("14 April 2026");
  });

  it("extracts description from first wysiwyg-styles div", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result[0].description).toContain("£4.5 million");
    expect(result[1].description).toContain("feasibility studies");
  });

  it("extracts amount from description text", () => {
    const result = parseInnovateUKPage(FIXTURE_HTML);
    expect(result[0].amountRaw).not.toBeNull();
    expect(result[2].amountRaw).not.toBeNull();
  });

  it("throws when no competition listings found", () => {
    expect(() =>
      parseInnovateUKPage("<html><body><div></div></body></html>")
    ).toThrow("no competition listings found");
  });
});

describe("extractNextPageUrl", () => {
  it("returns next page URL when pagination present", () => {
    const next = extractNextPageUrl(FIXTURE_HTML);
    expect(next).not.toBeNull();
    expect(next).toContain("page=1");
  });

  it("returns null when no pagination", () => {
    const next = extractNextPageUrl(NO_PAGINATION_HTML);
    expect(next).toBeNull();
  });
});

describe("normaliseInnovateUK", () => {
  it("normalises an open competition with amount and deadline", () => {
    const raw = parseInnovateUKPage(FIXTURE_HTML)[1]; // Frontier AI Discovery
    const result = normaliseInnovateUK(raw);

    expect(result.source).toBe("innovate_uk");
    expect(result.funder_slug).toBe("innovate-uk");
    expect(result.status).toBe("open");
    expect(result.deadline_date).toBe("2026-06-10");
    expect(result.amount_max).toBeGreaterThan(0);
    expect(result.amount_currency).toBe("GBP");
  });

  it("sets amount_max in pence for million-pound grants", () => {
    const raw = parseInnovateUKPage(FIXTURE_HTML)[2]; // £20 million
    const result = normaliseInnovateUK(raw);
    // £20 million = 2_000_000_000 pence
    expect(result.amount_max).toBe(2_000_000_000);
  });
});
