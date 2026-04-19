import { parseRgsPage, parseRgsDetailPage } from "../../src/sources/rgs";
import { normaliseRgs } from "../../src/transforms/normalise-rgs";

// Fixture with a future deadline (open) and past deadline (closed)
const FIXTURE = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <section id="richTextd40">
    <div class="RichTextstyles__Content-sc-13i15kp-2 fmmPSv">
      <h2>Grant deadlines 2025/2026</h2>

      <h3>23 November</h3>
      <ul>
        <li>
          <p><a href="/exploration/grants/research-grants/dudley-stamp-memorial-award/" title="Dudley Stamp Memorial Award">Dudley Stamp Memorial Award</a></p>
        </li>
        <li>
          <p><a href="/exploration/grants/student-grants/rgs-ibg-postgraduate-research-awards/" title="RGS-IBG Postgraduate Research Awards">RGS-IBG Postgraduate Research Awards</a></p>
          <ul>
            <li>
              <p><a href="/exploration/grants/student-grants/phd-grants/geographical-club-award/" title="Geographical Club Award">Geographical Club Award</a></p>
            </li>
            <li>
              <p><a href="/exploration/grants/student-grants/phd-grants/hong-kong-research-grant/" title="Hong Kong Research Award">Hong Kong Research Award</a></p>
            </li>
          </ul>
        </li>
      </ul>

      <h3>1 June</h3>
      <ul>
        <li>
          <p><a href="/exploration/grants/expedition-grants/environmental-expedition-award/" title="Environmental Expedition Award">Environmental Expedition Award</a></p>
        </li>
      </ul>
    </div>
  </section>
</main>
</body>
</html>`;

// Fixture without cycle year in h2 (fallback to current year logic)
const FIXTURE_NO_H2_YEAR = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <div class="RichTextstyles__Content-sc-13i15kp-2">
    <h2>Grant Deadlines</h2>
    <h3>15 December</h3>
    <ul>
      <li><a href="/exploration/grants/test-grant/" title="Test Grant">Test Grant</a></li>
    </ul>
  </div>
</main>
</body>
</html>`;

describe("parseRgsPage", () => {
  it("extracts top-level grants", () => {
    const result = parseRgsPage(FIXTURE);
    const names = result.map(r => r.name);
    expect(names).toContain("Dudley Stamp Memorial Award");
  });

  it("extracts nested sub-grants AND parent grant", () => {
    const result = parseRgsPage(FIXTURE);
    const names = result.map(r => r.name);
    expect(names).toContain("RGS-IBG Postgraduate Research Awards"); // parent
    expect(names).toContain("Geographical Club Award"); // sub-grant
    expect(names).toContain("Hong Kong Research Award"); // sub-grant
  });

  it("assigns November dates to 2025 in 2025/2026 cycle", () => {
    const result = parseRgsPage(FIXTURE);
    const dudley = result.find(r => r.name === "Dudley Stamp Memorial Award");
    expect(dudley?.deadlineRaw).toContain("2025");
  });

  it("assigns June dates to 2026 in 2025/2026 cycle", () => {
    const result = parseRgsPage(FIXTURE);
    const env = result.find(r => r.name === "Environmental Expedition Award");
    expect(env?.deadlineRaw).toContain("2026");
  });

  it("sets status to closed for November 2025 deadlines (past)", () => {
    const result = parseRgsPage(FIXTURE);
    const dudley = result.find(r => r.name === "Dudley Stamp Memorial Award");
    expect(dudley?.status).toBe("closed");
  });

  it("sets status to open for future June 2026 deadlines", () => {
    const result = parseRgsPage(FIXTURE);
    const env = result.find(r => r.name === "Environmental Expedition Award");
    expect(env?.status).toBe("open");
  });

  it("builds absolute URL from relative href", () => {
    const result = parseRgsPage(FIXTURE);
    const dudley = result.find(r => r.name === "Dudley Stamp Memorial Award");
    expect(dudley?.url).toMatch(/^https:\/\/www\.rgs\.org/);
  });

  it("handles fixture without cycle year h2", () => {
    const result = parseRgsPage(FIXTURE_NO_H2_YEAR);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Grant");
  });
});

describe("normaliseRgs", () => {
  it("sets source to rgs", () => {
    const raw = parseRgsPage(FIXTURE)[0];
    const result = normaliseRgs(raw);
    expect(result.source).toBe("rgs");
  });

  it("sets funder_slug to royal-geographical-society", () => {
    const raw = parseRgsPage(FIXTURE)[0];
    const result = normaliseRgs(raw);
    expect(result.funder_slug).toBe("royal-geographical-society");
  });

  it("parses deadline_date from deadlineRaw", () => {
    const raw = parseRgsPage(FIXTURE).find(r => r.name === "Dudley Stamp Memorial Award")!;
    const result = normaliseRgs(raw);
    expect(result.deadline_date).toBe("2025-11-23");
  });

  it("sets amount fields to null (amounts not on deadlines page)", () => {
    const raw = parseRgsPage(FIXTURE)[0];
    const result = normaliseRgs(raw);
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("sets scope to null (not hardcoded subject string)", () => {
    const raw = parseRgsPage(FIXTURE)[0];
    const result = normaliseRgs(raw);
    expect(result.scope).toBeNull();
  });
});

const RGS_DETAIL_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <section>
    <p>The Society offers awards of up to £2,500 for PhD students undertaking fieldwork and data collection to advance geographical knowledge. The programme was established to support postgraduate research.</p>
    <p>Named awards within this scheme include the Albert Reckitt Awards and the Dudley Stamp Memorial Award.</p>
    <h3>Eligibility</h3>
    <p>Applicants must be registered PhD students at UK Higher Education Institutions. Preference is given to students who do not receive full funding from a research council or university for fieldwork.</p>
  </section>
</main>
</body>
</html>`;

describe("parseRgsDetailPage", () => {
  it("extracts multi-paragraph description", () => {
    const { description } = parseRgsDetailPage(RGS_DETAIL_FIXTURE);
    expect(description).not.toBeNull();
    expect(description).toContain("fieldwork and data collection");
  });

  it("extracts eligibility from Eligibility heading", () => {
    const { eligibility } = parseRgsDetailPage(RGS_DETAIL_FIXTURE);
    expect(eligibility).not.toBeNull();
    expect(eligibility).toContain("PhD students at UK Higher Education");
  });

  it("returns nulls for empty page", () => {
    const { description, eligibility } = parseRgsDetailPage("<html><body><main></main></body></html>");
    expect(description).toBeNull();
    expect(eligibility).toBeNull();
  });
});
