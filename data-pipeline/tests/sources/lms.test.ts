import { parseLmsPage, parseLmsDetailPage } from "../../src/sources/lms";
import { normaliseLms } from "../../src/transforms/normalise-lms";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<div class="field field--name-body field--type-text-with-summary field--label-hidden field--item">
  <p>The Society offers a number of <a href="https://lms.ac.uk/grants/research-grants">research grants</a> for mathematicians.</p>
  <p>Policy is <a href="https://www.lms.ac.uk/grants/general-policy-on-grant-making">here</a>.</p>
  <p><strong><a href="https://www.lms.ac.uk/grants/atiyah-uk-lebanon-fellowships" target="_blank">Atiyah UK-Lebanon Fellowships </a></strong>- Up to £8,600 available.</p>
  <p><strong><a href="https://www.lms.ac.uk/grants/interdisciplinary" target="_blank">LMS Interdisciplinary Collaboration Grants</a></strong>&nbsp;- up to £400 available.</p>
  <p><strong>Research Grants Committee - Grants</strong></p>
  <ul>
    <li><b>Scheme 1:&nbsp;<a href="https://www.lms.ac.uk/grants/conference-grants-scheme-1" target="_blank">Conference and Workshop Grants</a></b>&nbsp;- up to £7,000 available. Scheme 1 award success rate 2024/25: 60%</li>
    <li><b>Scheme 2:&nbsp;<a href="https://www.lms.ac.uk/grants/visits-uk-scheme-2" target="_blank">Visiting Speakers to the UK</a></b>&nbsp;- up to £2,000 available.</li>
    <li><strong><a href="https://www.lms.ac.uk/grants/mathematics-in-africa" target="_blank">Mathematics in Africa Grants</a>&nbsp;</strong>- up to £2,000 available.</li>
    <li><a href="https://www.lms.ac.uk/grants/lms-travel-grants-icms-and-ecms" target="_blank"><strong>LMS Travel Grants to ICMs and ECMs</strong></a></li>
  </ul>
  <p><strong>Early Career Research Committee - Grants</strong></p>
  <ul>
    <li><a href="https://www.lms.ac.uk/grants/undergraduate-research-bursaries/applications" target="_blank"><strong>Undergraduate Research Bursaries </strong></a>- up to £2,000 available.</li>
    <li><a href="https://www.lms.ac.uk/grants/lms-early-career-fellowships" target="_blank"><strong>LMS Early Career Fellowships</strong></a> - up to £11,180 available.</li>
    <li><a href="https://www.lms.ac.uk/prizes/cecil-king-travel-scholarship" target="_blank"><strong>Cecil King Travel Scholarships</strong></a> - up to £6,000 available.</li>
  </ul>
  <p><a href="https://www.lms.ac.uk/grants/other-sources">Other Sources of Funding</a></p>
