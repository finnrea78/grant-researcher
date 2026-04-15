import { parseEndocrinologyPage, parseEndocrinologyDetailPage } from "../../src/sources/endocrinology";
import { normaliseEndocrinology } from "../../src/transforms/normalise-endocrinology";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<div class="row">

<div class="col-sm-6 mt-4 grant-type grant-full-members grant-early-career ">
  <div class="list-group">
    <a href="/grants-and-awards/grants/travel-grant/" class="link list-group-item pt-4">
      <div>
        <h3 class="h5 sfe-txt-navy">Travel Grant</h3>
        <div>To support members&#x2019; travel to endocrine conferences and educational meetings.</div>
      </div>
    </a>
  </div>
</div>

<div class="col-sm-6 mt-4 grant-type grant-full-members ">
  <div class="list-group">
    <a href="/grants-and-awards/grants/research-grant/" class="link list-group-item pt-4">
      <div>
        <h3 class="h5 sfe-txt-navy">Research Grant</h3>
        <div>To support members&#x2019; research and audit activities.</div>
      </div>
    </a>
  </div>
</div>

<div class="col-sm-6 mt-4 grant-type grant-students ">
  <div class="list-group">
    <a href="/grants-and-awards/grants/outreach-grant/" class="link list-group-item pt-4">
      <div>
        <h3 class="h5 sfe-txt-navy">Outreach Grant</h3>
        <div>Funding for members and patient support groups for outreach activities.</div>
      </div>
    </a>
  </div>
</div>

<div class="col-sm-6 mt-4 grant-type grant-full-members ">
  <div class="list-group">
    <a href="/grants-and-awards/grants-review/" class="link list-group-item pt-4">
      <div>
        <h3 class="h5 sfe-txt-navy">Grants Review</h3>
        <div>See all available grant schemes.</div>
      </div>
    </a>
  </div>
</div>

</div>
</main>
</body>
</html>`;

const FIXTURE_EMPTY = `
<!DOCTYPE html>
<html><body><main><div class="row"></div></main></body></html>`;

const FIXTURE_DETAIL = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Travel Grant</h1>
  <p>The Society for Endocrinology Travel Grant provides up to £500 to support members attending endocrine conferences and educational meetings worldwide.</p>
  <p>Grants are available for UK-based members wishing to attend major international or national endocrinology meetings where they are presenting work.</p>
  <h3>Eligibility</h3>
  <p>Applicants must be full members of the Society for Endocrinology and based at a UK institution.</p>
  <p>Deadline: 1 March 2026. Applications submitted via the online portal.</p>
</main>
</body>
</html>`;

describe("parseEndocrinologyPage", () => {
  it("parses grant-type div entries", () => {
    const results = parseEndocrinologyPage(FIXTURE);
    expect(results).toHaveLength(3); // Grants Review excluded
  });

  it("extracts title from h3.sfe-txt-navy", () => {
    const results = parseEndocrinologyPage(FIXTURE);
    expect(results[0].title).toBe("Travel Grant");
  });

  it("builds absolute URL from relative href", () => {
    const results = parseEndocrinologyPage(FIXTURE);
    expect(results[0].url).toBe("https://www.endocrinology.org/grants-and-awards/grants/travel-grant/");
  });

  it("extracts description from div after h3", () => {
    const results = parseEndocrinologyPage(FIXTURE);
    expect(results[0].description).toContain("endocrine conferences");
  });

  it("skips Grants Review meta-section title", () => {
    const results = parseEndocrinologyPage(FIXTURE);
    expect(results.map(r => r.title)).not.toContain("Grants Review");
  });

  it("sets status to open by default", () => {
    const results = parseEndocrinologyPage(FIXTURE);
    results.forEach(r => expect(r.status).toBe("open"));
  });

  it("sets amountRaw to null (not on listing page)", () => {
    const results = parseEndocrinologyPage(FIXTURE);
    results.forEach(r => expect(r.amountRaw).toBeNull());
  });

  it("de-duplicates repeated entries", () => {
    const results = parseEndocrinologyPage(FIXTURE);
    const urls = results.map(r => r.url);
    expect(urls.length).toBe(new Set(urls).size);
  });

  it("returns empty array when no grant-type divs", () => {
    expect(parseEndocrinologyPage(FIXTURE_EMPTY)).toHaveLength(0);
  });
});

describe("parseEndocrinologyDetailPage", () => {
  it("extracts multi-paragraph description", () => {
    const result = parseEndocrinologyDetailPage(FIXTURE_DETAIL);
    expect(result.description).not.toBeNull();
    expect(result.description).toContain("Travel Grant provides");
  });

  it("extracts eligibility from eligibility heading section", () => {
    const result = parseEndocrinologyDetailPage(FIXTURE_DETAIL);
    expect(result.eligibility).not.toBeNull();
    expect(result.eligibility).toContain("full members of the Society");
  });

  it("extracts amount from body text", () => {
    const result = parseEndocrinologyDetailPage(FIXTURE_DETAIL);
    expect(result.amountRaw).toContain("£500");
  });

  it("extracts deadline from body text", () => {
    const result = parseEndocrinologyDetailPage(FIXTURE_DETAIL);
    expect(result.deadlineRaw).toContain("March 2026");
  });
});

describe("normaliseEndocrinology", () => {
  const raw = {
    title: "Travel Grant",
    url: "https://www.endocrinology.org/grants-and-awards/grants/travel-grant/",
    status: "open",
    description: "To support members' travel to endocrine conferences.",
    eligibility: "Must be a full member of the Society for Endocrinology.",
    amountRaw: null,
    deadlineRaw: null,
  };

  it("sets source to endocrinology", () => {
    expect(normaliseEndocrinology(raw).source).toBe("endocrinology");
  });

  it("sets funder_slug to society-for-endocrinology", () => {
    expect(normaliseEndocrinology(raw).funder_slug).toBe("society-for-endocrinology");
  });

  it("sets funding_type to grant", () => {
    expect(normaliseEndocrinology(raw).funding_type).toBe("grant");
  });

  it("sets deadline_date to null", () => {
    expect(normaliseEndocrinology(raw).deadline_date).toBeNull();
  });

  it("sets amount_max to null", () => {
    expect(normaliseEndocrinology(raw).amount_max).toBeNull();
  });

  it("sets scope to null", () => {
    expect(normaliseEndocrinology(raw).scope).toBeNull();
  });

  it("generates a slug from the title", () => {
    expect(normaliseEndocrinology(raw).slug).toBe("travel-grant");
  });

  it("maps eligibility field", () => {
    expect(normaliseEndocrinology(raw).eligibility).toContain("full member");
  });
});
