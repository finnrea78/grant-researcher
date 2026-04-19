import { parseNatgeoListingPage, parseNatgeoDetailPage } from "../../src/sources/natgeo";
import { normaliseNatgeo } from "../../src/transforms/normalise-natgeo";

// Fixture: listing page with 2 grants
const LISTING_HTML = `<!DOCTYPE html>
<html>
<body>
<main>
  <h3>Illuminating Climate Solutions</h3>
  <h5>Submission Deadline: May 25, 2026 at 11:59 PM EDT</h5>
  <p>National Geographic and The Climate Pledge seek stories about climate resilience solutions globally.</p>
  <a href="/society/grants-and-investments/rfp-the-climate-pledge/">Apply Now</a>

  <h3>Preserving Traditional Arts</h3>
  <h5>Submission Deadline: June 4, 2026 at 11:59 PM EDT</h5>
  <p>Supporting traditional artists and heritage practitioners in preserving cultural heritage.</p>
  <a href="/society/grants-and-investments/rfp-preserving-traditional-arts/">Apply Now</a>

  <h3>Old Closed Grant</h3>
  <h5>Submission Deadline: January 10, 2025 at 11:59 PM EDT</h5>
  <p>A past grant opportunity that has already closed.</p>
  <a href="/society/grants-and-investments/rfp-old/">Apply Now</a>
</main>
</body>
</html>`;

// Fixture: detail page
const DETAIL_HTML = `<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Illuminating Climate Solutions</h1>
  <p>Submission Deadline: <strong>May 25, 2026 at 11:59 PM EDT</strong></p>
  <p>National Geographic Society and The Climate Pledge seek authentic storytelling projects
     that highlight climate resilience solutions globally. We prioritize human narratives that
     evoke emotion and inspire action over statistics-only approaches.</p>
  <p>Priority focus areas include energy transition, nature-based solutions, built systems,
     and adaptation strategies for extreme weather events.</p>
  <h3>Eligibility Criteria</h3>
  <p>Applicants must have local experience or established community relationships in the
     story location. A portfolio of successful media projects is required.</p>
  <p>Project lead must write the application. One proposal per person.</p>
  <h3>Funding Details</h3>
  <p>Grants of up to $100,000 are available. Applicants with 5 or fewer years of
     professional experience are recommended to request a maximum of $20,000.</p>
  <a href="https://funding.nationalgeographic.org/apply">Apply Here</a>
</main>
</body>
</html>`;

// Fixture: detail page with no eligibility section
const DETAIL_NO_ELIGIBILITY = `<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Simple Grant</h1>
  <p>A straightforward grant for conservation projects with funding up to $50,000.</p>
</main>
</body>
</html>`;

describe("parseNatgeoListingPage", () => {
  it("parses two grants from listing page", () => {
    const grants = parseNatgeoListingPage(LISTING_HTML);
    expect(grants.length).toBe(3);
  });

  it("extracts grant title from h3", () => {
    const grants = parseNatgeoListingPage(LISTING_HTML);
    expect(grants[0].title).toBe("Illuminating Climate Solutions");
  });

  it("extracts deadline from h5 with 'Submission Deadline:' prefix", () => {
    const grants = parseNatgeoListingPage(LISTING_HTML);
    expect(grants[0].deadlineRaw).toContain("May 25, 2026");
  });

  it("extracts description from p element", () => {
    const grants = parseNatgeoListingPage(LISTING_HTML);
    expect(grants[0].description).toContain("climate resilience");
  });

  it("extracts absolute URL from Apply link", () => {
    const grants = parseNatgeoListingPage(LISTING_HTML);
    expect(grants[0].url).toContain("rfp-the-climate-pledge");
    expect(grants[0].url).toMatch(/^https?:\/\//);
  });

  it("sets fundingType to grant", () => {
    const grants = parseNatgeoListingPage(LISTING_HTML);
    expect(grants[0].fundingType).toBe("grant");
  });
});

describe("parseNatgeoDetailPage", () => {
  it("extracts multi-paragraph description from main content", () => {
    const result = parseNatgeoDetailPage(DETAIL_HTML);
    expect(result.description).toContain("authentic storytelling");
    expect(result.description).toContain("energy transition");
  });

  it("extracts eligibility from Eligibility Criteria section", () => {
    const result = parseNatgeoDetailPage(DETAIL_HTML);
    expect(result.eligibility).toContain("portfolio");
  });

  it("extracts USD amount from body text", () => {
    const result = parseNatgeoDetailPage(DETAIL_HTML);
    expect(result.amountRaw).toContain("100,000");
  });

  it("extracts deadline from strong tag", () => {
    const result = parseNatgeoDetailPage(DETAIL_HTML);
    expect(result.deadlineRaw).toContain("2026");
  });

  it("returns null eligibility when section absent", () => {
    const result = parseNatgeoDetailPage(DETAIL_NO_ELIGIBILITY);
    expect(result.eligibility).toBeNull();
  });

  it("still returns description when no eligibility", () => {
    const result = parseNatgeoDetailPage(DETAIL_NO_ELIGIBILITY);
    expect(result.description).toContain("conservation");
  });
});

describe("normaliseNatgeo", () => {
  const raw = {
    title: "Illuminating Climate Solutions",
    url: "https://www.nationalgeographic.org/society/grants-and-investments/rfp-the-climate-pledge/",
    deadlineRaw: "May 25, 2026 at 11:59 PM EDT",
    description: "Climate resilience stories.",
    eligibility: "Must have portfolio.",
    amountRaw: "$100,000",
    fundingType: "grant",
  };

  it("sets funder_slug to national-geographic-society", () => {
    expect(normaliseNatgeo(raw).funder_slug).toBe("national-geographic-society");
  });

  it("sets source to natgeo", () => {
    expect(normaliseNatgeo(raw).source).toBe("natgeo");
  });

  it("strips timezone from deadline and parses date", () => {
    const result = normaliseNatgeo(raw);
    expect(result.deadline_raw).toBe("May 25, 2026 at 11:59 PM EDT");
    expect(result.deadline_date).toBe("2026-05-25");
  });

  it("parses USD amount", () => {
    const result = normaliseNatgeo(raw);
    // Amounts stored in cents: $100,000 = 10,000,000 cents
    expect(result.amount_max).toBe(10_000_000);
    expect(result.amount_currency).toBe("USD");
  });

  it("sets status to open for future deadline", () => {
    expect(normaliseNatgeo(raw).status).toBe("open");
  });

  it("sets status to closed for past deadline", () => {
    const closed = { ...raw, deadlineRaw: "January 10, 2025 at 11:59 PM EDT" };
    expect(normaliseNatgeo(closed).status).toBe("closed");
  });

  it("sets scope to null", () => {
    expect(normaliseNatgeo(raw).scope).toBeNull();
  });

  it("generates slug from title", () => {
    expect(normaliseNatgeo(raw).slug).toBe("illuminating-climate-solutions");
  });

  it("sets funding_type to grant", () => {
    expect(normaliseNatgeo(raw).funding_type).toBe("grant");
  });
});
