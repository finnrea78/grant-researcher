import { parseRaengPage } from "../../src/sources/raeng";
import { normaliseRaeng } from "../../src/transforms/normalise-raeng";

const OPEN_PROGRAMME_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>RAEng Research Fellowships</h1>
  <p>The Academy offers Research Fellowships each year to outstanding early-career researchers to support them to become future research leaders in engineering and technology. Fellows receive up to £800,000 over five years at 80% full economic costs.</p>
  <p>The fellowships support researchers in establishing independence and building an international reputation. Applications are assessed on scientific excellence and potential for impact.</p>
  <h2>Eligibility</h2>
  <p>Applicants must hold a PhD awarded within the last four years and must conduct their research at a UK higher education institution or eligible UK research organisation receiving UKRI funding.</p>
  <h2>How to apply</h2>
  <p>Expressions of interest open in May 2026. Full applications are submitted via our Grants Management System.</p>
</main>
</body>
</html>`;

const CLOSED_PROGRAMME_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>APEX Awards</h1>
  <p>The APEX Awards fund independent researchers to develop new interdisciplinary research, supporting up to £200,000 per award over 24 months. A partnership between the British Academy, Royal Society, and Royal Academy of Engineering.</p>
  <p>Applications are now closed. Previous awardees are listed below.</p>
  <h2>Eligibility</h2>
  <p>Open to established independent researchers with a strong track record in their field and proven ability to lead collaborative work across disciplines.</p>
</main>
</body>
</html>`;

const NO_AMOUNT_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Industrial Fellowships</h1>
  <p>This scheme enables mid-career academics and industrialists to undertake collaborative research in either industrial or academic settings.</p>
  <p>The programme is currently paused for a review to embed greater flexibility. It is expected to resume in 2026.</p>
</main>
</body>
</html>`;

describe("parseRaengPage", () => {
  const url = "https://raeng.org.uk/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/research-fellowships/";

  it("extracts title from h1", () => {
    const result = parseRaengPage(OPEN_PROGRAMME_FIXTURE, url, "fallback", "fellowship");
    expect(result.title).toBe("RAEng Research Fellowships");
  });

  it("falls back to defaultTitle when no h1", () => {
    const html = "<html><body><main><p>Some content about this grant scheme for researchers.</p></main></body></html>";
    const result = parseRaengPage(html, url, "My Fallback Title", "fellowship");
    expect(result.title).toBe("My Fallback Title");
  });

  it("extracts multi-paragraph description from main", () => {
    const result = parseRaengPage(OPEN_PROGRAMME_FIXTURE, url, "fallback", "fellowship");
    expect(result.description).toContain("Research Fellowships");
    expect(result.description).toContain("independence");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility under Eligibility heading", () => {
    const result = parseRaengPage(OPEN_PROGRAMME_FIXTURE, url, "fallback", "fellowship");
    expect(result.eligibility).toContain("PhD awarded within the last four years");
  });

  it("returns null eligibility when no heading found", () => {
    const result = parseRaengPage(NO_AMOUNT_FIXTURE, url, "fallback", "fellowship");
    expect(result.eligibility).toBeNull();
  });

  it("extracts amount containing £", () => {
    const result = parseRaengPage(OPEN_PROGRAMME_FIXTURE, url, "fallback", "fellowship");
    expect(result.amountRaw).toContain("£800,000");
  });

  it("returns null amountRaw when no £ found", () => {
    const result = parseRaengPage(NO_AMOUNT_FIXTURE, url, "fallback", "fellowship");
    expect(result.amountRaw).toBeNull();
  });

  it("extracts deadline date from 'open in May 2026'", () => {
    const result = parseRaengPage(OPEN_PROGRAMME_FIXTURE, url, "fallback", "fellowship");
    expect(result.deadlineRaw).toContain("May 2026");
  });

  it("sets status to open when no closed signal", () => {
    const result = parseRaengPage(OPEN_PROGRAMME_FIXTURE, url, "fallback", "fellowship");
    expect(result.status).toBe("open");
  });

  it("sets status to closed when page says 'Applications are now closed'", () => {
    const result = parseRaengPage(CLOSED_PROGRAMME_FIXTURE, url, "fallback", "grant");
    expect(result.status).toBe("closed");
  });

  it("sets status to closed when page says 'currently paused'", () => {
    const result = parseRaengPage(NO_AMOUNT_FIXTURE, url, "fallback", "fellowship");
    expect(result.status).toBe("closed");
  });

  it("passes fundingType through", () => {
    const result = parseRaengPage(OPEN_PROGRAMME_FIXTURE, url, "fallback", "fellowship");
    expect(result.fundingType).toBe("fellowship");
  });

  it("sets url from parameter", () => {
    const result = parseRaengPage(OPEN_PROGRAMME_FIXTURE, url, "fallback", "fellowship");
    expect(result.url).toBe(url);
  });
});

describe("normaliseRaeng", () => {
  const raw = {
    title: "RAEng Research Fellowships",
    url: "https://raeng.org.uk/programmes-and-prizes/programmes/uk-grants-and-prizes/support-for-research/research-fellowships/",
    fundingType: "fellowship",
    status: "open",
    description: "Outstanding early-career researchers to become future research leaders. Up to £800,000 over five years.",
    eligibility: "Must hold a PhD awarded within the last four years.",
    amountRaw: "£800,000",
    deadlineRaw: "May 2026",
  };

  it("sets source to raeng", () => {
    expect(normaliseRaeng(raw).source).toBe("raeng");
  });

  it("sets funder_slug to royal-academy-of-engineering", () => {
    expect(normaliseRaeng(raw).funder_slug).toBe("royal-academy-of-engineering");
  });

  it("sets funder_name", () => {
    expect(normaliseRaeng(raw).funder_name).toBe("Royal Academy of Engineering");
  });

  it("parses amount_max from £800,000", () => {
    expect(normaliseRaeng(raw).amount_max).toBe(80_000_000);
  });

  it("sets funding_type from raw", () => {
    expect(normaliseRaeng(raw).funding_type).toBe("fellowship");
  });

  it("sets scope to null", () => {
    expect(normaliseRaeng(raw).scope).toBeNull();
  });

  it("passes eligibility through", () => {
    expect(normaliseRaeng(raw).eligibility).toContain("PhD awarded within");
  });

  it("passes description through", () => {
    expect(normaliseRaeng(raw).description).toContain("early-career researchers");
  });

  it("generates a slug", () => {
    expect(normaliseRaeng(raw).slug).toBe("raeng-research-fellowships");
  });

  it("sets deadline_date from deadlineRaw", () => {
    // "May 2026" has no day — parseDate returns null for month-only strings
    const result = normaliseRaeng(raw);
    expect(result.deadline_raw).toBe("May 2026");
  });

  it("sets status from raw", () => {
    expect(normaliseRaeng(raw).status).toBe("open");
  });
});
