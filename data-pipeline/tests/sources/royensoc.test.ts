import { parseRoyEnSocPage, parseRoyEnSocDetailPage } from "../../src/sources/royensoc";
import { normaliseRoyEnSoc } from "../../src/transforms/normalise-royensoc";

const GRANTS_URL = "https://www.royensoc.co.uk/membership-and-community/awards-and-grants/";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<article class="post-type-page">
<div class="entry-content">

<h2 class="wp-block-heading">Grants and Funding</h2>

<div class="wp-block-columns is-layout-flex">
  <div class="wp-block-column is-layout-flow" style="flex-basis:160px">
    <figure class="wp-block-image"><img src="photo.jpg" alt="" /></figure>
  </div>
  <div class="wp-block-column is-vertically-aligned-center is-content-justification-left">
    <h3 class="wp-block-heading"><a href="https://www.royensoc.co.uk/small-project-grants/">Small Project Grants</a></h3>
    <p>Supports research projects in entomology that advance the science.</p>
    <p><strong>RES Fellows and Members</strong> can apply for up to £3,000.</p>
  </div>
</div>

<div class="wp-block-columns is-layout-flex">
  <div class="wp-block-column is-layout-flow" style="flex-basis:160px">
    <figure class="wp-block-image"><img src="photo2.jpg" alt="" /></figure>
  </div>
  <div class="wp-block-column is-vertically-aligned-center is-content-justification-left">
    <h3 class="wp-block-heading"><a href="https://www.royensoc.co.uk/student-outreach-fund/">Student Outreach Fund</a> &#8211; Open</h3>
    <p>Supports the communication and public engagement activities of students.</p>
    <p>RES Student Members can apply for up to £500.</p>
  </div>
</div>

<div class="wp-block-columns is-layout-flex">
  <div class="wp-block-column is-layout-flow" style="flex-basis:160px">
    <figure class="wp-block-image"><img src="photo3.jpg" alt="" /></figure>
  </div>
  <div class="wp-block-column is-vertically-aligned-center is-content-justification-left">
    <h3 class="wp-block-heading"><a href="https://www.royensoc.co.uk/higher-education-bursaries/">Higher Education Bursaries</a> &#8211; Open</h3>
    <p>Provides bursary funds to support postgraduate students in entomology.</p>
    <p>Higher Education institutions in UK &amp; ROI can apply for up to £30,000 over 3 years.</p>
  </div>
</div>

<h2 class="wp-block-heading">Awards and Recognition</h2>

<div class="wp-block-columns is-layout-flex">
  <div class="wp-block-column is-layout-flow" style="flex-basis:160px">
    <figure class="wp-block-image"><img src="photo4.jpg" alt="" /></figure>
  </div>
  <div class="wp-block-column is-vertically-aligned-center is-content-justification-left">
    <h3 class="wp-block-heading"><a href="https://www.royensoc.co.uk/wigglesworth-award/">Wigglesworth Award</a></h3>
    <p>For outstanding services to entomology.</p>
  </div>
</div>

</div>
</article>
</main>
</body>
</html>`;

const FIXTURE_NO_GRANTS = `
<!DOCTYPE html>
<html>
<body>
<main><article><div class="entry-content">
<h2>Awards and Recognition</h2>
<div class="wp-block-columns is-layout-flex">
  <div class="wp-block-column" style="flex-basis:160px"><figure><img src="x.jpg"/></figure></div>
  <div class="wp-block-column is-vertically-aligned-center is-content-justification-left">
    <h3><a href="/award/">Some Award</a></h3>
    <p>Award description.</p>
  </div>
