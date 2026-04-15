import { parseEmboPage } from "../../src/sources/embo";
import { normaliseEmbo } from "../../src/transforms/normalise-embo";

const PAGE_URL = "https://www.embo.org/funding-awards/postdoctoral-fellowships/";

const FIXTURE_WITH_DEADLINE = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Postdoctoral Fellowships</h1>
  <p>Supporting internationally mobile postdoctoral researchers in Europe and around the world</p>
  <div class="content">
    <p>EMBO Postdoctoral Fellowships support excellent postdoctoral researchers.</p>
    <p><strong>Applications accepted throughout the year (next cutoff date – hard deadline: Friday 10 July 2026, 14:00 CEST)</strong></p>
    <p>Fellows receive a salary, travel allowance, and childcare support.</p>
  </div>
</main>
</body>
</html>`;

const FIXTURE_APRIL_DEADLINE = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Young Investigator Programme</h1>
  <p>Supporting young group leaders in Europe and beyond</p>
  <div class="content">
    <p>EMBO supports young group leaders.</p>
    <p><strong>Application deadline: 1 April</strong></p>
    <p>Award includes financial support and networking.</p>
  </div>
</main>
</body>
</html>`;

const FIXTURE_B_TAG_DEADLINE = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Installation Grants</h1>
  <p>Supporting group leaders who move to host countries</p>
  <div class="content">
    <b>Application deadline: 15 April</b>
    <p>Grants of up to 50,000 euros per year.</p>
  </div>
</main>
</body>
</html>`;

const FIXTURE_ROLLING = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Scientific Exchange Grants</h1>
  <p>Supporting international collaborations</p>
  <div class="content">
    <p>Applications accepted throughout the year for short research visits.</p>
  </div>
</main>
</body>
</html>`;

describe("parseEmboPage (with cutoff deadline)", () => {
  it("extracts title from h1", () => {
    const result = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    expect(result.title).toBe("Postdoctoral Fellowships");
  });

  it("extracts deadline from strong tag", () => {
    const result = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    expect(result.deadlineRaw).toContain("10 July 2026");
  });

  it("extracts parseable date from deadline raw", () => {
    const result = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    expect(result.deadlineDateRaw).toBe("10 July 2026");
  });

  it("extracts description from first p after h1", () => {
    const result = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    expect(result.description).toContain("internationally mobile");
  });

  it("sets status to open", () => {
    const result = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    expect(result.status).toBe("open");
  });
});

describe("parseEmboPage (April deadline, no year)", () => {
  it("extracts deadline from strong tag", () => {
    const result = parseEmboPage(FIXTURE_APRIL_DEADLINE, "https://www.embo.org/funding-awards/young-investigators/", "EMBO YIP", "fellowship");
    expect(result.deadlineRaw).toContain("1 April");
  });

  it("sets deadlineDateRaw to the partial date string", () => {
    const result = parseEmboPage(FIXTURE_APRIL_DEADLINE, "https://www.embo.org/funding-awards/young-investigators/", "EMBO YIP", "fellowship");
    expect(result.deadlineDateRaw).toBe("1 April");
  });
});

describe("parseEmboPage (b-tag deadline)", () => {
  it("extracts deadline from b tag", () => {
    const result = parseEmboPage(FIXTURE_B_TAG_DEADLINE, "https://www.embo.org/funding-awards/installation-grants/", "EMBO Installation Grants", "grant");
    expect(result.deadlineRaw).toContain("15 April");
  });
});

describe("parseEmboPage (rolling)", () => {
  it("sets deadlineRaw to rolling phrase when no structured deadline", () => {
    const result = parseEmboPage(FIXTURE_ROLLING, "https://www.embo.org/funding-awards/scientific-exchange-grants/", "EMBO Scientific Exchange Grants", "grant");
    expect(result.deadlineRaw).toMatch(/rolling|throughout the year/i);
  });

  it("sets status to open for rolling calls", () => {
    const result = parseEmboPage(FIXTURE_ROLLING, "https://www.embo.org/funding-awards/scientific-exchange-grants/", "EMBO Scientific Exchange Grants", "grant");
    expect(result.status).toBe("open");
  });
});

describe("normaliseEmbo", () => {
  it("sets source to embo", () => {
    const raw = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    const result = normaliseEmbo(raw);
    expect(result.source).toBe("embo");
  });

  it("sets funder_slug to embo", () => {
    const raw = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    const result = normaliseEmbo(raw);
    expect(result.funder_slug).toBe("embo");
  });

  it("parses deadline_date for full date deadline", () => {
    const raw = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    const result = normaliseEmbo(raw);
    expect(result.deadline_date).toBe("2026-07-10");
  });

  it("sets deadline_date to null when no year present", () => {
    const raw = parseEmboPage(FIXTURE_APRIL_DEADLINE, "https://www.embo.org/funding-awards/young-investigators/", "EMBO YIP", "fellowship");
    const result = normaliseEmbo(raw);
    // "1 April" without year → parseDate returns null
    expect(result.deadline_date).toBeNull();
  });

  it("sets amount fields to null (amounts not on landing pages)", () => {
    const raw = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    const result = normaliseEmbo(raw);
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("sets amount_currency to EUR", () => {
    const raw = parseEmboPage(FIXTURE_WITH_DEADLINE, PAGE_URL, "EMBO Postdoctoral Fellowships", "fellowship");
    const result = normaliseEmbo(raw);
    expect(result.amount_currency).toBe("EUR");
  });
});
