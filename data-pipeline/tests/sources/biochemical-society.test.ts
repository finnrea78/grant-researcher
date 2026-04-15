import { parseBiochemPage } from "../../src/sources/biochemical-society";
import { normaliseBiochem } from "../../src/transforms/normalise-biochemical-society";

const FIXTURE = `
<!DOCTYPE html>
<html lang="en">
<body>
<main class="listing-page">
  <div class="search-results-page__tile-listings">
    <div class="tile-list results-list">

      <div class="content-tile">
        <a href="/grants-and-awards/grants-and-bursaries/general-travel-grants/" target="_self">
          <div class="content-tile__content-wrapper hover-underline-animation">
            <div class="content-tile__headline-wrapper">
              <p class="subheading-one">Conference and Travel Grants</p>
            </div>
            <div class="content-tile__content">
              <h5>General Travel Grants</h5>
              <p>Funding of up to £1,000 to support attendance at face-to-face scientific meetings, workshops, and training courses.</p>
            </div>
          </div>
        </a>
      </div>

      <div class="content-tile">
        <a href="/grants-and-awards/grants-and-bursaries/lab-visit-grants/" target="_self">
          <div class="content-tile__content-wrapper hover-underline-animation">
            <div class="content-tile__headline-wrapper">
              <p class="subheading-one">Research and Career Development</p>
            </div>
            <div class="content-tile__content">
              <h5>Lab Visit Grants</h5>
              <p>Funding of up to £2,000 to support visits to a laboratory to learn new techniques or undertake a collaborative project.</p>
            </div>
          </div>
        </a>
      </div>

      <div class="content-tile">
        <a href="/grants-and-awards/grants-and-bursaries/edi-grants/" target="_self">
          <div class="content-tile__content-wrapper hover-underline-animation">
            <div class="content-tile__headline-wrapper">
              <p class="subheading-one">Equity, Diversity and Inclusion</p>
            </div>
            <div class="content-tile__content">
              <h5>EDI Grants</h5>
              <p>Funding of up to £1,000 to support activities and initiatives that promote equity, diversity and inclusion in the biosciences.</p>
            </div>
          </div>
        </a>
      </div>

      <div class="content-tile">
        <a href="/grants-and-awards/grants-and-bursaries/open-access-bursaries/" target="_self">
          <div class="content-tile__content-wrapper hover-underline-animation">
            <div class="content-tile__headline-wrapper">
              <p class="subheading-one">Open Access</p>
            </div>
            <div class="content-tile__content">
              <h5>Open Access Bursaries</h5>
              <p>Support for early-career researchers to publish their research open access in Biochemical Society journals.</p>
            </div>
          </div>
        </a>
      </div>

    </div>
  </div>
</main>
</body>
</html>`;

describe("parseBiochemPage", () => {
  it("extracts all grant cards", () => {
    const result = parseBiochemPage(FIXTURE);
    expect(result).toHaveLength(4);
  });

  it("extracts grant title from h5", () => {
    const result = parseBiochemPage(FIXTURE);
    expect(result[0].title).toBe("General Travel Grants");
  });

  it("extracts grant category from subheading-one", () => {
    const result = parseBiochemPage(FIXTURE);
    expect(result[0].category).toBe("Conference and Travel Grants");
  });

  it("extracts description from content p", () => {
    const result = parseBiochemPage(FIXTURE);
    expect(result[0].description).toContain("up to £1,000");
  });

  it("sets amountRaw to description text when it contains £", () => {
    const result = parseBiochemPage(FIXTURE);
    expect(result[0].amountRaw).toContain("£1,000");
  });

  it("sets amountRaw to null when no £ in description", () => {
    const result = parseBiochemPage(FIXTURE);
    const openAccess = result.find(r => r.title === "Open Access Bursaries");
    expect(openAccess?.amountRaw).toBeNull();
  });

  it("constructs absolute URL from relative href", () => {
    const result = parseBiochemPage(FIXTURE);
    expect(result[0].url).toMatch(/^https:\/\/www\.biochemistry\.org/);
  });

  it("sets status to open for all grants", () => {
    const result = parseBiochemPage(FIXTURE);
    expect(result.every(r => r.status === "open")).toBe(true);
  });
});

describe("normaliseBiochem", () => {
  it("sets source to biochemical_society", () => {
    const raw = parseBiochemPage(FIXTURE)[0];
    const result = normaliseBiochem(raw);
    expect(result.source).toBe("biochemical_society");
  });

  it("sets funder_slug to biochemical-society", () => {
    const raw = parseBiochemPage(FIXTURE)[0];
    const result = normaliseBiochem(raw);
    expect(result.funder_slug).toBe("biochemical-society");
  });

  it("parses amount_max from up-to text", () => {
    const raw = parseBiochemPage(FIXTURE)[0]; // up to £1,000
    const result = normaliseBiochem(raw);
    expect(result.amount_max).toBe(100_000); // £1,000 in pence
    expect(result.amount_min).toBeNull();
  });

  it("sets deadline fields to null (no deadline on listing page)", () => {
    const raw = parseBiochemPage(FIXTURE)[0];
    const result = normaliseBiochem(raw);
    expect(result.deadline_date).toBeNull();
    expect(result.deadline_raw).toBeNull();
  });

  it("stores category in source_metadata", () => {
    const raw = parseBiochemPage(FIXTURE)[0];
    const result = normaliseBiochem(raw);
    expect(result.source_metadata.category).toBe("Conference and Travel Grants");
  });
});
