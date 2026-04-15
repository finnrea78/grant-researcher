import { parseHumboldtPage } from "../../src/sources/humboldt";
import { normaliseHumboldt } from "../../src/transforms/normalise-humboldt";

const FELLOWSHIP_URL = "https://www.humboldt-foundation.de/en/apply/sponsorship-programmes/humboldt-research-fellowship";
const AWARD_URL = "https://www.humboldt-foundation.de/en/apply/sponsorship-programmes/humboldt-research-award";
const SCHWARTZ_URL = "https://www.humboldt-foundation.de/en/apply/sponsorship-programmes/philipp-schwartz-initiative";

const FIXTURE_FELLOWSHIP = `
<!DOCTYPE html>
<html lang="en">
<head><title>Humboldt Research Fellowship | Alexander von Humboldt-Stiftung</title></head>
<body>
<main>
  <p>The Humboldt Research Fellowship supports excellent researchers from abroad to conduct research in Germany.</p>
  <p>The monthly fellowship amount is €3,000 plus additional benefits. Fellowships may last from 6 to 24 months for postdoctoral researchers.</p>
  <p>The fellowship amount is €3,600 plus additional benefits for experienced researchers. Fellowships may last from 6 to 18 months.</p>

  <h3 class="headline headline--3">Deadlines</h3>
  <p>Corresponding to the three selection rounds per year.</p>
  <p>There is no closing date for submitting applications. Applications are reviewed three times per year.</p>
</main>
</body>
</html>`;

const FIXTURE_AWARD = `
<!DOCTYPE html>
<html lang="en">
<head><title>Humboldt Research Award | Alexander von Humboldt-Stiftung</title></head>
<body>
<main>
  <p>The Humboldt Research Award recognises internationally recognised researchers in any discipline.</p>
  <p>The award amount is €80,000.</p>

  <div class="accordion">
    <span class="accordion__toggle-label">Are there deadlines for submitting nominations?</span>
    <div class="accordion__content">
      <p>No. Nominations may be submitted online at any time. The selection committee meets twice a year.</p>
    </div>
  </div>
</main>
</body>
</html>`;

const FIXTURE_SCHWARTZ = `
<!DOCTYPE html>
<html lang="en">
<head><title>Philipp Schwartz Initiative | Alexander von Humboldt-Stiftung</title></head>
<body>
<main>
  <p>The Philipp Schwartz Initiative supports at-risk researchers.</p>
  <p>The host institution receives a lump sum allowance of €20,000 for each individual sponsored.</p>
  <p>The application deadline has expired. Results are expected by end of May 2026.</p>
</main>
</body>
</html>`;

describe("parseHumboldtPage (fellowship — rolling)", () => {
  it("extracts title from title tag", () => {
    const result = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    expect(result.title).toBe("Humboldt Research Fellowship");
  });

  it("extracts amount containing €", () => {
    const result = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    expect(result.amountRaw).toContain("€3,000");
  });

  it("detects rolling deadline", () => {
    const result = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    expect(result.deadlineRaw).toMatch(/rolling|no closing date/i);
  });

  it("sets status to open for rolling programmes", () => {
    const result = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    expect(result.status).toBe("open");
  });

  it("extracts description from first substantial p", () => {
    const result = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    expect(result.description).toContain("Humboldt Research Fellowship");
  });
});

describe("parseHumboldtPage (award)", () => {
  it("extracts €80,000 award amount", () => {
    const result = parseHumboldtPage(FIXTURE_AWARD, AWARD_URL, "Humboldt Research Award", "award");
    expect(result.amountRaw).toContain("€80,000");
  });

  it("sets status to open (no deadline expired text)", () => {
    const result = parseHumboldtPage(FIXTURE_AWARD, AWARD_URL, "Humboldt Research Award", "award");
    expect(result.status).toBe("open");
  });
});

describe("parseHumboldtPage (Philipp Schwartz — call closed)", () => {
  it("detects expired deadline and sets status to closed", () => {
    const result = parseHumboldtPage(FIXTURE_SCHWARTZ, SCHWARTZ_URL, "Philipp Schwartz Initiative", "fellowship");
    expect(result.status).toBe("closed");
  });

  it("extracts lump sum amount", () => {
    const result = parseHumboldtPage(FIXTURE_SCHWARTZ, SCHWARTZ_URL, "Philipp Schwartz Initiative", "fellowship");
    expect(result.amountRaw).toContain("€20,000");
  });
});

describe("normaliseHumboldt", () => {
  it("sets source to humboldt_foundation", () => {
    const raw = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    const result = normaliseHumboldt(raw);
    expect(result.source).toBe("humboldt_foundation");
  });

  it("sets funder_slug to humboldt-foundation", () => {
    const raw = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    const result = normaliseHumboldt(raw);
    expect(result.funder_slug).toBe("humboldt-foundation");
  });

  it("parses amount_min from monthly amount text", () => {
    const raw = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    const result = normaliseHumboldt(raw);
    // "€3,000" → 300,000 pence equiv in EUR pence
    expect(result.amount_min).toBe(300_000);
    expect(result.amount_currency).toBe("EUR");
  });

  it("parses amount for the award", () => {
    const raw = parseHumboldtPage(FIXTURE_AWARD, AWARD_URL, "Humboldt Research Award", "award");
    const result = normaliseHumboldt(raw);
    expect(result.amount_min).toBe(8_000_000); // €80,000 in pence
  });

  it("sets deadline_date to null (rolling programmes)", () => {
    const raw = parseHumboldtPage(FIXTURE_FELLOWSHIP, FELLOWSHIP_URL, "Humboldt Research Fellowship", "fellowship");
    const result = normaliseHumboldt(raw);
    expect(result.deadline_date).toBeNull();
  });
});
