import { parseGeolsocPage } from "../../src/sources/geolsoc";
import { normaliseGeolsoc } from "../../src/transforms/normalise-geolsoc";

// Fixture simulating a CLOSED cycle (deadline in the past)
const FIXTURE_CLOSED = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <div class="umb-block-grid__layout-item">
    <p>The grants cycle opens in autumn each year with applications for this year's research grants and bursaries having closed on 9 February 2026.</p>
  </div>

  <div id="055a157d-grants" class="accordion">
    <div class="accordion-item">
      <h2 class="accordion-header">
        <button class="accordion-button collapsed" type="button">Mike Coward Fund</button>
      </h2>
      <div class="accordion-collapse collapse">
        <div class="accordion-body">
          <p>For fieldwork in structural geology as applied to regional tectonics. Average award is £1,750.</p>
        </div>
      </div>
    </div>

    <div class="accordion-item">
      <h2 class="accordion-header">
        <button class="accordion-button collapsed" type="button">Robert Scott Memorial Award</button>
      </h2>
      <div class="accordion-collapse collapse">
        <div class="accordion-body">
          <p>For geological fieldwork in remote areas. An award of £2,200 each year.</p>
          <a href="/careers-and-training/grants-and-bursaries/robert-scott/" class="btn--primary">Find out more</a>
        </div>
      </div>
    </div>

    <div class="accordion-item">
      <h2 class="accordion-header">
        <button class="accordion-button collapsed" type="button">Allowable costs</button>
      </h2>
      <div class="accordion-collapse collapse">
        <div class="accordion-body">
          <p>Field equipment, consumables, travel and accommodation costs are allowable.</p>
        </div>
      </div>
    </div>
  </div>
</main>
</body>
</html>`;

// Fixture simulating an OPEN cycle (future deadline)
const FIXTURE_OPEN = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <div class="umb-block-grid__layout-item">
    <p>Applications for this year's research grants closes on 15 February 2027.</p>
  </div>

  <div id="grants-accordion" class="accordion">
    <div class="accordion-item">
      <h2 class="accordion-header">
        <button class="accordion-button" type="button">Hazel Prichard Student Bursary</button>
      </h2>
      <div class="accordion-collapse">
        <div class="accordion-body">
          <p>For UK-based geology students. Up to £3,000 available for undergraduate or postgraduate fieldwork projects.</p>
        </div>
      </div>
    </div>
  </div>
</main>
</body>
</html>`;

describe("parseGeolsocPage (closed cycle)", () => {
  it("extracts grant entries, excluding guidance accordions", () => {
    const result = parseGeolsocPage(FIXTURE_CLOSED);
    expect(result.length).toBe(2); // Mike Coward + Robert Scott; Allowable costs filtered
  });

  it("extracts grant name from accordion button", () => {
    const result = parseGeolsocPage(FIXTURE_CLOSED);
    expect(result[0].name).toBe("Mike Coward Fund");
  });

  it("extracts description from first accordion body p", () => {
    const result = parseGeolsocPage(FIXTURE_CLOSED);
    expect(result[0].description).toContain("structural geology");
  });

  it("sets status to closed when cycle deadline is in the past", () => {
    const result = parseGeolsocPage(FIXTURE_CLOSED);
    expect(result.every(r => r.status === "closed")).toBe(true);
  });

  it("extracts cycle deadline", () => {
    const result = parseGeolsocPage(FIXTURE_CLOSED);
    expect(result[0].deadlineRaw).toBe("9 February 2026");
  });

  it("extracts amount from description prose", () => {
    const result = parseGeolsocPage(FIXTURE_CLOSED);
    const scott = result.find(r => r.name.includes("Robert Scott"));
    expect(scott?.amountRaw).toContain("£2,200");
  });

  it("builds sub-page URL for grants with Find out more link", () => {
    const result = parseGeolsocPage(FIXTURE_CLOSED);
    const scott = result.find(r => r.name.includes("Robert Scott"));
    expect(scott?.url).toMatch(/geolsoc\.org\.uk.*robert-scott/);
  });
});

describe("parseGeolsocPage (open cycle)", () => {
  it("sets status to open when cycle deadline is in the future", () => {
    const result = parseGeolsocPage(FIXTURE_OPEN);
    expect(result[0].status).toBe("open");
  });

  it("extracts amount with 'Up to' prefix", () => {
    const result = parseGeolsocPage(FIXTURE_OPEN);
    expect(result[0].amountRaw).toContain("£3,000");
  });
});

describe("normaliseGeolsoc", () => {
  it("sets source to geolsoc", () => {
    const raw = parseGeolsocPage(FIXTURE_CLOSED)[0];
    const result = normaliseGeolsoc(raw);
    expect(result.source).toBe("geolsoc");
  });

  it("sets funder_slug to geological-society-of-london", () => {
    const raw = parseGeolsocPage(FIXTURE_CLOSED)[0];
    const result = normaliseGeolsoc(raw);
    expect(result.funder_slug).toBe("geological-society-of-london");
  });

  it("parses deadline_date from cycle deadline", () => {
    const raw = parseGeolsocPage(FIXTURE_CLOSED)[0];
    const result = normaliseGeolsoc(raw);
    expect(result.deadline_date).toBe("2026-02-09");
  });

  it("parses amount_min from prose amount", () => {
    const raw = parseGeolsocPage(FIXTURE_CLOSED).find(r => r.name.includes("Robert Scott"))!;
    const result = normaliseGeolsoc(raw);
    expect(result.amount_min).toBe(220_000); // £2,200 in pence
  });

  it("parses amount_max from up-to amount", () => {
    const raw = parseGeolsocPage(FIXTURE_OPEN)[0];
    const result = normaliseGeolsoc(raw);
    expect(result.amount_max).toBe(300_000); // £3,000 in pence
  });
});
