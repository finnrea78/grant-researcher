import { parseERCApplyPage } from "../../src/sources/erc";

// Minimal fixture matching real ERC apply-grant page structure (Drupal OpenEuropa theme)
const FIXTURE_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <div class="paragraph paragraph--type--oe-rich-text">
    <div class="card card-oe-rich d-flex flex-column h-100">
      <a href="https://erc.europa.eu/apply-grant/starting-grants" class="flex-wrap" arial-label="ERC Starting Grant">
        <div class="card-body">ERC Starting Grant</div>
        <div class="card-footer d-flex justify-content-end">
          <span>Explore</span>
        </div>
      </a>
    </div>
  </div>

  <div class="paragraph paragraph--type--oe-rich-text">
    <div class="card card-oe-rich d-flex flex-column h-100">
      <a href="https://erc.europa.eu/apply-grant/consolidator-grants" class="flex-wrap" arial-label="ERC Consolidator Grant">
        <div class="card-body">ERC Consolidator Grant</div>
        <div class="card-footer d-flex justify-content-end">
          <span>Explore</span>
        </div>
      </a>
    </div>
  </div>

  <div class="paragraph paragraph--type--oe-rich-text">
    <div class="card card-oe-rich d-flex flex-column h-100">
      <a href="https://erc.europa.eu/apply-grant/advanced-grants" class="flex-wrap" arial-label="ERC Advanced Grant">
        <div class="card-body">ERC Advanced Grant</div>
      </a>
    </div>
  </div>

  <!-- Should be excluded -->
  <div class="card card-oe-rich">
    <a href="https://youtube.com/playlist?list=abc" arial-label="ERC grants explained">
      <div class="card-body">ERC grants explained</div>
    </a>
  </div>

  <!-- Should be excluded -->
  <div class="card card-oe-rich">
    <a href="https://erc.europa.eu/apply-grant/non-european-researchers" arial-label="For non-EU researchers ">
      <div class="card-body">For non-EU researchers</div>
    </a>
  </div>

  <div class="card card-oe-rich d-flex flex-column h-100">
    <a href="https://erc.europa.eu/apply-grant/synergy-grants" class="flex-wrap" arial-label="ERC Synergy Grant">
      <div class="card-body">ERC Synergy Grant</div>
    </a>
  </div>

  <div class="card card-oe-rich d-flex flex-column h-100">
    <a href="https://erc.europa.eu/apply-grant/proof-concept" class="flex-wrap" arial-label="ERC Proof of Concept">
      <div class="card-body">ERC Proof of Concept</div>
    </a>
  </div>

  <div class="card card-oe-rich d-flex flex-column h-100">
    <a href="https://erc.europa.eu/apply-grant/erc-plus-grant" class="flex-wrap" arial-label="ERC Plus Grant">
      <div class="card-body">ERC Plus Grant</div>
    </a>
  </div>
</main>
</body>
</html>`;

describe("parseERCApplyPage", () => {
  it("extracts recognised ERC grant types", () => {
    const result = parseERCApplyPage(FIXTURE_HTML);
    expect(result).toHaveLength(6);
  });

  it("maps grant type title from arial-label", () => {
    const result = parseERCApplyPage(FIXTURE_HTML);
    const titles = result.map(r => r.title);
    expect(titles).toContain("ERC Starting Grant");
    expect(titles).toContain("ERC Consolidator Grant");
    expect(titles).toContain("ERC Advanced Grant");
    expect(titles).toContain("ERC Synergy Grant");
    expect(titles).toContain("ERC Proof of Concept");
    expect(titles).toContain("ERC Plus Grant");
  });

  it("excludes non-grant-type cards", () => {
    const result = parseERCApplyPage(FIXTURE_HTML);
    const titles = result.map(r => r.title);
    expect(titles).not.toContain("ERC grants explained");
    expect(titles).not.toContain("For non-EU researchers ");
  });

  it("uses absolute URL", () => {
    const result = parseERCApplyPage(FIXTURE_HTML);
    const stg = result.find(r => r.title === "ERC Starting Grant");
    expect(stg?.url).toBe("https://erc.europa.eu/apply-grant/starting-grants");
  });

  it("throws on page with no ERC grant cards", () => {
    expect(() =>
      parseERCApplyPage("<html><body><main></main></body></html>")
    ).toThrow();
  });
});
