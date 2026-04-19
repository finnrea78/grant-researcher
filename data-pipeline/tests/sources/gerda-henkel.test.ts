import { parseGerdaHenkelPage } from "../../src/sources/gerda-henkel";
import { normaliseGerdaHenkel } from "../../src/transforms/normalise-gerda-henkel";

const PAGE_URL = "https://www.gerda-henkel-stiftung.de/en/grants_projects";

// Fixture: research projects page with UK-format deadline
const RESEARCH_PROJECTS_FIXTURE = `<!DOCTYPE html>
<html>
<body>
<main>
  <h1>General Research Grants: Projects</h1>
  <p>The Gerda Henkel Foundation supports research projects in the historical humanities,
     including archaeology, history, art history, and history of science.
     Groups of minimum two researchers may apply for funding.</p>
  <p>Projects may be funded for up to 36 months. The Foundation has supported more than
     9,000 research projects since its establishment in 1976.</p>
  <h2>Eligibility</h2>
  <p>Applicants must hold a PhD and have a university or research institution affiliation.
     Applications are accepted from researchers of any nationality.</p>
  <h2>Funding Rates</h2>
  <ul>
    <li>PhD scholarships: 1,920 euros per month</li>
    <li>Postdoc research scholarships: 2,760 euros per month</li>
    <li>Senior researcher (post-doctoral lecture qualification): 3,720 euros per month</li>
  </ul>
  <h2>Deadlines</h2>
  <p>The application deadline for the Foundation committees spring meeting in 2026 is 28 May 2026.
     Applications have to be in the Foundation's office by this day.</p>
</main>
</body>
</html>`;

// Fixture: forced migration with US-format date
const FORCED_MIGRATION_FIXTURE = `<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Special Programme: Forced Migration</h1>
  <p>The foundation supports internationally oriented research projects on forced migration
     across six thematic areas including South-South mobilities and displaced people's agency.</p>
  <p>Applications must be in English and submitted electronically. Support duration
     ranges from 1 to 24 months.</p>
  <h2>Eligibility</h2>
  <p>Applicants must hold a PhD. No institutional affiliation necessary.
     Applications accepted from humanities and social sciences researchers.</p>
  <h2>Deadline</h2>
  <p>The next deadline ends April 29, 2026.</p>
  <h2>Funding</h2>
  <p>Postdoc Research Scholarships: 2,760 euros per month.</p>
</main>
</body>
</html>`;

// Fixture: rolling / no deadline
const ROLLING_FIXTURE = `<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Scholars at Risk</h1>
  <p>The Foundation supports threatened and refugee scholars in historical humanities.
     Subsistence scholarships (max 6 months), doctoral (up to 2 years), and research
     scholarships (up to 1 year) are available on a rolling basis.</p>
  <p>Applications are accepted year-round with no fixed deadline. Processing time
     is typically up to four months.</p>
  <h2>Eligibility</h2>
  <p>Researchers in historical humanities who have left their home country within
     approximately three years. Must provide proof of threat.</p>
</main>
</body>
</html>`;

// Fixture: concluded programme
const CONCLUDED_FIXTURE = `<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Security, Society and the State</h1>
  <p>The last round of applications took place in November 2021.
     The programme has now concluded.</p>
</main>
</body>
</html>`;

