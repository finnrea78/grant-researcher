import { parseAcMedSciPage } from "../../src/sources/acmedsci";
import { normaliseAcMedSci } from "../../src/transforms/normalise-acmedsci";

const SPRINGBOARD_URL = "https://acmedsci.ac.uk/grants-and-schemes/grant-schemes/springboard";
const STARTER_URL = "https://acmedsci.ac.uk/grants-and-schemes/grant-schemes/starter-grants";

// Fixture: open scheme with scheme-open badge and specific deadline
const FIXTURE_OPEN = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Springboard</h1>
  <div class="scheme-open">Open</div>

  <div class="col full funding-detail">
    <div class="left match" style="flex-basis: 32%;">
      <p><span data-olk-copy-source="MessageBody">
        Springboard provides up to £125,000 over two years to support independent researchers.
      </span></p>
      <p class="sub">Key dates</p>
      <p>The next round is open and prospective applicants are encouraged to contact their Springboard Champion.</p>
    </div>
  </div>

  <div class="content-body">
    <p>Springboard supports outstanding early-career biomedical and health researchers.</p>
    <p>Applicants must submit the Expression of Interest form by <strong>11 December 2026</strong> for consideration in Spring 2027.</p>
  </div>
</main>
</body>
</html>`;

// Fixture: closed scheme
const FIXTURE_CLOSED = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Starter Grants for Clinical Lecturers</h1>

  <div class="col full funding-detail">
    <div class="left match" style="flex-basis: 32%;">
      <p class="x_MsoNormal"><span data-olk-copy-source="MessageBody">
        Our Starter Grants provide up to £40,000 of research funding over 1-2 years.
      </span></p>
      <p class="sub">Key dates</p>
      <p>Round 35 is now closed.</p>
    </div>
  </div>

  <div class="content-body">
    <p>Starter Grants support clinical lecturers to develop independent research careers.</p>
  </div>
</main>
</body>
</html>`;

// Fixture: no title tag, uses default
const FIXTURE_NO_H1 = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <div class="scheme-open">Open</div>
  <div class="col full funding-detail">
    <div class="left match">
      <p><span>Up to £25,000 over one year for networking activities.</span></p>
      <p class="sub">Key dates</p>
      <p>Applications are open until 30 June 2027.</p>
    </div>
  </div>
</main>
</body>
</html>`;

describe("parseAcMedSciPage (open scheme)", () => {
  it("extracts title from h1", () => {
    const result = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard");
    expect(result?.title).toBe("Springboard");
  });

  it("sets status to open when scheme-open badge present", () => {
    const result = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard");
    expect(result?.status).toBe("open");
  });

  it("extracts specific deadline date from strong tag", () => {
    const result = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard");
    expect(result?.deadlineRaw).toContain("11 December 2026");
  });

  it("extracts amount from funding-detail span", () => {
    const result = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard");
    expect(result?.amountRaw).toContain("£125,000");
  });

  it("extracts description from first substantive p", () => {
    const result = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard");
    expect(result?.description).toContain("Springboard");
  });
});

describe("parseAcMedSciPage (closed scheme)", () => {
  it("sets status to closed when key dates text says closed", () => {
    const result = parseAcMedSciPage(FIXTURE_CLOSED, STARTER_URL, "Starter Grants");
    expect(result?.status).toBe("closed");
  });

  it("extracts amount from funding-detail span", () => {
    const result = parseAcMedSciPage(FIXTURE_CLOSED, STARTER_URL, "Starter Grants");
    expect(result?.amountRaw).toContain("£40,000");
  });

  it("sets deadlineRaw to key dates text when no strong date present", () => {
    const result = parseAcMedSciPage(FIXTURE_CLOSED, STARTER_URL, "Starter Grants");
    expect(result?.deadlineRaw).toMatch(/closed/i);
  });
});

describe("parseAcMedSciPage (no h1, uses defaultTitle)", () => {
  it("falls back to defaultTitle", () => {
    const result = parseAcMedSciPage(FIXTURE_NO_H1, "https://acmedsci.ac.uk/networking-grants", "Networking Grants");
    expect(result?.title).toBe("Networking Grants");
  });
});

describe("normaliseAcMedSci", () => {
  it("sets source to acmedsci", () => {
    const raw = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard")!;
    const result = normaliseAcMedSci(raw);
    expect(result.source).toBe("acmedsci");
  });

  it("sets funder_slug to academy-of-medical-sciences", () => {
    const raw = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard")!;
    const result = normaliseAcMedSci(raw);
    expect(result.funder_slug).toBe("academy-of-medical-sciences");
  });

  it("parses amount_max from up-to text", () => {
    const raw = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard")!;
    const result = normaliseAcMedSci(raw);
    expect(result.amount_max).toBe(12_500_000); // £125,000 in pence
    expect(result.amount_min).toBeNull();
  });

  it("parses deadline_date from strong tag date", () => {
    const raw = parseAcMedSciPage(FIXTURE_OPEN, SPRINGBOARD_URL, "Springboard")!;
    const result = normaliseAcMedSci(raw);
    expect(result.deadline_date).toBe("2026-12-11");
  });

  it("sets deadline_date to null for closed scheme with no date", () => {
    const raw = parseAcMedSciPage(FIXTURE_CLOSED, STARTER_URL, "Starter Grants")!;
    const result = normaliseAcMedSci(raw);
    expect(result.deadline_date).toBeNull();
  });
});
