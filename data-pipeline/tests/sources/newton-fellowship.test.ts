import { parseNewtonPage } from "../../src/sources/newton-fellowship";
import { normaliseNewton } from "../../src/transforms/normalise-newton";

const FIXTURE_HTML_CLOSED = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Newton International Fellowships</h1>
  <p>The Newton International Fellowship scheme supports early career researchers outside the UK who wish to conduct research at a UK research institution for two years.</p>
  <p>The scheme offers awards of up to £280,000 over two years including a living allowance, research expenses and accommodation allowance.</p>
  <p><strong>Closed</strong></p>
  <dl>
    <dt>Open date</dt>
    <dd>15 January 2026</dd>
    <dt>Close date</dt>
    <dd>11 March 2026</dd>
    <dt>Decision by</dt>
    <dd>31 August 2026</dd>
  </dl>
</main>
</body>
</html>`;

const FIXTURE_HTML_OPEN = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Newton International Fellowships</h1>
  <p>The Newton International Fellowship scheme supports early career researchers outside the UK.</p>
  <p>Awards of up to £280,000 over two years including a living allowance and research expenses.</p>
  <p><strong>Open</strong></p>
  <dl>
    <dt>Open date</dt>
    <dd>15 January 2027</dd>
    <dt>Close date</dt>
    <dd>11 March 2027</dd>
    <dt>Decision by</dt>
    <dd>31 August 2027</dd>
  </dl>
</main>
</body>
</html>`;

describe("parseNewtonPage", () => {
  it("returns a single fellowship entry", () => {
    const result = parseNewtonPage(FIXTURE_HTML_CLOSED);
    expect(result).toHaveLength(1);
  });

  it("extracts title from h1", () => {
    const result = parseNewtonPage(FIXTURE_HTML_CLOSED);
    expect(result[0].title).toBe("Newton International Fellowships");
  });

  it("detects closed status", () => {
    const result = parseNewtonPage(FIXTURE_HTML_CLOSED);
    expect(result[0].status).toBe("closed");
  });

  it("detects open status", () => {
    const result = parseNewtonPage(FIXTURE_HTML_OPEN);
    expect(result[0].status).toBe("open");
  });

  it("extracts close date from dl", () => {
    const result = parseNewtonPage(FIXTURE_HTML_CLOSED);
    expect(result[0].closeDateRaw).toBe("11 March 2026");
  });

  it("extracts open date from dl", () => {
    const result = parseNewtonPage(FIXTURE_HTML_CLOSED);
    expect(result[0].openDateRaw).toBe("15 January 2026");
  });

  it("extracts decision date from dl", () => {
    const result = parseNewtonPage(FIXTURE_HTML_CLOSED);
    expect(result[0].decisionDateRaw).toBe("31 August 2026");
  });

  it("extracts amount containing £ symbol", () => {
    const result = parseNewtonPage(FIXTURE_HTML_CLOSED);
    expect(result[0].amountRaw).not.toBeNull();
    expect(result[0].amountRaw).toContain("£280,000");
  });

  it("sets URL to the fellowship page", () => {
    const result = parseNewtonPage(FIXTURE_HTML_CLOSED);
    expect(result[0].url).toBe("https://royalsociety.org/grants/newton-international/");
  });
});

describe("normaliseNewton", () => {
  it("normalises a closed fellowship with amount and deadline", () => {
    const raw = parseNewtonPage(FIXTURE_HTML_CLOSED)[0];
    const result = normaliseNewton(raw);

    expect(result.source).toBe("newton_fellowship");
    expect(result.funder_slug).toBe("royal-society");
    expect(result.status).toBe("closed");
    expect(result.deadline_date).toBe("2026-03-11");
    expect(result.amount_max).toBeGreaterThan(0);
    expect(result.funding_type).toBe("fellowship");
  });

  it("normalises an open fellowship", () => {
    const raw = parseNewtonPage(FIXTURE_HTML_OPEN)[0];
    const result = normaliseNewton(raw);
    expect(result.status).toBe("open");
    expect(result.deadline_date).toBe("2027-03-11");
  });
});
