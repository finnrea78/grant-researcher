import { parseBouOverviewPage, parseBouGrantPage } from "../../src/sources/bou";
import { normaliseBou } from "../../src/transforms/normalise-bou";

const OVERVIEW_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<div class="fusion-builder-row">

  <div class="link_box">
    <div class="link_box_title"><h3>Young Ornithologists' Award</h3></div>
    <div class="link_box_text"><p>Support for early career researchers in ornithology. Up to £500 per award.</p></div>
    <a class="link_box_button" href="/funding/young-ornithologists-award/">Apply</a>
  </div>

  <div class="link_box">
    <div class="link_box_title"><h3>BOU Research Fund</h3></div>
    <div class="link_box_text"><p>Supports ornithological research projects. Grants up to £2,000 available.</p></div>
    <a class="link_box_button" href="/funding/bou-research-fund/">Apply</a>
  </div>

  <div class="link_box">
    <div class="link_box_title"><h3>Travel Bursary</h3></div>
    <div class="link_box_text"><p>Bursaries to support travel to international conferences.</p></div>
    <a class="link_box_button" href="https://bou.org.uk/funding/travel-bursary/">Apply</a>
  </div>

  <div class="link_box">
    <div class="link_box_title"><h3>Duplicate Award</h3></div>
    <div class="link_box_text"><p>Some duplicate entry.</p></div>
    <a class="link_box_button" href="/funding/duplicate/">Apply</a>
  </div>

  <div class="link_box">
    <div class="link_box_title"><h3>Duplicate Award</h3></div>
    <div class="link_box_text"><p>Some duplicate entry.</p></div>
    <a class="link_box_button" href="/funding/duplicate/">Apply</a>
  </div>

  <div class="link_box">
    <div class="link_box_title"><h3>No Link Box</h3></div>
    <div class="link_box_text"><p>This card has no button link.</p></div>
  </div>

</div>
</body>
</html>`;

const GRANT_PAGE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<article>
  <span class="entry-title">BOU Research Fund</span>
  <div class="fusion-post-content">
    <p>The BOU Research Fund provides grants of up to £2,000 to ornithologists conducting original research on birds.</p>
    <p><strong>Closing date for applications: 31 March 2026</strong></p>
    <p>Applications should be submitted via the online portal.</p>
    <h3>Eligibility</h3>
    <p>Applicants must be members of the BOU. The fund is open to researchers at any career stage, from students to established professionals.</p>
  </div>
</article>
</body>
</html>`;

const GRANT_PAGE_DEADLINE2_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<article>
  <h1 class="entry-title">Young Ornithologists Award</h1>
  <div class="fusion-post-content">
    <p>Open to researchers under 35 years of age. Awards of £500 available.</p>
    <p>Application deadline: 15 June 2026</p>
  </div>
</article>
</body>
</html>`;

const GRANT_PAGE_NO_DEADLINE = `
<!DOCTYPE html>
<html>
<body>
<article>
  <span class="entry-title">Travel Bursary</span>
  <main>
    <p>Travel bursaries are available on a rolling basis throughout the year.</p>
  </main>