</div>
</body>
</html>`;

const FIXTURE_NO_BODY = `
<!DOCTYPE html>
<html><body><p>No field here.</p></body></html>`;

describe("parseLmsPage", () => {
  it("parses multiple grant entries", () => {
    const results = parseLmsPage(FIXTURE);
    expect(results.length).toBeGreaterThanOrEqual(8);
  });

  it("extracts title from strong-wrapped link in p tag", () => {
    const results = parseLmsPage(FIXTURE);
    const atiyah = results.find(r => r.title.includes("Atiyah"));
    expect(atiyah).toBeDefined();
    expect(atiyah?.title).toContain("Atiyah UK-Lebanon Fellowships");
  });

  it("extracts title from bold-wrapped scheme link in li", () => {
    const results = parseLmsPage(FIXTURE);
    const conf = results.find(r => r.title === "Conference and Workshop Grants");
    expect(conf).toBeDefined();
  });

  it("extracts title from link-wrapping-strong pattern", () => {
    const results = parseLmsPage(FIXTURE);
    const bursary = results.find(r => r.title.includes("Undergraduate Research Bursaries"));
    expect(bursary).toBeDefined();
  });

  it("extracts amount from element text", () => {
    const results = parseLmsPage(FIXTURE);
    const atiyah = results.find(r => r.title.includes("Atiyah"));
    expect(atiyah?.amountRaw).toContain("£8,600");
  });

  it("sets amountRaw to null when no £ in element", () => {
    const results = parseLmsPage(FIXTURE);
    const travel = results.find(r => r.title.includes("ICMs and ECMs"));
    expect(travel).toBeDefined();
    expect(travel?.amountRaw).toBeNull();
  });

  it("sets status to open for all entries", () => {
    const results = parseLmsPage(FIXTURE);
    results.forEach(r => expect(r.status).toBe("open"));
  });

  it("skips prose-level category links (no bold wrapper)", () => {
    const results = parseLmsPage(FIXTURE);
    // "research grants" appears in plain-text <p> with no bold
    expect(results.find(r => r.title === "research grants")).toBeUndefined();
  });

  it("skips general-policy page link", () => {
    const results = parseLmsPage(FIXTURE);
    expect(results.find(r => r.url.includes("general-policy"))).toBeUndefined();
  });

  it("skips other-sources link", () => {
    const results = parseLmsPage(FIXTURE);
    expect(results.find(r => r.url.includes("other-sources"))).toBeUndefined();
  });

  it("de-duplicates entries that appear in multiple sections", () => {
    const results = parseLmsPage(FIXTURE);
    const urls = results.map(r => r.url);
    expect(urls.length).toBe(new Set(urls).size);
  });

  it("returns empty array when body field not found", () => {
    expect(parseLmsPage(FIXTURE_NO_BODY)).toHaveLength(0);
  });

  it("includes prizes path (Cecil King)", () => {
    const results = parseLmsPage(FIXTURE);
    const cecilKing = results.find(r => r.url.includes("prizes"));
    expect(cecilKing).toBeDefined();
  });
});

const DETAIL_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <div class="field--name-body">
    <p>The LMS Interdisciplinary Collaboration Grants support universities in hosting joint lectures and events that connect mathematics with other disciplines, such as medicine or engineering.</p>
    <p>Grants of £400 per event are available, with a total fund of £4,000 supporting up to 10 events per year.</p>
    <h3>Eligibility</h3>
    <p>Applications must be submitted by the LMS Representative at an eligible UK university. Events must be held in the United Kingdom.</p>
    <h3>Deadlines</h3>
    <p>Applications close on 15 October 2025, 22 January 2026, and 15 May 2026.</p>
  </div>
</main>
</body>
</html>`;

describe("parseLmsDetailPage", () => {
  it("extracts description from content paragraphs", () => {
    const result = parseLmsDetailPage(DETAIL_FIXTURE);
    expect(result.description).not.toBeNull();
    expect(result.description).toContain("Interdisciplinary Collaboration Grants");
  });

  it("extracts eligibility section", () => {
    const result = parseLmsDetailPage(DETAIL_FIXTURE);
    expect(result.eligibility).not.toBeNull();
    expect(result.eligibility).toContain("LMS Representative");
  });

  it("returns null description for sparse pages", () => {
    const result = parseLmsDetailPage("<html><body><p>Short.</p></body></html>");
    expect(result.description).toBeNull();
    expect(result.eligibility).toBeNull();
  });
});

describe("normaliseLms", () => {
  const raw = {
    title: "Conference and Workshop Grants",
    url: "https://www.lms.ac.uk/grants/conference-grants-scheme-1",
    status: "open",
    description: null,
    eligibility: null,
    deadlineRaw: null,
    amountRaw: "£7,000",
  };

  it("sets source to lms", () => {
    expect(normaliseLms(raw).source).toBe("lms");
  });

  it("sets funder_slug to london-mathematical-society", () => {
    expect(normaliseLms(raw).funder_slug).toBe("london-mathematical-society");
  });

  it("parses amount_max", () => {
    expect(normaliseLms(raw).amount_max).toBe(700_000); // £7,000 in pence
  });

  it("sets deadline_date to null when no date in deadlineRaw", () => {
    expect(normaliseLms(raw).deadline_date).toBeNull();
  });

  it("parses deadline_date from deadlineRaw with a full date", () => {
    const withDeadline = { ...raw, deadlineRaw: "15 October 2025" };
    expect(normaliseLms(withDeadline).deadline_date).toBe("2025-10-15");
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    expect(normaliseLms(raw).scope).toBeNull();
  });

  it("sets funding_type to fellowship for fellowship entries", () => {
    const fellowshipRaw = { ...raw, title: "LMS Early Career Fellowships" };
    expect(normaliseLms(fellowshipRaw).funding_type).toBe("fellowship");
  });

  it("sets funding_type to studentship for bursary entries", () => {
    const bursaryRaw = { ...raw, title: "Undergraduate Research Bursaries" };
    expect(normaliseLms(bursaryRaw).funding_type).toBe("studentship");
  });

  it("sets funding_type to grant for standard entries", () => {
    expect(normaliseLms(raw).funding_type).toBe("grant");
  });

  it("generates a slug from the title", () => {
    expect(normaliseLms(raw).slug).toBe("conference-and-workshop-grants");
  });
});
