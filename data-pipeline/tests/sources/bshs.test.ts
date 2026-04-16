import { parseBshsPage } from "../../src/sources/bshs";
import { normaliseBshs } from "../../src/transforms/normalise-bshs";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>

<!-- Section 1: Master's Degree Bursaries (future deadline) -->
<section class="elementor-section">
  <div class="e-con-boxed">
    <div class="elementor-menu-anchor" id="masters_bursaries"></div>
    <div class="e-con">
      <!-- Left column -->
      <div class="e-con">
        <div class="elementor-widget-heading">
          <h2 class="elementor-heading-title elementor-size-default">Master's Degree Bursaries</h2>
        </div>
        <div class="elementor-widget-heading">
          <h4 class="elementor-heading-title elementor-size-default">Next submission deadline
15 May 2026</h4>
        </div>
      </div>
      <!-- Right column -->
      <div class="e-con">
        <div class="elementor-widget-text-editor">
          <p>Contact: <a href="mailto:office@bshs.org.uk">office@bshs.org.uk</a></p>
          <p>The BSHS offers up to 3 bursaries of <strong>£4,000</strong> each to support students taking a Master's degree in the history of science, technology or medicine.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Section 2: Butler-Eyles Travel Grants (past deadline) -->
<section class="elementor-section">
  <div class="e-con-boxed">
    <div class="elementor-menu-anchor" id="butler-eyles_grant"></div>
    <div class="e-con">
      <div class="e-con">
        <div class="elementor-widget-heading">
          <h2 class="elementor-heading-title elementor-size-default">Butler-Eyles Travel Grants</h2>
        </div>
        <div class="elementor-widget-heading">
          <h4 class="elementor-heading-title elementor-size-default">Next submission deadline:
15 April 2026</h4>
        </div>
      </div>
      <div class="e-con">
        <div class="elementor-widget-text-editor">
          <p>The Society makes grants (up to £75) towards travel costs for members attending conferences.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Section 3: Carer Grants (paused) -->
<section class="elementor-section">
  <div class="e-con-boxed">
    <div class="elementor-menu-anchor" id="carer_grants"></div>
    <div class="e-con">
      <div class="e-con">
        <div class="elementor-widget-heading">
          <h2 class="elementor-heading-title elementor-size-default">Carer Grants</h2>
        </div>
        <div class="elementor-widget-heading">
          <h4 class="elementor-heading-title elementor-size-default">Paused</h4>
        </div>
      </div>
      <div class="e-con">
        <div class="elementor-widget-text-editor">
          <p>Grants of up to £100 to assist members who need to arrange childcare or other care responsibilities.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Section 4: Research Grants (no specific deadline date) -->
<section class="elementor-section">
  <div class="e-con-boxed">
    <div class="elementor-menu-anchor" id="research_grant"></div>
    <div class="e-con">
      <div class="e-con">
        <div class="elementor-widget-heading">
          <h2 class="elementor-heading-title elementor-size-default">Research Grants</h2>
        </div>
        <div class="elementor-widget-heading">
          <h4 class="elementor-heading-title elementor-size-default">Submission rounds
31 March &amp; 30 September</h4>
        </div>
      </div>
      <div class="e-con">
        <div class="elementor-widget-text-editor">
          <p>The Society offers small grants (from £50 to £500) to support research in the history of science.</p>
        </div>
      </div>
    </div>
  </div>
</section>

