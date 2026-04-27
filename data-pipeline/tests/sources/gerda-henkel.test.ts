import { parseGerdaHenkelPage } from "../../src/sources/gerda-henkel";
import { normaliseGerdaHenkel } from "../../src/transforms/normalise-gerda-henkel";

const SCHOLARSHIPS_URL = "https://www.gerda-henkel-stiftung.de/en/researchscholarships";
const PROJECTS_URL = "https://www.gerda-henkel-stiftung.de/en/grants_projects";
const SCHOLARS_AT_RISK_URL = "https://www.gerda-henkel-stiftung.de/en/scholars-at-risk-eng";
const FORCED_MIGRATION_URL = "https://www.gerda-henkel-stiftung.de/en/forced_migration";

const FIXTURE_SCHOLARSHIPS = `
<!DOCTYPE html>
<html lang="en">
<head><title>Research Scholarships | Gerda Henkel Foundation</title></head>
<body>
<main>
  <p>The Gerda Henkel Foundation awards research scholarships to support postdoctoral researchers and scholars with post-doctoral lecture qualification working in the historical humanities.</p>
  <p>Postdoctoral scholarships amount to €2,760 monthly. For senior scholars and Habilitation candidates, the monthly stipend is €3,720. Travel and material expenses can be requested in addition.</p>

  <h3>Eligibility</h3>
  <p>Applicants must hold a doctorate. The Foundation supports research in archaeology, art history, historical Islamic studies, history, history of law, history of science, and prehistory.</p>
  <p>All nationalities are eligible. There is no requirement to undertake the research in Germany.</p>

  <h3>Deadlines</h3>
  <p>Applications can be submitted at any time. The Foundation's Board of Trustees reviews applications at periodic meetings throughout the year.</p>
</main>
</body>
</html>`;

const FIXTURE_PROJECTS = `
<!DOCTYPE html>
<html lang="en">
<head><title>Research Projects | Gerda Henkel Foundation</title></head>
<body>
<main>
  <p>Research projects funding covers staff costs, travel, equipment and materials for collaborative research in the historical humanities.</p>
  <p>Funding for research projects can include salary contributions of up to €5,000 monthly for postdoctoral staff plus project-specific costs.</p>

  <h3>Who can apply</h3>
  <p>Project leaders must hold a doctorate and be affiliated with a recognised research institution.</p>

  <h3>Application</h3>
  <p>Applications are accepted on a rolling basis. There is no application deadline.</p>
</main>
</body>
</html>`;

const FIXTURE_SCHOLARS_AT_RISK = `
<!DOCTYPE html>
<html lang="en">
<head><title>Funding Opportunities for Scholars at Risk | Gerda Henkel Foundation</title></head>
<body>
<main>
  <p>Since 2023, the Gerda Henkel Foundation has offered a geographically open scholarship program for threatened and refugee scholars from crisis areas.</p>
  <p>Three scholarship types are available: subsistence scholarships of €1,200 monthly for up to 6 months, doctoral scholarships of €1,800 monthly for up to 2 years, and research scholarships of €2,760 monthly for up to 1 year.</p>

  <h3>Target group</h3>
  <p>Threatened and refugee scholars from crisis regions working in the historical humanities.</p>

  <p>Applications can be submitted at any time.</p>
</main>
</body>
</html>`;

const FIXTURE_FORCED_MIGRATION_CLOSED = `
<!DOCTYPE html>
<html lang="en">
<head><title>Forced Migration | Gerda Henkel Foundation</title></head>
<body>
<main>
  <p>The Forced Migration funding programme supports research scholarships and research projects on forced migration past and present.</p>
  <p>Project funding of up to €120,000 can be requested.</p>
  <p>The application deadline has expired. The next call is expected in autumn 2026.</p>
</main>
</body>
</html>`;

describe("parseGerdaHenkelPage (research scholarships — rolling)", () => {
  it("extracts title from <title> tag", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    expect(result.title).toBe("Research Scholarships");
  });

  it("extracts amount containing €2,760", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    expect(result.amountRaw).toContain("€2,760");
  });

  it("detects rolling deadline from 'at any time' phrase", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    expect(result.deadlineRaw).toMatch(/rolling|any time/i);
  });

  it("sets status to open for rolling programmes", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    expect(result.status).toBe("open");
  });

  it("extracts multi-paragraph description", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    expect(result.description).toContain("Gerda Henkel");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility section with discipline list", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    expect(result.eligibility).not.toBeNull();
    expect(result.eligibility).toMatch(/archaeology|art history|historical/i);
  });

  it("preserves the page URL on the raw record", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    expect(result.url).toBe(SCHOLARSHIPS_URL);
  });

  it("preserves the funding type on the raw record", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    expect(result.fundingType).toBe("scholarship");
  });
});

