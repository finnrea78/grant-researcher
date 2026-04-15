import { parseClassicalAssocPage } from "../../src/sources/classical-association";
import { normaliseClassicalAssoc } from "../../src/transforms/normalise-classical-association";

// Simulate the rendered HTML returned by the WP REST API
const PAGE_FIXTURE = `
<div class="wp-block-group">
  <h1 class="wp-block-heading">Grants</h1>
  <p>Applications for sums up to a maximum of £4,999 should be submitted for the consideration of the Small Grants Committee ahead of the following deadlines: 1 March, 1 June, 1 September, 1 December.</p>
  <p>Applications for major grants of £5,000 and over are considered twice a year, following the 1 March and 1 September deadlines.</p>
  <p><strong>Please note that applications should demonstrate a clear and strong link to the study of and/or engagement with Ancient Greece and Rome.</strong></p>
</div>`;

describe("parseClassicalAssocPage", () => {
  it("returns two grant entries", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    expect(results).toHaveLength(2);
  });

  it("names the small grant correctly", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    expect(results[0].title).toBe("Classical Association Small Grant");
  });

  it("names the major grant correctly", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    expect(results[1].title).toBe("Classical Association Major Grant");
  });

  it("sets status open for both grants", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    expect(results[0].status).toBe("open");
    expect(results[1].status).toBe("open");
  });

  it("extracts small grant amountRaw containing £4,999", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    expect(results[0].amountRaw).toContain("£4,999");
  });

  it("sets major grant amountRaw to £5,000 and over", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    expect(results[1].amountRaw).toContain("£5,000");
  });

  it("resolves small grant deadline to a future date", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    expect(results[0].deadlineRaw).not.toBeNull();
    const d = new Date(results[0].deadlineRaw!);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });

  it("resolves major grant deadline to a future date", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    expect(results[1].deadlineRaw).not.toBeNull();
    const d = new Date(results[1].deadlineRaw!);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });

  it("small grant deadline is one of the quarterly dates", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    const deadline = results[0].deadlineRaw!;
    expect(deadline).toMatch(/(?:March|June|September|December)/);
  });

  it("major grant deadline is one of March or September", () => {
    const results = parseClassicalAssocPage(PAGE_FIXTURE);
    const deadline = results[1].deadlineRaw!;
    expect(deadline).toMatch(/(?:March|September)/);
  });
});

describe("normaliseClassicalAssoc", () => {
  const rawSmall = {
    title: "Classical Association Small Grant",
    url: "https://www.classicalassociation.org/grants.html",
    status: "open",
    description: "Grants of up to £4,999 for classical projects.",
    amountRaw: "up to a maximum of £4,999",
    deadlineRaw: "1 June 2026",
  };

  const rawMajor = {
    title: "Classical Association Major Grant",
    url: "https://www.classicalassociation.org/grants.html",
    status: "open",
    description: "Major grants of £5,000 and over.",
    amountRaw: "£5,000 and over",
    deadlineRaw: "1 September 2026",
  };

  it("sets source to classical_association", () => {
    expect(normaliseClassicalAssoc(rawSmall).source).toBe("classical_association");
  });

  it("sets funder_slug to classical-association", () => {
    expect(normaliseClassicalAssoc(rawSmall).funder_slug).toBe("classical-association");
  });

  it("sets funder_name", () => {
    expect(normaliseClassicalAssoc(rawSmall).funder_name).toBe("The Classical Association");
  });

  it("parses amount_max for small grant", () => {
    expect(normaliseClassicalAssoc(rawSmall).amount_max).toBe(499_900);
  });

  it("parses amount_min for major grant (5000 = 500000 pence)", () => {
    expect(normaliseClassicalAssoc(rawMajor).amount_min).toBe(500_000);
  });

  it("amount_max is null for major grant (open-ended)", () => {
    expect(normaliseClassicalAssoc(rawMajor).amount_max).toBeNull();
  });

  it("sets funding_type to grant", () => {
    expect(normaliseClassicalAssoc(rawSmall).funding_type).toBe("grant");
  });

  it("sets scope to classics", () => {
    expect(normaliseClassicalAssoc(rawSmall).scope).toContain("classics");
  });

  it("sets eligibility", () => {
    expect(normaliseClassicalAssoc(rawSmall).eligibility).toBeTruthy();
  });

  it("generates slug for small grant", () => {
    expect(normaliseClassicalAssoc(rawSmall).slug).toBe("classical-association-small-grant");
  });

  it("generates slug for major grant", () => {
    expect(normaliseClassicalAssoc(rawMajor).slug).toBe("classical-association-major-grant");
  });

  it("parses deadline_date", () => {
    expect(normaliseClassicalAssoc(rawSmall).deadline_date).toBe("2026-06-01");
  });
});
