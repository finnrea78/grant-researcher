import { parseHenryMoorePage } from "../../src/sources/henry-moore";

// Minimal fixture matching real Henry Moore Foundation HTML structure
const FIXTURE_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
<section class="c-container">
  <div class="o-wrapper">
    <div class="c-container__blocks">

      <!-- Grant categories section -->
      <h3 class="inpage c-col-title c-col-title--large">New Projects and Commissions</h3>
      <div class="c-masthead__intro c-wysiwyg">
        <p>For exhibitions, exhibition catalogues and sculpture commissions.</p>
        <p>The maximum grant available in this category is £20,000.</p>
      </div>

      <h3 class="c-col-title c-col-title--large">Acquisitions and Collections</h3>
      <div class="c-masthead__intro c-wysiwyg">
        <p>To acquire new sculptural works for collections, or to conserve sculpture in existing collections.</p>
        <p>The maximum grant available in this category is £20,000.</p>
      </div>

      <h3 class="c-col-title c-col-title--large">Long-Term Research grants</h3>
      <div class="c-masthead__intro c-wysiwyg">
        <p>To support extended research projects requiring funding for more than one year.</p>
        <p>The maximum grant available in this category is £20,000.</p>
      </div>

      <h3 class="c-col-title c-col-title--small">Types of project we do not support</h3>
      <div class="c-masthead__intro">
        <p>Residency programmes, central or building costs.</p>
      </div>

      <!-- Seasonal windows section -->
      <div class="c-col c-col-text-area u-light-green-bg">
        <h3>Spring</h3>
        <p><strong>Applications are now open</strong></p>
        <p>Submissions close 1 March, 23:00</p>
        <p>For projects starting no sooner than 1 July</p>
      </div>

      <div class="c-col c-col-text-area">
        <h3>Summer</h3>
        <p>Applications open 1 May, 9:00</p>
        <p>Submissions close 1 June, 23:00</p>
        <p>For projects starting no sooner than 1 October</p>
      </div>

    </div>
  </div>
</section>
</body>
</html>`;

const FIXTURE_ALL_CLOSED = FIXTURE_HTML.replace(
  "Applications are now open",
  "Applications open 1 February, 9:00"
);

describe("parseHenryMoorePage", () => {
  it("extracts all recognised grant categories", () => {
    const result = parseHenryMoorePage(FIXTURE_HTML);
    expect(result).toHaveLength(3);
  });

  it("maps category titles", () => {
    const result = parseHenryMoorePage(FIXTURE_HTML);
    expect(result[0].title).toBe("New Projects and Commissions");
    expect(result[1].title).toBe("Acquisitions and Collections");
    expect(result[2].title).toBe("Long-Term Research grants");
  });

  it("excludes c-col-title--small headings", () => {
    const result = parseHenryMoorePage(FIXTURE_HTML);
    const titles = result.map(r => r.title);
    expect(titles).not.toContain("Types of project we do not support");
  });

  it("detects open status when Spring window is open", () => {
    const result = parseHenryMoorePage(FIXTURE_HTML);
    expect(result[0].status).toBe("open");
  });

  it("detects closed status when no window is currently open", () => {
    const result = parseHenryMoorePage(FIXTURE_ALL_CLOSED);
    expect(result[0].status).toBe("closed");
  });

  it("extracts deadline from the open window", () => {
    const result = parseHenryMoorePage(FIXTURE_HTML);
    expect(result[0].deadlineRaw).toBe("1 March, 23:00");
  });

  it("extracts max amount from description text", () => {
    const result = parseHenryMoorePage(FIXTURE_HTML);
    expect(result[0].amountRaw).toBe("£20,000");
  });

  it("extracts description text", () => {
    const result = parseHenryMoorePage(FIXTURE_HTML);
    expect(result[0].description).toContain("exhibitions, exhibition catalogues");
  });

  it("sets open window name on result", () => {
    const result = parseHenryMoorePage(FIXTURE_HTML);
    expect(result[0].openWindow).toBe("Spring");
  });

  it("throws on page with no grant categories", () => {
    expect(() =>
      parseHenryMoorePage("<html><body><main></main></body></html>")
    ).toThrow();
  });
});