</div>
</div></article></main>
</body>
</html>`;

describe("parseRoyEnSocPage", () => {
  it("parses all grants in the Grants and Funding section", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    expect(results).toHaveLength(3);
  });

  it("extracts title from h3 a link text", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    expect(results[0].title).toBe("Small Project Grants");
  });

  it("extracts URL from h3 a href (absolute)", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    expect(results[0].url).toBe("https://www.royensoc.co.uk/small-project-grants/");
  });

  it("extracts description from first paragraph", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    expect(results[0].description).toContain("research projects in entomology");
  });

  it("extracts amount from paragraph containing £", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    expect(results[0].amountRaw).toContain("£3,000");
  });

  it("sets status to open by default (no closed marker)", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    expect(results[0].status).toBe("open");
  });

  it("sets status to open when h3 has Open label", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    expect(results[1].status).toBe("open");
  });

  it("does not include Awards and Recognition section entries", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    expect(results.map(r => r.title)).not.toContain("Wigglesworth Award");
  });

  it("returns empty array when no Grants and Funding section", () => {
    const results = parseRoyEnSocPage(FIXTURE_NO_GRANTS);
    expect(results).toHaveLength(0);
  });

  it("extracts amount from Higher Education Bursaries", () => {
    const results = parseRoyEnSocPage(FIXTURE);
    const bursaries = results.find(r => r.title === "Higher Education Bursaries");
    expect(bursaries?.amountRaw).toContain("£30,000");
  });
});

const DETAIL_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<article>
  <p>The Small Project Grants support high-quality, innovative and standalone research projects in entomology. Projects must have a primary focus on insect science, though other terrestrial and freshwater arthropods will be considered.</p>
  <p>All awards are made for a maximum period of 12 months and must meet the highest publishable and international standard.</p>
  <h3>Eligibility</h3>
  <p>Applicants must hold RES Fellow, Member, or Student Member status. The society welcomes applications from entomologists at all career stages, particularly students and early career researchers.</p>
  <h3>Application deadline</h3>
  <p>Applications close on 15 January 2026.</p>
</article>
</main>
</body>
</html>`;

describe("parseRoyEnSocDetailPage", () => {
  it("extracts description from article paragraphs", () => {
    const result = parseRoyEnSocDetailPage(DETAIL_FIXTURE);
    expect(result.description).not.toBeNull();
    expect(result.description).toContain("Small Project Grants");
  });

  it("extracts eligibility section", () => {
    const result = parseRoyEnSocDetailPage(DETAIL_FIXTURE);
    expect(result.eligibility).not.toBeNull();
    expect(result.eligibility).toContain("RES Fellow");
  });

  it("returns null for missing fields on sparse pages", () => {
    const result = parseRoyEnSocDetailPage("<html><body><p>Short.</p></body></html>");
    expect(result.description).toBeNull();
    expect(result.eligibility).toBeNull();
  });
});

describe("normaliseRoyEnSoc", () => {
  const raw = {
    title: "Small Project Grants",
    url: "https://www.royensoc.co.uk/small-project-grants/",
    status: "open",
    description: "Supports research projects in entomology.",
    eligibility: null,
    deadlineRaw: null,
    amountRaw: "RES Fellows and Members can apply for up to £3,000.",
  };

  it("sets source to royensoc", () => {
    expect(normaliseRoyEnSoc(raw).source).toBe("royensoc");
  });

  it("sets funder_slug to royal-entomological-society", () => {
    expect(normaliseRoyEnSoc(raw).funder_slug).toBe("royal-entomological-society");
  });

  it("parses amount_max for up-to grants", () => {
    const result = normaliseRoyEnSoc(raw);
    expect(result.amount_max).toBe(300_000); // £3,000 in pence
    expect(result.amount_min).toBeNull();
  });

  it("sets deadline_date to null (no deadlines on page)", () => {
    expect(normaliseRoyEnSoc(raw).deadline_date).toBeNull();
  });

  it("sets funding_type to bursary for bursary entries", () => {
    const bursaryRaw = { ...raw, title: "Higher Education Bursaries" };
    expect(normaliseRoyEnSoc(bursaryRaw).funding_type).toBe("bursary");
  });

  it("sets funding_type to grant for standard entries", () => {
    expect(normaliseRoyEnSoc(raw).funding_type).toBe("grant");
  });

  it("generates a slug from the title", () => {
    expect(normaliseRoyEnSoc(raw).slug).toBe("small-project-grants");
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    expect(normaliseRoyEnSoc(raw).scope).toBeNull();
  });
});
