import { parseRc1851Page } from "../../src/sources/royal-commission-1851";
import { normaliseRc1851 } from "../../src/transforms/normalise-royal-commission-1851";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<div class="cta--grid-cell">
  <a class="cta--simple-link" href="/awards/research-fellowships/">
    <div class="cta--heading"><h2>Research Fellowships</h2></div>
    <div class="cta--copy"><p>Fellowships for early-career scientists and engineers to work in a different research environment.</p></div>
  </a>
</div>
<div class="cta--grid-cell">
  <a class="cta--simple-link" href="/awards/brunel-fellowship/">
    <div class="cta--heading"><h2>Brunel Research Fellowship</h2></div>
    <div class="cta--copy"><p>Mid-career fellowship for researchers in science, engineering or design.</p></div>
  </a>
</div>
<div class="cta--grid-cell">
  <a class="cta--simple-link" href="/awards/industrial-fellowships/">
    <div class="cta--heading"><h2>Industrial Fellowships</h2></div>
    <div class="cta--copy"><p>For engineers or scientists working in industry who wish to pursue research.</p></div>
  </a>
</div>
<div class="cta--grid-cell">
  <a class="cta--simple-link" href="/awards/industrial-design-studentships/">
    <div class="cta--heading"><h2>Industrial Design Studentships</h2></div>
    <div class="cta--copy"><p>Studentships for outstanding design graduates.</p></div>
  </a>
</div>
</main>
</body>
</html>`;

// Top-level nav links that should be filtered out
const FIXTURE_WITH_NAV = `
<!DOCTYPE html>
<html>
<body>
<main>
<div class="cta--grid-cell">
  <a class="cta--simple-link" href="/awards/">
    <div class="cta--heading"><h2>Awards Overview</h2></div>
  </a>
</div>
<div class="cta--grid-cell">
  <a class="cta--simple-link" href="/about-us/">
    <div class="cta--heading"><h2>About Us</h2></div>
  </a>
</div>
<div class="cta--grid-cell">
  <a class="cta--simple-link" href="/awards/research-fellowships/">
    <div class="cta--heading"><h2>Research Fellowships</h2></div>
    <div class="cta--copy"><p>Fellowships for early-career scientists.</p></div>
  </a>
</div>
</main>
</body>
</html>`;

const FIXTURE_ABSOLUTE_URL = `
<!DOCTYPE html>
<html>
<body>
<main>
<div class="cta--grid-cell">
  <a class="cta--simple-link" href="https://royalcommission1851.org/awards/enterprise-fellowships/">
    <div class="cta--heading"><h2>Enterprise Fellowships</h2></div>
    <div class="cta--copy"><p>Support for early career engineers and scientists with a business idea.</p></div>
  </a>
</div>
</main>
</body>
</html>`;

const FIXTURE_EMPTY = `
<!DOCTYPE html>
<html>
<body>
<main><p>No awards listed.</p></main>
</body>
</html>`;

describe("parseRc1851Page", () => {
  it("parses multiple award entries from grid cells", () => {
    const results = parseRc1851Page(FIXTURE);
    expect(results).toHaveLength(4);
  });

  it("extracts title from h2 inside link", () => {
    const results = parseRc1851Page(FIXTURE);
    expect(results[0].title).toBe("Research Fellowships");
  });

  it("resolves relative href to absolute URL", () => {
    const results = parseRc1851Page(FIXTURE);
    expect(results[0].url).toBe("https://royalcommission1851.org/awards/research-fellowships/");
  });

  it("preserves absolute href as-is", () => {
    const results = parseRc1851Page(FIXTURE_ABSOLUTE_URL);
    expect(results[0].url).toBe("https://royalcommission1851.org/awards/enterprise-fellowships/");
  });

  it("extracts description from cta--copy paragraph", () => {
    const results = parseRc1851Page(FIXTURE);
    expect(results[0].description).toContain("early-career scientists");
  });

  it("sets status to open", () => {
    const results = parseRc1851Page(FIXTURE);
    results.forEach(r => expect(r.status).toBe("open"));
  });

  it("sets amountRaw to null (amounts not on listing page)", () => {
    const results = parseRc1851Page(FIXTURE);
    results.forEach(r => expect(r.amountRaw).toBeNull());
  });

  it("filters out top-level nav links (/awards, /about-us)", () => {
    const results = parseRc1851Page(FIXTURE_WITH_NAV);
    const titles = results.map(r => r.title);
    expect(titles).not.toContain("Awards Overview");
    expect(titles).not.toContain("About Us");
    expect(titles).toContain("Research Fellowships");
  });

  it("deduplicates identical URLs", () => {
    const html = `
      <html><body>
      <div class="cta--grid-cell">
        <a class="cta--simple-link" href="/awards/research-fellowships/">
          <div class="cta--heading"><h2>Research Fellowships</h2></div>
        </a>
      </div>
      <div class="cta--grid-cell">
        <a class="cta--simple-link" href="/awards/research-fellowships/">
          <div class="cta--heading"><h2>Research Fellowships</h2></div>
        </a>
      </div>
      </body></html>`;
    const results = parseRc1851Page(html);
    expect(results).toHaveLength(1);
  });

  it("returns empty array when no grid cells", () => {
    expect(parseRc1851Page(FIXTURE_EMPTY)).toHaveLength(0);
  });

  it("includes studentship entries", () => {
    const results = parseRc1851Page(FIXTURE);
    expect(results.map(r => r.title)).toContain("Industrial Design Studentships");
  });
});

describe("normaliseRc1851", () => {
  const raw = {
    title: "Research Fellowships",
    url: "https://royalcommission1851.org/awards/research-fellowships/",
    status: "open",
    description: "Fellowships for early-career scientists and engineers.",
    amountRaw: null,
  };

  it("sets source to royal_commission_1851", () => {
    expect(normaliseRc1851(raw).source).toBe("royal_commission_1851");
  });

  it("sets funder_slug to royal-commission-1851", () => {
    expect(normaliseRc1851(raw).funder_slug).toBe("royal-commission-1851");
  });

  it("sets funder_name", () => {
    expect(normaliseRc1851(raw).funder_name).toBe("Royal Commission for the Exhibition of 1851");
  });

  it("sets funding_type to fellowship for fellowship entries", () => {
    expect(normaliseRc1851(raw).funding_type).toBe("fellowship");
  });

  it("sets funding_type to studentship for studentship entries", () => {
    const studentRaw = { ...raw, title: "Industrial Design Studentships" };
    expect(normaliseRc1851(studentRaw).funding_type).toBe("studentship");
  });

  it("sets funding_type to grant for non-fellowship non-studentship entries", () => {
    const grantRaw = { ...raw, title: "Sir Misha Black Awards" };
    expect(normaliseRc1851(grantRaw).funding_type).toBe("grant");
  });

  it("sets deadline_date to null (no deadlines on listing page)", () => {
    expect(normaliseRc1851(raw).deadline_date).toBeNull();
  });

  it("sets amount fields to null when amountRaw is null", () => {
    const result = normaliseRc1851(raw);
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("generates a slug", () => {
    expect(normaliseRc1851(raw).slug).toBe("research-fellowships");
  });

  it("sets scope to science, engineering, design, technology", () => {
    expect(normaliseRc1851(raw).scope).toContain("engineering");
  });
});
