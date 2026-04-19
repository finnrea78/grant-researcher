import { parseRscPage } from "../../src/sources/rsc";
import { normaliseRsc } from "../../src/transforms/normalise-rsc";

const OPEN_SCHEME_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>RSC Research Fund</h1>
  <p>The Research Fund supports RSC members to pursue independent research projects in the chemical sciences. Grants of up to £5,000 are available to fund research activities for up to 12 months.</p>
  <p>Applications are assessed on scientific merit, feasibility, and the applicant's track record.</p>
  <h2>Eligibility</h2>
  <p>Applicants must be Associate, Member, or Fellow members of the RSC and hold an independent research post. The fund is limited to one application per department at any time.</p>
  <h2>Application timelines</h2>
  <p>Round 1 closes 15 June 2026 at 14:00 BST. Decisions notified by early September 2026.</p>
  <h2>What can I request funding for?</h2>
  <p>Eligible costs include chemicals, equipment, consumables, specialist software licences, and equipment repairs not covered by university funds.</p>
  <p>Applications are now open for Round 1 2026.</p>
</main>
</body>
</html>`;

const CLOSED_SCHEME_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>RSC Researcher Collaborations Grants</h1>
  <p>Supports researchers to establish and develop national, international, interdisciplinary and cross-sector collaborations. Awards of up to £5,000 per application.</p>
  <h2>Eligibility</h2>
  <p>Applicants must hold Associate Member (AMRSC), Member (MRSC), or Fellow (FRSC) status and be PhD students or researchers at any career stage in any sector.</p>
  <h2>Application timelines</h2>
  <p>Round 1 applications closed 30 March 2026. Round 2 applications close 21 September 2026.</p>
  <p>Applications are now closed for Round 1.</p>
</main>
</body>
</html>`;

const NO_AMOUNT_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>RSC Accessibility Grants</h1>
  <p>Funding to help chemistry researchers with disabilities or health conditions access professional development opportunities and conferences.</p>
  <p>Applications are now open.</p>
</main>
</body>
</html>`;

const url = "https://www.rsc.org/funding-and-support/funding/research-fund/";

describe("parseRscPage", () => {
  it("extracts title from h1", () => {
    const result = parseRscPage(OPEN_SCHEME_FIXTURE, url, "fallback", "grant");
    expect(result.title).toBe("RSC Research Fund");
  });

  it("falls back to defaultTitle when no h1", () => {
    const html = "<html><body><main><p>Some funding content for chemistry researchers in the UK.</p></main></body></html>";
    const result = parseRscPage(html, url, "My Fallback Title", "grant");
    expect(result.title).toBe("My Fallback Title");
  });

  it("extracts multi-paragraph description", () => {
    const result = parseRscPage(OPEN_SCHEME_FIXTURE, url, "fallback", "grant");
    expect(result.description).toContain("Research Fund");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility under Eligibility heading", () => {
    const result = parseRscPage(OPEN_SCHEME_FIXTURE, url, "fallback", "grant");
    expect(result.eligibility).toContain("Associate, Member, or Fellow");
  });

  it("returns null eligibility when no Eligibility heading", () => {
    const result = parseRscPage(NO_AMOUNT_FIXTURE, url, "fallback", "grant");
    expect(result.eligibility).toBeNull();
  });

  it("extracts amount from 'up to £5,000'", () => {
    const result = parseRscPage(OPEN_SCHEME_FIXTURE, url, "fallback", "grant");
    expect(result.amountRaw).toContain("£5,000");
  });

  it("returns null amountRaw when no £ amount present", () => {
    const result = parseRscPage(NO_AMOUNT_FIXTURE, url, "fallback", "grant");
    expect(result.amountRaw).toBeNull();
  });

  it("extracts deadline date from timeline section", () => {
    const result = parseRscPage(OPEN_SCHEME_FIXTURE, url, "fallback", "grant");
    expect(result.deadlineRaw).toContain("June 2026");
  });

  it("sets status to open when 'Applications are now open'", () => {
    const result = parseRscPage(OPEN_SCHEME_FIXTURE, url, "fallback", "grant");
    expect(result.status).toBe("open");
  });

  it("sets status to closed when no open signal", () => {
    const result = parseRscPage(CLOSED_SCHEME_FIXTURE, url, "fallback", "grant");
    expect(result.status).toBe("closed");
  });

  it("passes fundingType through", () => {
    const result = parseRscPage(OPEN_SCHEME_FIXTURE, url, "fallback", "bursary");
    expect(result.fundingType).toBe("bursary");
  });

  it("sets url from parameter", () => {
    const result = parseRscPage(OPEN_SCHEME_FIXTURE, url, "fallback", "grant");
    expect(result.url).toBe(url);
  });
});

describe("normaliseRsc", () => {
  const raw = {
    title: "RSC Research Fund",
    url,
    fundingType: "grant",
    status: "open",
    description: "Supports RSC members to pursue independent research in the chemical sciences. Grants up to £5,000.",
    eligibility: "Must be Associate, Member, or Fellow of the RSC.",
    amountRaw: "up to £5,000",
    deadlineRaw: "15 June 2026",
  };

  it("sets source to rsc", () => {
    expect(normaliseRsc(raw).source).toBe("rsc");
  });

  it("sets funder_slug to royal-society-of-chemistry", () => {
    expect(normaliseRsc(raw).funder_slug).toBe("royal-society-of-chemistry");
  });

  it("sets funder_name", () => {
    expect(normaliseRsc(raw).funder_name).toBe("Royal Society of Chemistry");
  });

  it("parses amount_max from 'up to £5,000'", () => {
    expect(normaliseRsc(raw).amount_max).toBe(500_000);
  });

  it("sets funding_type from raw", () => {
    expect(normaliseRsc(raw).funding_type).toBe("grant");
  });

  it("sets scope to null", () => {
    expect(normaliseRsc(raw).scope).toBeNull();
  });

  it("passes eligibility through", () => {
    expect(normaliseRsc(raw).eligibility).toContain("RSC");
  });

  it("passes description through", () => {
    expect(normaliseRsc(raw).description).toContain("chemical sciences");
  });

  it("generates a slug", () => {
    expect(normaliseRsc(raw).slug).toBe("rsc-research-fund");
  });

  it("parses deadline_date from '15 June 2026'", () => {
    expect(normaliseRsc(raw).deadline_date).toBe("2026-06-15");
  });

  it("sets status from raw", () => {
    expect(normaliseRsc(raw).status).toBe("open");
  });
});
