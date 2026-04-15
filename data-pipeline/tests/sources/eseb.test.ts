import { parseEsebPage, parseEsebDetailPage } from "../../src/sources/eseb";
import { normaliseEseb } from "../../src/transforms/normalise-eseb";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<article>
<div class="entry-content">

<h2 class="wp-block-heading" id="conference-travel-award">Conference Travel Award</h2>
<p>ESEB offers travel stipends to attend the biennial ESEB congress, the EMPSEB, or the annual Evolution meeting of the Society for the Study of Evolution.</p>
<p><a href="https://eseb.org/prizes-funding/conference-travel-award/">More &#8230;</a></p>

<h2 class="wp-block-heading" id="equal-opportunities-initiative">Equal Opportunities Initiative</h2>
<p>This initiative aims at promoting gender equality and, more generally, equal opportunities within the society and also in the evolutionary biology community at large.</p>
<p><a href="https://eseb.org/prizes-funding/equal-opportunities-initiative/">More &#8230;</a></p>

<h2 class="wp-block-heading" id="godfrey-hewitt-mobility-award">Godfrey Hewitt Mobility Award</h2>
<p>The mobility award intends to support fieldwork or lab visits of young researchers.</p>
<p><a href="https://eseb.org/prizes-funding/godfrey-hewitt-mobility-award/">More &#8230;</a></p>

<h2 class="wp-block-heading" id="john-maynard-smith-prize">John Maynard Smith Prize</h2>
<p>Every year the society distinguishes an outstanding young evolutionary biologist with this award.</p>
<p><a href="https://eseb.org/prizes-funding/john-maynard-smith-prize/">More &#8230;</a></p>

<h2 class="wp-block-heading" id="outreach-fund">Outreach Initiative Funds</h2>
<p>The Outreach Initiative supports projects that promote evolution-related activities in order to improve public knowledge about evolution and evolutionary biology.</p>
<p><a href="https://eseb.org/prizes-funding/outreach-fund/">More &#8230;</a></p>

</div>
</article>
</body>
</html>`;

const FIXTURE_DETAIL = `
<!DOCTYPE html>
<html>
<body>
<article>
<div class="entry-content">
<h1>Conference Travel Award</h1>
<p>ESEB offers travel stipends to support early-career researchers attending the biennial ESEB congress, the EMPSEB, or the annual Evolution meeting of the Society for the Study of Evolution.</p>
<p>The award covers travel costs and registration fees up to a maximum of €500. Priority is given to PhD students and postdoctoral researchers presenting their work.</p>
<h2>Eligibility</h2>
<p>Applicants must be ESEB members and early-career researchers (PhD student or within 5 years of PhD completion). The applicant must be presenting at the target conference.</p>
<h2>How to Apply</h2>
<p>Submit a short application form via the ESEB website before the deadline.</p>
</div>
</article>
</body>
</html>`;

const FIXTURE_NO_CONTENT = `
<!DOCTYPE html>
<html><body><main><p>No entry-content here.</p></main></body></html>`;

describe("parseEsebPage", () => {
  it("parses all h2 sections as grant entries", () => {
    const results = parseEsebPage(FIXTURE);
    expect(results).toHaveLength(5);
  });

  it("extracts title from h2 text", () => {
    const results = parseEsebPage(FIXTURE);
    expect(results[0].title).toBe("Conference Travel Award");
  });

  it("extracts URL from More link following h2", () => {
    const results = parseEsebPage(FIXTURE);
    expect(results[0].url).toBe("https://eseb.org/prizes-funding/conference-travel-award/");
  });

  it("extracts description from first non-More p after h2", () => {
    const results = parseEsebPage(FIXTURE);
    expect(results[0].description).toContain("travel stipends");
  });

  it("sets status to open by default", () => {
    const results = parseEsebPage(FIXTURE);
    results.forEach(r => expect(r.status).toBe("open"));
  });

  it("sets amountRaw to null (not on listing page)", () => {
    const results = parseEsebPage(FIXTURE);
    results.forEach(r => expect(r.amountRaw).toBeNull());
  });

  it("sets eligibility to null initially (populated by detail fetch)", () => {
    const results = parseEsebPage(FIXTURE);
    results.forEach(r => expect(r.eligibility).toBeNull());
  });

  it("returns empty array when no entry-content", () => {
    expect(parseEsebPage(FIXTURE_NO_CONTENT)).toHaveLength(0);
  });
});

describe("parseEsebDetailPage", () => {
  it("extracts multi-paragraph description", () => {
    const result = parseEsebDetailPage(FIXTURE_DETAIL);
    expect(result.description).toContain("travel stipends");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility section", () => {
    const result = parseEsebDetailPage(FIXTURE_DETAIL);
    expect(result.eligibility).toContain("ESEB members");
  });

  it("description contains multiple paragraphs joined", () => {
    const result = parseEsebDetailPage(FIXTURE_DETAIL);
    expect(result.description).toContain("PhD students");
  });
});

describe("normaliseEseb", () => {
  const grantRaw = {
    title: "Conference Travel Award",
    url: "https://eseb.org/prizes-funding/conference-travel-award/",
    status: "open",
    description: "ESEB offers travel stipends.",
    amountRaw: null,
    eligibility: "Applicants must be ESEB members and early-career researchers.",
  };

  const prizeRaw = {
    title: "John Maynard Smith Prize",
    url: "https://eseb.org/prizes-funding/john-maynard-smith-prize/",
    status: "open",
    description: "Prize for outstanding young evolutionary biologist.",
    amountRaw: null,
    eligibility: null,
  };

  it("sets source to eseb", () => {
    expect(normaliseEseb(grantRaw).source).toBe("eseb");
  });

  it("sets funder_slug to eseb", () => {
    expect(normaliseEseb(grantRaw).funder_slug).toBe("eseb");
  });

  it("sets amount_currency to EUR", () => {
    expect(normaliseEseb(grantRaw).amount_currency).toBe("EUR");
  });

  it("sets funding_type to grant for travel awards", () => {
    expect(normaliseEseb(grantRaw).funding_type).toBe("grant");
  });

  it("sets funding_type to prize for prize entries", () => {
    expect(normaliseEseb(prizeRaw).funding_type).toBe("prize");
  });

  it("sets funding_type to grant for outreach fund", () => {
    const outreach = { ...grantRaw, title: "Outreach Initiative Funds" };
    expect(normaliseEseb(outreach).funding_type).toBe("grant");
  });

  it("sets deadline_date to null", () => {
    expect(normaliseEseb(grantRaw).deadline_date).toBeNull();
  });

  it("sets amount_max to null when amountRaw is null", () => {
    expect(normaliseEseb(grantRaw).amount_max).toBeNull();
  });

  it("generates a slug from the title", () => {
    expect(normaliseEseb(grantRaw).slug).toBe("conference-travel-award");
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    expect(normaliseEseb(grantRaw).scope).toBeNull();
  });

  it("passes through eligibility", () => {
    expect(normaliseEseb(grantRaw).eligibility).toContain("ESEB members");
  });

  it("passes through null eligibility", () => {
    expect(normaliseEseb(prizeRaw).eligibility).toBeNull();
  });
});
