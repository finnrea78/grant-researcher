import { parseVivensaPage } from "../../src/sources/vivensa";
import { normaliseVivensa } from "../../src/transforms/normalise-vivensa";

const PAGE_URL = "https://vivensafoundation.org.uk/apply-for-funding/";

const FIXTURE_OPEN = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Apply for funding</h1>
  <h2 id="open-calls-and-deadlines">Open calls and deadlines</h2>

  <h3>Early Career Postdoctoral Fellowship Scheme</h3>
  <p><strong>Now open – deadline for applications 5pm on 22 May 2026</strong></p>
  <p>Supports exceptional early career researchers to develop their independent research career in ageing.</p>
  <p>Funding of up to £350,000 over three years full-time.</p>

  <h3>Academy Ignition Fund</h3>
  <p><strong>Now open – applications accepted on a rolling basis with quarterly review deadlines</strong></p>
  <p>Small awards to help researchers build collaborations and test new ideas.</p>
  <p>Awards of up to £5,000 per application.</p>

  <h2 id="closed-calls">Closed calls</h2>

  <h3>Starter Grants for Clinical Lecturers</h3>
  <p><strong>Now closed</strong></p>
  <p>Run in partnership with the Academy of Medical Sciences.</p>
  <p>Maximum grant available is £40,000.</p>
</main>
</body>
</html>`;

const FIXTURE_ROLLING = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h3>Vivensa Foundation PhD by Publication funding</h3>
  <p><strong>Now open – applications accepted on a rolling basis</strong></p>
  <p>Covers registration fees and printing costs for PhD by Publication candidates.</p>
</main>
</body>
</html>`;

describe("parseVivensaPage", () => {
  it("extracts all grant entries", () => {
    const result = parseVivensaPage(FIXTURE_OPEN);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("marks open grants correctly", () => {
    const result = parseVivensaPage(FIXTURE_OPEN);
    const open = result.filter(r => r.status === "open");
    expect(open.length).toBeGreaterThanOrEqual(2);
  });

  it("marks closed grants correctly", () => {
    const result = parseVivensaPage(FIXTURE_OPEN);
    const closed = result.find(r => r.title.includes("Starter Grants"));
    expect(closed?.status).toBe("closed");
  });

  it("extracts deadline date text for open grants", () => {
    const result = parseVivensaPage(FIXTURE_OPEN);
    const fellowship = result.find(r => r.title.includes("Early Career"));
    expect(fellowship?.deadlineRaw).toBe("22 May 2026");
  });

  it("sets deadlineRaw to Rolling for rolling calls", () => {
    const result = parseVivensaPage(FIXTURE_ROLLING);
    expect(result[0].deadlineRaw).toBe("Rolling");
  });

  it("extracts amount text for grants with £ amounts", () => {
    const result = parseVivensaPage(FIXTURE_OPEN);
    const fellowship = result.find(r => r.title.includes("Early Career"));
    expect(fellowship?.amountRaw).toContain("£350,000");
  });

  it("extracts grant title from h3", () => {
    const result = parseVivensaPage(FIXTURE_OPEN);
    expect(result[0].title).toBe("Early Career Postdoctoral Fellowship Scheme");
  });

  it("sets url to the apply-for-funding page", () => {
    const result = parseVivensaPage(FIXTURE_OPEN);
    expect(result[0].url).toContain("apply-for-funding");
  });
});

describe("normaliseVivensa", () => {
  it("sets source to vivensa_foundation", () => {
    const raw = parseVivensaPage(FIXTURE_OPEN)[0];
    const result = normaliseVivensa(raw);
    expect(result.source).toBe("vivensa_foundation");
  });

  it("sets funder_slug to vivensa-foundation", () => {
    const raw = parseVivensaPage(FIXTURE_OPEN)[0];
    const result = normaliseVivensa(raw);
    expect(result.funder_slug).toBe("vivensa-foundation");
  });

  it("parses amount_max for up-to grants", () => {
    const raw = parseVivensaPage(FIXTURE_OPEN)[0]; // up to £350,000
    const result = normaliseVivensa(raw);
    expect(result.amount_max).toBe(35_000_000); // £350,000 in pence
    expect(result.amount_min).toBeNull();
  });

  it("parses deadline_date for open grant", () => {
    const raw = parseVivensaPage(FIXTURE_OPEN).find(r => r.title.includes("Early Career"))!;
    const result = normaliseVivensa(raw);
    expect(result.deadline_date).toBe("2026-05-22");
  });

  it("sets deadline_date to null for rolling calls", () => {
    const raw = parseVivensaPage(FIXTURE_ROLLING)[0];
    const result = normaliseVivensa(raw);
    expect(result.deadline_date).toBeNull();
  });

  it("sets status to closed for closed grants", () => {
    const raw = parseVivensaPage(FIXTURE_OPEN).find(r => r.title.includes("Starter Grants"))!;
    const result = normaliseVivensa(raw);
    expect(result.status).toBe("closed");
  });
});