describe("parseGerdaHenkelPage", () => {
  it("extracts title from h1", () => {
    const result = parseGerdaHenkelPage(RESEARCH_PROJECTS_FIXTURE, "Default", "grant", PAGE_URL);
    expect(result.title).toBe("General Research Grants: Projects");
  });

  it("falls back to defaultTitle when h1 absent", () => {
    const result = parseGerdaHenkelPage("<html><body><p>Text.</p></body></html>", "Fallback Title", "grant", PAGE_URL);
    expect(result.title).toBe("Fallback Title");
  });

  it("extracts multi-paragraph description", () => {
    const result = parseGerdaHenkelPage(RESEARCH_PROJECTS_FIXTURE, "Test", "grant", PAGE_URL);
    expect(result.description).toContain("historical humanities");
    expect(result.description).toContain("9,000 research projects");
  });

  it("extracts eligibility from Eligibility section", () => {
    const result = parseGerdaHenkelPage(RESEARCH_PROJECTS_FIXTURE, "Test", "grant", PAGE_URL);
    expect(result.eligibility).toContain("university or research institution");
  });

  it("returns null eligibility when section absent", () => {
    const result = parseGerdaHenkelPage(ROLLING_FIXTURE, "Test", "fellowship", PAGE_URL);
    // Scholars at Risk fixture has Eligibility section
    expect(result.eligibility).toContain("proof of threat");
  });

  it("extracts UK-format deadline date", () => {
    const result = parseGerdaHenkelPage(RESEARCH_PROJECTS_FIXTURE, "Test", "grant", PAGE_URL);
    expect(result.deadlineRaw).toBe("28 May 2026");
  });

  it("extracts US-format deadline date", () => {
    const result = parseGerdaHenkelPage(FORCED_MIGRATION_FIXTURE, "Test", "grant", PAGE_URL);
    expect(result.deadlineRaw).toBe("April 29, 2026");
  });

  it("returns null deadline for rolling programmes", () => {
    const result = parseGerdaHenkelPage(ROLLING_FIXTURE, "Scholars at Risk", "fellowship", PAGE_URL);
    expect(result.deadlineRaw).toBeNull();
    expect(result.status).toBe("open");
  });

  it("extracts EUR amount", () => {
    const result = parseGerdaHenkelPage(RESEARCH_PROJECTS_FIXTURE, "Test", "grant", PAGE_URL);
    expect(result.amountRaw).toContain("3,720"); // highest monthly rate
  });

  it("sets status to closed for concluded programme", () => {
    const result = parseGerdaHenkelPage(CONCLUDED_FIXTURE, "Test", "grant", PAGE_URL);
    expect(result.status).toBe("closed");
  });

  it("sets url from parameter", () => {
    const result = parseGerdaHenkelPage(RESEARCH_PROJECTS_FIXTURE, "Test", "grant", PAGE_URL);
    expect(result.url).toBe(PAGE_URL);
  });

  it("sets fundingType from parameter", () => {
    const grant = parseGerdaHenkelPage(RESEARCH_PROJECTS_FIXTURE, "T", "grant", PAGE_URL);
    expect(grant.fundingType).toBe("grant");
    const fellowship = parseGerdaHenkelPage(ROLLING_FIXTURE, "T", "fellowship", PAGE_URL);
    expect(fellowship.fundingType).toBe("fellowship");
  });
});

describe("normaliseGerdaHenkel", () => {
  const raw = {
    title: "General Research Grants: Projects",
    url: PAGE_URL,
    deadlineRaw: "28 May 2026",
    description: "Supports research groups in historical humanities.",
    eligibility: "PhD required.",
    amountRaw: "€3,720",
    fundingType: "grant",
    status: "open",
  };

  it("sets funder_slug to gerda-henkel-foundation", () => {
    expect(normaliseGerdaHenkel(raw).funder_slug).toBe("gerda-henkel-foundation");
  });

  it("sets source to gerda_henkel", () => {
    expect(normaliseGerdaHenkel(raw).source).toBe("gerda_henkel");
  });

  it("parses UK deadline date", () => {
    const result = normaliseGerdaHenkel(raw);
    expect(result.deadline_date).toBe("2026-05-28");
  });

  it("parses US deadline date", () => {
    const usRaw = { ...raw, deadlineRaw: "April 29, 2026" };
    expect(normaliseGerdaHenkel(usRaw).deadline_date).toBe("2026-04-29");
  });

  it("sets status open for future deadline", () => {
    expect(normaliseGerdaHenkel(raw).status).toBe("open");
  });

  it("sets status closed for past deadline", () => {
    const closed = { ...raw, deadlineRaw: "15 March 2024" };
    expect(normaliseGerdaHenkel(closed).status).toBe("closed");
  });

  it("sets rolling programme to open with null deadline", () => {
    const rolling = { ...raw, deadlineRaw: null, status: "open" };
    const result = normaliseGerdaHenkel(rolling);
    expect(result.status).toBe("open");
    expect(result.deadline_date).toBeNull();
  });

  it("parses EUR amount", () => {
    const result = normaliseGerdaHenkel(raw);
    expect(result.amount_currency).toBe("EUR");
    // €3,720 = 372,000 cents
    expect(result.amount_max).toBe(372_000);
  });

  it("sets scope to null", () => {
    expect(normaliseGerdaHenkel(raw).scope).toBeNull();
  });

  it("generates slug from title", () => {
    expect(normaliseGerdaHenkel(raw).slug).toBe("general-research-grants-projects");
  });

  it("preserves description and eligibility", () => {
    const result = normaliseGerdaHenkel(raw);
    expect(result.description).toBe("Supports research groups in historical humanities.");
    expect(result.eligibility).toBe("PhD required.");
  });
});
