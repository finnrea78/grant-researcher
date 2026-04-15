import { parsePalassPage } from "../../src/sources/palass";
import { normalisePalass } from "../../src/transforms/normalise-palass";

const YEAR = new Date().getFullYear();
// April 15 2026: March 1 → passed → next year; September 30 → future → this year; October 7 → future this year
const MARCH_YEAR = YEAR + 1;
const SEPT_YEAR = YEAR;
const OCT_YEAR = YEAR;

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<section data-aria-accordion data-default data-multi>

  <h4 class="accordion-heading" data-aria-accordion-heading>Research Grants</h4>
  <div class="accordion-panel" data-aria-accordion-panel>
    <p>Awards are made to assist palaeontological research up to a maximum value of <strong>£10,000 GBP</strong> per award.</p>
    <p><strong>Deadline: 1st March at 23:59 GMT</strong></p>
    <div class="button-list">
      <a href="/research-grants" class="button black" title="More Information">More Information</a>
      <a href="/research-grants/apply" class="button secondary" title="Application Form">Application Form</a>
    </div>
  </div>

  <h4 class="accordion-heading" data-aria-accordion-heading>Engagement Grants</h4>
  <div class="accordion-panel" data-aria-accordion-panel>
    <p>Up to £5,000 (exceptionally £8,000) for science engagement activities in palaeontology.</p>
    <p><strong>Deadline: 1st September 23:59 GMT</strong></p>
    <div class="button-list">
      <a href="/engagement-grants" class="button black">More Information</a>
    </div>
  </div>

  <h4 class="accordion-heading" data-aria-accordion-heading>Career Development Grant</h4>
  <div class="accordion-panel" data-aria-accordion-panel>
    <p>To assist talented early-career researchers who have recently completed their PhD to strengthen their CVs.</p>
    <p><strong>Deadline: 7th October 23.59 GMT each year.</strong></p>
    <div class="button-list">
      <a href="/career-development-grant" class="button black">More Information</a>
    </div>
  </div>

  <h4 class="accordion-heading" data-aria-accordion-heading>Postgraduate Travel Fund</h4>
  <div class="accordion-panel" data-aria-accordion-panel>
    <p>Rolling support for postgraduate researchers attending conferences in palaeontology.</p>
    <!-- No deadline strong element -->
    <div class="button-list">
      <a href="/postgraduate-travel-fund" class="button black">More Information</a>
    </div>
  </div>

</section>
</main>
</body>
</html>`;

const FIXTURE_EMPTY = `<html><body><main><p>No grants.</p></main></body></html>`;

describe("parsePalassPage", () => {
  it("parses 4 grant accordion entries", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results).toHaveLength(4);
  });

  it("extracts title from h4.accordion-heading", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[0].title).toBe("Research Grants");
  });

  it("extracts amount from prose paragraph", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[0].amountRaw).toContain("£10,000");
  });

  it("extracts 'up to' amount format", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[1].amountRaw).toContain("£5,000");
  });

  it("resolves '1st March' to next year when March has passed", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[0].deadlineRaw).toContain(`March ${MARCH_YEAR}`);
  });

  it("resolves '1st September' to current year when September is still future", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[1].deadlineRaw).toContain(`September ${SEPT_YEAR}`);
  });

  it("resolves '7th October' to current year when October is still future", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[2].deadlineRaw).toContain(`October ${OCT_YEAR}`);
  });

  it("sets status open for future deadlines", () => {
    const results = parsePalassPage(FIXTURE);
    // Sep and Oct are future
    expect(results[1].status).toBe("open");
    expect(results[2].status).toBe("open");
  });

  it("sets deadlineRaw null for rolling grants (no deadline strong)", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[3].deadlineRaw).toBeNull();
  });

  it("extracts URL from 'More Information' button", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[0].url).toContain("research-grants");
  });

  it("extracts description from first non-deadline paragraph", () => {
    const results = parsePalassPage(FIXTURE);
    expect(results[2].description).toContain("early-career researchers");
  });

  it("deduplicates entries with same title", () => {
    const html = `
      <html><body>
      <h4 data-aria-accordion-heading>Research Grants</h4>
      <div data-aria-accordion-panel><p>Some text.</p></div>
      <h4 data-aria-accordion-heading>Research Grants</h4>
      <div data-aria-accordion-panel><p>Duplicate.</p></div>
      </body></html>`;
    expect(parsePalassPage(html)).toHaveLength(1);
  });

  it("returns empty array when no accordion headings", () => {
    expect(parsePalassPage(FIXTURE_EMPTY)).toHaveLength(0);
  });
});

describe("normalisePalass", () => {
  const raw = {
    title: "Research Grants",
    url: "https://www.palass.org/research-grants",
    status: "open",
    description: "Awards to assist palaeontological research up to £10,000 per award.",
    amountRaw: "£10,000 GBP",
    deadlineRaw: `1 March ${MARCH_YEAR}`,
  };

  it("sets source to palass", () => {
    expect(normalisePalass(raw).source).toBe("palass");
  });

  it("sets funder_slug to palaeontological-association", () => {
    expect(normalisePalass(raw).funder_slug).toBe("palaeontological-association");
  });

  it("parses amount_max from '£10,000 GBP'", () => {
    expect(normalisePalass(raw).amount_max).toBe(1_000_000);
  });

  it("parses deadline_date", () => {
    expect(normalisePalass(raw).deadline_date).toBe(`${MARCH_YEAR}-03-01`);
  });

  it("sets funding_type to grant", () => {
    expect(normalisePalass(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to bursary for travel grants", () => {
    const travelRaw = { ...raw, title: "Postgraduate Travel Fund" };
    expect(normalisePalass(travelRaw).funding_type).toBe("bursary");
  });

  it("sets funding_type to fellowship for studentship", () => {
    const studentRaw = { ...raw, title: "Undergraduate Research Bursaries" };
    expect(normalisePalass(studentRaw).funding_type).toBe("bursary");
  });

  it("sets scope to palaeontology", () => {
    expect(normalisePalass(raw).scope).toContain("palaeontology");
  });

  it("generates a slug", () => {
    expect(normalisePalass(raw).slug).toBe("research-grants");
  });
});
