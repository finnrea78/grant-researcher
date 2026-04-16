import { parseHIASPage } from "../../src/sources/hias-hamburg";
import { normaliseHIAS } from "../../src/transforms/normalise-hias-hamburg";
import type { RawHIASScheme } from "../../src/transforms/normalise-hias-hamburg";

const OPEN_SCHEME_HTML = `
<div class="wp-block-pb-accordion-item Accordion__item">
  <h3 class="Accordion__title">HIAS Fellowships 2027-2028</h3>
  <div class="Accordion__content">
    <p>HIAS offers residential fellowships for scholars from all disciplines to pursue their own research projects in Hamburg.</p>
    <p>The fellowship includes a monthly stipend, workspace in Hamburg city centre, and regular academic events.</p>
    <p>Eligibility: Postdoctoral researchers of all nationalities; preference for early-career researchers. PhD required.</p>
    <p>Deadline: 15 October 2026</p>
    <a href="https://hias-hamburg.de/en/fellowship/application/hias-fellowships-2027-2028/">Apply here</a>
  </div>
</div>
`;

const CLOSED_SCHEME_HTML = `
<div class="wp-block-pb-accordion-item Accordion__item">
  <h3 class="Accordion__title">HIAS Sabbatical Fellowships 2026-2027</h3>
  <div class="Accordion__content">
    <p>Applications for this call are paused until further notice.</p>
  </div>
</div>
`;

const MULTI_SCHEME_HTML = `
<div>
  ${OPEN_SCHEME_HTML}
  ${CLOSED_SCHEME_HTML}
  <div class="wp-block-pb-accordion-item Accordion__item">
    <h3 class="Accordion__title">CALAS-HIAS Fellowship Hamburg/Bielefeld 2027</h3>
    <div class="Accordion__content">
      <p>Joint fellowship programme between CALAS and HIAS.</p>
      <p>Deadline: 1 December 2026</p>
    </div>
  </div>
</div>
`;

describe("parseHIASPage", () => {
  it("extracts title from Accordion__title", () => {
    const schemes = parseHIASPage(OPEN_SCHEME_HTML);
    expect(schemes).toHaveLength(1);
    expect(schemes[0].title).toBe("HIAS Fellowships 2027-2028");
  });

  it("detects open status when no closed indicators", () => {
    const schemes = parseHIASPage(OPEN_SCHEME_HTML);
    expect(schemes[0].status).toBe("open");
  });

  it("detects closed status for paused until further notice", () => {
    const schemes = parseHIASPage(CLOSED_SCHEME_HTML);
    expect(schemes[0].status).toBe("closed");
  });

  it("extracts deadline from content", () => {
    const schemes = parseHIASPage(OPEN_SCHEME_HTML);
    expect(schemes[0].deadlineRaw).toMatch(/15 October 2026/);
  });

  it("extracts multi-paragraph description", () => {
    const schemes = parseHIASPage(OPEN_SCHEME_HTML);
    expect(schemes[0].description).toContain("residential fellowships");
    expect(schemes[0].description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility from Eligibility: label", () => {
    const schemes = parseHIASPage(OPEN_SCHEME_HTML);
    expect(schemes[0].eligibility).not.toBeNull();
    expect(schemes[0].eligibility).toContain("Postdoctoral");
  });

  it("uses external link as URL when present", () => {
    const schemes = parseHIASPage(OPEN_SCHEME_HTML);
    expect(schemes[0].url).toContain("hias-fellowships-2027-2028");
  });

  it("parses multiple schemes", () => {
    const schemes = parseHIASPage(MULTI_SCHEME_HTML);
    expect(schemes).toHaveLength(3);
  });

  it("throws if no accordion items found", () => {
    expect(() => parseHIASPage("<html><body><p>No content</p></body></html>")).toThrow(
      "HIAS Hamburg: no accordion items found"
    );
  });
});

describe("normaliseHIAS", () => {
  const SAMPLE_RAW: RawHIASScheme = {
    title: "HIAS Fellowships 2027-2028",
    url: "https://hias-hamburg.de/en/fellowship/application/",
    status: "open",
    deadlineRaw: "15 October 2026",
    description: "HIAS offers residential fellowships for scholars from all disciplines.",
    eligibility: "Postdoctoral researchers of all nationalities.",
  };

  it("maps funder fields correctly", () => {
    const result = normaliseHIAS(SAMPLE_RAW);
    expect(result.funder_slug).toBe("hias-hamburg");
    expect(result.funder_name).toBe("Hamburg Institute for Advanced Study");
  });

  it("maps title, slug, and URL", () => {
    const result = normaliseHIAS(SAMPLE_RAW);
    expect(result.name).toBe("HIAS Fellowships 2027-2028");
    expect(result.slug).toMatch(/hias/);
    expect(result.url).toContain("hias-hamburg.de");
  });

  it("sets source to hias_hamburg", () => {
    const result = normaliseHIAS(SAMPLE_RAW);
    expect(result.source).toBe("hias_hamburg");
  });

  it("sets currency to EUR", () => {
    const result = normaliseHIAS(SAMPLE_RAW);
    expect(result.amount_currency).toBe("EUR");
  });

  it("sets funding_type to fellowship", () => {
    const result = normaliseHIAS(SAMPLE_RAW);
    expect(result.funding_type).toBe("fellowship");
  });

  it("passes deadline_raw through", () => {
    const result = normaliseHIAS(SAMPLE_RAW);
    expect(result.deadline_raw).toBe("15 October 2026");
  });

  it("maps description", () => {
    const result = normaliseHIAS(SAMPLE_RAW);
    expect(result.description).toContain("residential fellowships");
  });

  it("handles null deadline gracefully", () => {
    const result = normaliseHIAS({ ...SAMPLE_RAW, deadlineRaw: null });
    expect(result.deadline_raw).toBeNull();
    expect(result.deadline_date).toBeNull();
  });

  it("maps eligibility field", () => {
    const result = normaliseHIAS(SAMPLE_RAW);
    expect(result.eligibility).toContain("Postdoctoral");
  });
});