</main>
</body>
</html>`;

const FIXTURE_EMPTY = `
<html><body><main><p>No grants listed.</p></main></body></html>`;

describe("parseBshsPage", () => {
  it("parses 4 grant sections", () => {
    const results = parseBshsPage(FIXTURE);
    expect(results).toHaveLength(4);
  });

  it("extracts title from h2.elementor-heading-title", () => {
    const results = parseBshsPage(FIXTURE);
    expect(results[0].title).toBe("Master's Degree Bursaries");
  });

  it("extracts deadline date from h4 containing 'deadline'", () => {
    const results = parseBshsPage(FIXTURE);
    expect(results[0].deadlineRaw).toContain("May 2026");
  });

  it("handles 'Next submission deadline:' with colon", () => {
    const results = parseBshsPage(FIXTURE);
    expect(results[1].deadlineRaw).toContain("April 2026");
  });

  it("sets status open for future deadline", () => {
    const results = parseBshsPage(FIXTURE);
    expect(results[0].status).toBe("open");
  });

  it("sets status closed for past deadline", () => {
    const results = parseBshsPage(FIXTURE);
    // April 15 2026 deadline has passed
    expect(results[1].status).toBe("closed");
  });

  it("sets status closed for Paused section", () => {
    const results = parseBshsPage(FIXTURE);
    const carer = results.find(r => r.title === "Carer Grants");
    expect(carer?.status).toBe("closed");
  });

  it("extracts £ amount from prose paragraphs", () => {
    const results = parseBshsPage(FIXTURE);
    expect(results[0].amountRaw).toContain("£4,000");
  });

  it("extracts range amount", () => {
    const results = parseBshsPage(FIXTURE);
    const research = results.find(r => r.title === "Research Grants");
    expect(research?.amountRaw).toContain("£50");
  });

  it("extracts description from prose", () => {
    const results = parseBshsPage(FIXTURE);
    expect(results[0].description).toContain("Master's degree");
  });

  it("does not include Contact: paragraph as description", () => {
    const results = parseBshsPage(FIXTURE);
    expect(results[0].description).not.toContain("Contact:");
  });

  it("deduplicates entries with same title", () => {
    const html = `
      <html><body>
      <section class="elementor-section"><div class="e-con-boxed">
        <div class="e-con"><div class="e-con"><div class="elementor-widget-heading">
          <h2 class="elementor-heading-title">Research Grants</h2>
        </div></div></div>
      </div></section>
      <section class="elementor-section"><div class="e-con-boxed">
        <div class="e-con"><div class="e-con"><div class="elementor-widget-heading">
          <h2 class="elementor-heading-title">Research Grants</h2>
        </div></div></div>
      </div></section>
      </body></html>`;
    expect(parseBshsPage(html)).toHaveLength(1);
  });

  it("returns empty array when no h2.elementor-heading-title found", () => {
    expect(parseBshsPage(FIXTURE_EMPTY)).toHaveLength(0);
  });
});

describe("normaliseBshs", () => {
  const raw = {
    title: "Master's Degree Bursaries",
    url: "https://www.bshs.org.uk/grants",
    status: "open",
    description: "Up to 3 bursaries of £4,000 each for history of science students.",
    amountRaw: "£4,000",
    deadlineRaw: "15 May 2026",
    eligibility: null,
  };

  it("sets source to bshs", () => {
    expect(normaliseBshs(raw).source).toBe("bshs");
  });

  it("sets funder_slug to bshs", () => {
    expect(normaliseBshs(raw).funder_slug).toBe("bshs");
  });

  it("sets funder_name", () => {
    expect(normaliseBshs(raw).funder_name).toBe("British Society for the History of Science");
  });

  it("parses amount_max in pence", () => {
    expect(normaliseBshs(raw).amount_max).toBe(400_000);
  });

  it("parses deadline_date", () => {
    expect(normaliseBshs(raw).deadline_date).toBe("2026-05-15");
  });

  it("sets funding_type to grant for research bursaries", () => {
    expect(normaliseBshs(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to fellowship for engagement fellowship", () => {
    const fellowRaw = { ...raw, title: "BSHS Engagement Fellowships" };
    expect(normaliseBshs(fellowRaw).funding_type).toBe("fellowship");
  });

  it("sets funding_type to bursary for travel grants", () => {
    const travelRaw = { ...raw, title: "Butler-Eyles Travel Grants" };
    expect(normaliseBshs(travelRaw).funding_type).toBe("bursary");
  });

  it("sets funding_type to prize for prizes", () => {
    const prizeRaw = { ...raw, title: "Singer Prize" };
    expect(normaliseBshs(prizeRaw).funding_type).toBe("prize");
  });

  it("sets scope to null", () => {
    expect(normaliseBshs(raw).scope).toBeNull();
  });

  it("generates a slug", () => {
    expect(normaliseBshs(raw).slug).toBe("masters-degree-bursaries");
  });
});