describe("parseGerdaHenkelPage (research projects — rolling, 'no application deadline')", () => {
  it("detects rolling deadline from 'no application deadline'", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_PROJECTS,
      PROJECTS_URL,
      "Research Projects",
      "research_grant"
    );
    expect(result.status).toBe("open");
    expect(result.deadlineRaw).toMatch(/rolling|any time/i);
  });

  it("extracts €5,000 monthly project staff allowance", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_PROJECTS,
      PROJECTS_URL,
      "Research Projects",
      "research_grant"
    );
    expect(result.amountRaw).toContain("€5,000");
  });

  it("extracts eligibility from 'Who can apply' heading", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_PROJECTS,
      PROJECTS_URL,
      "Research Projects",
      "research_grant"
    );
    expect(result.eligibility).toContain("doctorate");
  });
});

describe("parseGerdaHenkelPage (scholars at risk)", () => {
  it("extracts amount", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARS_AT_RISK,
      SCHOLARS_AT_RISK_URL,
      "Funding Opportunities for Scholars at Risk",
      "fellowship"
    );
    expect(result.amountRaw).toMatch(/€1,200|€1,800|€2,760/);
  });

  it("extracts target group from 'Target group' heading", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARS_AT_RISK,
      SCHOLARS_AT_RISK_URL,
      "Funding Opportunities for Scholars at Risk",
      "fellowship"
    );
    expect(result.eligibility).toContain("Threatened and refugee");
  });

  it("sets status to open for rolling programme", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_SCHOLARS_AT_RISK,
      SCHOLARS_AT_RISK_URL,
      "Funding Opportunities for Scholars at Risk",
      "fellowship"
    );
    expect(result.status).toBe("open");
  });
});

describe("parseGerdaHenkelPage (forced migration — call closed)", () => {
  it("detects expired deadline and sets status to closed", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_FORCED_MIGRATION_CLOSED,
      FORCED_MIGRATION_URL,
      "Forced Migration",
      "research_grant"
    );
    expect(result.status).toBe("closed");
  });

  it("extracts project amount up to €120,000", () => {
    const result = parseGerdaHenkelPage(
      FIXTURE_FORCED_MIGRATION_CLOSED,
      FORCED_MIGRATION_URL,
      "Forced Migration",
      "research_grant"
    );
    expect(result.amountRaw).toContain("€120,000");
  });
});

describe("normaliseGerdaHenkel", () => {
  it("sets source to gerda_henkel_foundation", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.source).toBe("gerda_henkel_foundation");
  });

  it("sets funder_slug to gerda-henkel-foundation", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.funder_slug).toBe("gerda-henkel-foundation");
  });

  it("sets funder_name", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.funder_name).toBe("Gerda Henkel Foundation");
  });

  it("parses amount_min as EUR pence (€2,760 → 276,000)", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.amount_min).toBe(276_000);
    expect(result.amount_currency).toBe("EUR");
  });

  it("parses amount_max from 'up to €5,000' on the project programme", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_PROJECTS,
      PROJECTS_URL,
      "Research Projects",
      "research_grant"
    );
    const result = normaliseGerdaHenkel(raw);
    // "up to €5,000" → amount_max only (parseAmount upTo branch leaves min null)
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBe(500_000); // €5,000 in pence
  });

  it("sets deadline_date to null (rolling programmes)", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.deadline_date).toBeNull();
  });

  it("sets scope to null (no hardcoded discipline labels)", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.scope).toBeNull();
  });

  it("maps eligibility field through to normalised record", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.eligibility).toMatch(/archaeology|art history|historical/i);
  });

  it("derives slug from title", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_SCHOLARSHIPS,
      SCHOLARSHIPS_URL,
      "Research Scholarships",
      "scholarship"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.slug).toBe("research-scholarships");
  });

  it("preserves funding_type from raw record", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_PROJECTS,
      PROJECTS_URL,
      "Research Projects",
      "research_grant"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.funding_type).toBe("research_grant");
  });

  it("propagates closed status from forced migration fixture", () => {
    const raw = parseGerdaHenkelPage(
      FIXTURE_FORCED_MIGRATION_CLOSED,
      FORCED_MIGRATION_URL,
      "Forced Migration",
      "research_grant"
    );
    const result = normaliseGerdaHenkel(raw);
    expect(result.status).toBe("closed");
  });
});
