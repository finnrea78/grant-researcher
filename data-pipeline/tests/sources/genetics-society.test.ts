import { parseGeneticsSocietyPage } from "../../src/sources/genetics-society";
import { normaliseGeneticsSociety } from "../../src/transforms/normalise-genetics-society";

const FIELDWORK_URL = "https://genetics.org.uk/grants/heredity-fieldwork-grant/";
const CONFERENCE_URL = "https://genetics.org.uk/grants/junior-scientist-conference-grants/";

// Fixture: scheme with specific year deadline and eligibility section
const FIXTURE_WITH_YEAR = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h2>Heredity Fieldwork Grant</h2>
  <p>The Genetics Society has made awards up to £2,000 available to cover travel and accommodation costs associated with a field-based genetic research project.</p>
  <p>These grants are intended to support projects that require access to natural populations or specific geographical locations where the study organisms are found.</p>
  <h3>Eligibility</h3>
  <p>Eligible applicants are postgraduate or postdoctoral researchers at a UK institution who are members of the Genetics Society.</p>
  <p>The deadline for 2026 applications is 31st March 2026. Applications should be submitted via the online portal.</p>
</main>
</body>
</html>`;

// Fixture: scheme with rolling quarterly deadlines (no year)
const FIXTURE_ROLLING = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h2>Junior Scientist Conference Grants</h2>
  <p>The Genetics Society offers conference grants to support junior scientists to attend scientific meetings.</p>
  <ul>
    <li>Scheme A: up to £200 for Genetics Society or JIG meetings</li>
    <li>Scheme B: up to £500 for other national/international conferences</li>
    <li>Scheme C: up to £300 for virtual conference attendance</li>
  </ul>
  <p>Deadlines are quarterly, at midnight on 1st February, May, August, November.</p>
</main>
</body>
</html>`;

// Fixture: past deadline → closed
const FIXTURE_PAST = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h2>Training Grant</h2>
  <p>Grants of up to £1,200 to enable members to attend courses and training workshops.</p>
  <p>The deadline for the next round is 1st February 2024. Applications closed.</p>
</main>
</body>
</html>`;

describe("parseGeneticsSocietyPage (with year deadline)", () => {
  it("extracts title from h2", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL);
    expect(result?.title).toBe("Heredity Fieldwork Grant");
  });

  it("extracts multi-paragraph description", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL);
    expect(result?.description).not.toBeNull();
    expect(result?.description).toContain("Genetics Society has made awards");
    expect(result?.description?.length).toBeGreaterThan(100);
  });

  it("extracts eligibility from eligibility section", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL);
    expect(result?.eligibility).not.toBeNull();
    expect(result?.eligibility).toContain("postgraduate or postdoctoral");
  });

  it("extracts deadline from p containing deadline keyword", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL);
    expect(result?.deadlineRaw).toContain("March 2026");
  });

  it("strips ordinal suffix from date", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL);
    expect(result?.deadlineRaw).not.toContain("st");
  });

  it("extracts amount from prose", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL);
    expect(result?.amountRaw).toContain("£2,000");
  });

  it("sets status to closed for past deadline", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_PAST, FIELDWORK_URL);
    expect(result?.status).toBe("closed");
  });
});

describe("parseGeneticsSocietyPage (rolling, no year)", () => {
  it("extracts partial deadline without year", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_ROLLING, CONFERENCE_URL);
    expect(result?.deadlineRaw).toMatch(/February/i);
  });

  it("sets status to open for rolling scheme (no year to compare)", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_ROLLING, CONFERENCE_URL);
    expect(result?.status).toBe("open");
  });

  it("extracts amount from list item", () => {
    const result = parseGeneticsSocietyPage(FIXTURE_ROLLING, CONFERENCE_URL);
    expect(result?.amountRaw).toContain("£200");
  });
});

describe("normaliseGeneticsSociety", () => {
  it("sets source to genetics_society", () => {
    const raw = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL)!;
    const result = normaliseGeneticsSociety(raw);
    expect(result.source).toBe("genetics_society");
  });

  it("sets funder_slug to genetics-society", () => {
    const raw = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL)!;
    const result = normaliseGeneticsSociety(raw);
    expect(result.funder_slug).toBe("genetics-society");
  });

  it("parses deadline_date when year is present", () => {
    const raw = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL)!;
    const result = normaliseGeneticsSociety(raw);
    expect(result.deadline_date).toBe("2026-03-31");
  });

  it("sets deadline_date to null when no year in deadlineRaw", () => {
    const raw = parseGeneticsSocietyPage(FIXTURE_ROLLING, CONFERENCE_URL)!;
    const result = normaliseGeneticsSociety(raw);
    expect(result.deadline_date).toBeNull();
  });

  it("parses amount_max for up-to grants", () => {
    const raw = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL)!;
    const result = normaliseGeneticsSociety(raw);
    expect(result.amount_max).toBe(200_000); // £2,000 in pence
    expect(result.amount_min).toBeNull();
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    const raw = parseGeneticsSocietyPage(FIXTURE_WITH_YEAR, FIELDWORK_URL)!;
    const result = normaliseGeneticsSociety(raw);
    expect(result.scope).toBeNull();
  });
});