</article>
</body>
</html>`;

describe("parseBouOverviewPage", () => {
  it("parses funding scheme cards", () => {
    const results = parseBouOverviewPage(OVERVIEW_FIXTURE);
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("extracts title from .link_box_title h3", () => {
    const results = parseBouOverviewPage(OVERVIEW_FIXTURE);
    expect(results[0].title).toBe("Young Ornithologists' Award");
  });

  it("builds absolute URL from relative href", () => {
    const results = parseBouOverviewPage(OVERVIEW_FIXTURE);
    expect(results[0].url).toBe("https://bou.org.uk/funding/young-ornithologists-award/");
  });

  it("preserves absolute URL unchanged", () => {
    const results = parseBouOverviewPage(OVERVIEW_FIXTURE);
    const travel = results.find(r => r.title === "Travel Bursary");
    expect(travel?.url).toBe("https://bou.org.uk/funding/travel-bursary/");
  });

  it("extracts description from .link_box_text p", () => {
    const results = parseBouOverviewPage(OVERVIEW_FIXTURE);
    expect(results[0].description).toContain("ornithology");
  });

  it("extracts amount from description text", () => {
    const results = parseBouOverviewPage(OVERVIEW_FIXTURE);
    expect(results[0].amountRaw).toContain("£500");
  });

  it("deduplicates cards with same title", () => {
    const results = parseBouOverviewPage(OVERVIEW_FIXTURE);
    const dups = results.filter(r => r.title === "Duplicate Award");
    expect(dups).toHaveLength(1);
  });

  it("skips cards with no link", () => {
    const results = parseBouOverviewPage(OVERVIEW_FIXTURE);
    expect(results.map(r => r.title)).not.toContain("No Link Box");
  });
});

describe("parseBouGrantPage", () => {
  it("extracts title from span.entry-title", () => {
    const result = parseBouGrantPage(GRANT_PAGE_FIXTURE);
    expect(result.title).toBe("BOU Research Fund");
  });

  it("extracts amount from prose", () => {
    const result = parseBouGrantPage(GRANT_PAGE_FIXTURE);
    expect(result.amountRaw).toContain("£2,000");
  });

  it("extracts deadline matching 'Closing date for applications:' format", () => {
    const result = parseBouGrantPage(GRANT_PAGE_FIXTURE);
    expect(result.deadlineRaw).toContain("March 2026");
  });

  it("extracts deadline matching 'Application deadline:' format", () => {
    const result = parseBouGrantPage(GRANT_PAGE_DEADLINE2_FIXTURE);
    expect(result.deadlineRaw).toContain("June 2026");
  });

  it("returns null deadlineRaw when no deadline found", () => {
    const result = parseBouGrantPage(GRANT_PAGE_NO_DEADLINE);
    expect(result.deadlineRaw).toBeNull();
  });

  it("marks past deadline as closed", () => {
    const past = `<html><body><span class="entry-title">Old Grant</span>
      <main><p>Closing date for applications: 1 January 2020</p></main></body></html>`;
    const result = parseBouGrantPage(past);
    expect(result.status).toBe("closed");
  });

  it("marks future deadline as open", () => {
    const result = parseBouGrantPage(GRANT_PAGE_DEADLINE2_FIXTURE);
    expect(result.status).toBe("open");
  });

  it("extracts multi-paragraph description", () => {
    const result = parseBouGrantPage(GRANT_PAGE_FIXTURE);
    expect(result.description).toContain("BOU Research Fund");
    expect(result.description!.length).toBeGreaterThan(80);
  });

  it("extracts eligibility from heading section", () => {
    const result = parseBouGrantPage(GRANT_PAGE_FIXTURE);
    expect(result.eligibility).toContain("members of the BOU");
  });

  it("returns null eligibility when no eligibility heading", () => {
    const result = parseBouGrantPage(GRANT_PAGE_NO_DEADLINE);
    expect(result.eligibility).toBeNull();
  });
});

describe("normaliseBou", () => {
  const raw = {
    title: "BOU Research Fund",
    url: "https://bou.org.uk/funding/bou-research-fund/",
    status: "open",
    description: "Supports ornithological research. Grants up to £2,000.",
    amountRaw: "up to £2,000",
    deadlineRaw: "31 March 2026",
    eligibility: null,
  };

  it("sets source to bou", () => {
    expect(normaliseBou(raw).source).toBe("bou");
  });

  it("sets funder_slug to british-ornithological-union", () => {
    expect(normaliseBou(raw).funder_slug).toBe("british-ornithological-union");
  });

  it("sets funder_name", () => {
    expect(normaliseBou(raw).funder_name).toBe("British Ornithological Union");
  });

  it("parses amount_max from 'up to £2,000'", () => {
    expect(normaliseBou(raw).amount_max).toBe(200_000);
  });

  it("sets funding_type to grant for research fund", () => {
    expect(normaliseBou(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to fellowship for fellowship entries", () => {
    const fellowRaw = { ...raw, title: "BOU Research Fellowship" };
    expect(normaliseBou(fellowRaw).funding_type).toBe("fellowship");
  });

  it("sets funding_type to bursary for travel bursary", () => {
    const bursaryRaw = { ...raw, title: "Travel Bursary" };
    expect(normaliseBou(bursaryRaw).funding_type).toBe("bursary");
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    expect(normaliseBou(raw).scope).toBeNull();
  });

  it("passes through eligibility", () => {
    const withElig = { ...raw, eligibility: "Must be a BOU member." };
    expect(normaliseBou(withElig).eligibility).toContain("BOU member");
  });

  it("generates a slug", () => {
    expect(normaliseBou(raw).slug).toBe("bou-research-fund");
  });

  it("parses deadline_date", () => {
    expect(normaliseBou(raw).deadline_date).toBe("2026-03-31");
  });
});
