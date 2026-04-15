import { parseBenhsGrantsPage } from "../../src/sources/benhs";
import { normaliseBenhs } from "../../src/transforms/normalise-benhs";

const PAGE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<div class="entry-content">

<h2>The following grants and awards are available from the Society:</h2>
<ul>
<li>Professor Hering Memorial Research Fund</li>
<li>Maitland Emmet BENHS Research Fund</li>
</ul>

<h2>GRANTS</h2>

<h2>AWARDS</h2>

<h2><a name="hering"></a>The Professor Hering Memorial Research Fund</h2>
<p>This fund supports entomological research, particularly into leaf miners, microlepidoptera and Diptera.</p>
<p>The work and travel are not limited to the British Isles. In total an award is unlikely to exceed £600 in 2026.</p>
<p>The closing date for applications is 30th April each year and awards will be made at the end of the following month.</p>

<h2><a name="emmet"></a>Maitland Emmet BENHS Research Fund and Grants</h2>
<p>The Society invites applications for grants to support research on insects and other invertebrates with reference to the British Fauna.</p>
<p>Preference will be given to work with a clear final objective. Individual grants are unlikely to exceed £1000.</p>
<p>The closing date for applications is 1st December each year and awards will be made in the following January.</p>

<h2><a name="bursary"></a>The BENHS student or early career travel bursary (closed)</h2>
<p>This bursary scheme is currently closed. The closing date for applications is 31 May 2022.</p>

<h2>The Marsh Award for Entomology</h2>
<p>The Marsh Award recognises individuals who have made outstanding contributions.</p>

<h2>The British Entomological and Natural History Society Commemorative Gold Medal</h2>
<p>Awarded for significant contributions to natural history.</p>

</div>
</body>
</html>`;

describe("parseBenhsGrantsPage", () => {
  it("parses exactly 2 open grant entries", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    expect(results.length).toBe(2);
  });

  it("skips GRANTS and AWARDS section headers", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    const titles = results.map(r => r.title);
    expect(titles).not.toContain("GRANTS");
    expect(titles).not.toContain("AWARDS");
  });

  it("skips closed bursary", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    const titles = results.map(r => r.title);
    expect(titles).not.toContain("The BENHS student or early career travel bursary");
  });

  it("skips Marsh Award (honorary)", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    const titles = results.map(r => r.title);
    expect(titles).not.toContain("The Marsh Award for Entomology");
  });

  it("skips Gold Medal (honorary)", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    const titles = results.map(r => r.title);
    expect(titles.some(t => t.includes("Gold Medal"))).toBe(false);
  });

  it("extracts Hering Fund title", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    expect(results[0].title).toBe("The Professor Hering Memorial Research Fund");
  });

  it("extracts Emmet Fund title", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    expect(results[1].title).toContain("Maitland Emmet");
  });

  it("extracts Hering Fund amount", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    expect(results[0].amountRaw).toContain("£600");
  });

  it("extracts Emmet Fund amount", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    expect(results[1].amountRaw).toContain("£1000");
  });

  it("resolves Hering Fund deadline to April (future or next year)", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    expect(results[0].deadlineRaw).toContain("April");
  });

  it("resolves Emmet Fund deadline to December", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    expect(results[1].deadlineRaw).toContain("December");
  });

  it("deadline is a future or current year date", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    for (const r of results) {
      if (r.deadlineRaw) {
        expect(r.deadlineRaw).toMatch(/\d{4}/);
      }
    }
  });

  it("deduplicates repeated entries (content rendered twice)", () => {
    // Duplicate the fixture to simulate WPBakery double-render
    const doubleFixture = PAGE_FIXTURE + PAGE_FIXTURE;
    const results = parseBenhsGrantsPage(doubleFixture);
    expect(results.length).toBe(2);
  });

  it("extracts multi-paragraph description", () => {
    const results = parseBenhsGrantsPage(PAGE_FIXTURE);
    expect(results[0].description).toContain("entomological research");
    expect(results[0].description!.length).toBeGreaterThan(80);
  });
});

describe("normaliseBenhs", () => {
  const raw = {
    title: "The Professor Hering Memorial Research Fund",
    url: "https://benhs.org.uk/grants-and-awards/",
    status: "open",
    description: "Supports entomological research into leaf miners and Diptera.",
    amountRaw: "up to £600",
    deadlineRaw: "30 April 2026",
    eligibility: null,
  };

  it("sets source to benhs", () => {
    expect(normaliseBenhs(raw).source).toBe("benhs");
  });

  it("sets funder_slug to benhs", () => {
    expect(normaliseBenhs(raw).funder_slug).toBe("benhs");
  });

  it("sets funder_name", () => {
    expect(normaliseBenhs(raw).funder_name).toBe("British Entomological and Natural History Society");
  });

  it("parses amount_max from up to £600", () => {
    expect(normaliseBenhs(raw).amount_max).toBe(60_000);
  });

  it("sets funding_type to grant", () => {
    expect(normaliseBenhs(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to bursary for travel bursary", () => {
    const bursaryRaw = { ...raw, title: "BENHS Travel Bursary" };
    expect(normaliseBenhs(bursaryRaw).funding_type).toBe("bursary");
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    expect(normaliseBenhs(raw).scope).toBeNull();
  });

  it("generates a slug", () => {
    expect(normaliseBenhs(raw).slug).toBe("the-professor-hering-memorial-research-fund");
  });

  it("parses deadline_date", () => {
    expect(normaliseBenhs(raw).deadline_date).toBe("2026-04-30");
  });
});
