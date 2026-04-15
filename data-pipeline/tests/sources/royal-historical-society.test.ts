import { parseRhsPage } from "../../src/sources/royal-historical-society";
import { normaliseRhs } from "../../src/transforms/normalise-royal-historical-society";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<div class="entry-content">

<p>The Society awards nearly £150,000 in small grant funding annually.</p>

<ul>
<li><a href="https://royalhistsoc.org/research_funding/postgraduate-research-funding/"><strong>Postgraduate Research Funding</strong></a> for historians studying for a History Masters or PhD</li>
<li><a href="https://royalhistsoc.org/research_funding/early-career-research-funding/"><strong>Early Career Research Funding</strong></a> for historians within 5 years of completing a doctorate</li>
</ul>

<hr />

<h3><span style="color: #003366;">Current open calls for research funding, to 5 June 2026</span></h3>

<p>The Society currently invites applications for the following programmes:</p>

<ul>
<li><a href="https://royalhistsoc.org/research_funding/international-research-support-grants/"><strong>International Research Support Grants</strong></a> provide funding of up to <strong>£1000</strong> per award for International Fellows outside the UK. <strong>Next closing date: Friday 8 May 2026</strong>.</li>
</ul>

<hr />

<ul>
<li><a href="https://royalhistsoc.org/research_funding/postgraduate-research-funding/pgr-research-support-grants/"><strong>Postgraduate Research Support Grants</strong></a> provide funding of either <strong>£500 or £1000</strong> to postgraduate researchers. <strong>Next closing date: Friday 5 June 2026.</strong></li>
<li><a href="https://royalhistsoc.org/research_funding/scouloudi-panel-grants/"><strong>Scouloudi Panel Grants</strong></a> provide funding of <strong>£1500</strong> to enable the creation of panels at academic conferences. <strong>Next closing date: Friday 5 June 2026.</strong></li>
</ul>

<hr />

<p>All enquiries should be sent to the Society's Grants Manager.</p>

</div>
</main>
</body>
</html>`;

const FIXTURE_PAST_DEADLINE = `
<!DOCTYPE html>
<html>
<body>
<main><div class="entry-content">
<h3>Current open calls for research funding, to 1 January 2024</h3>
<ul>
<li><a href="https://royalhistsoc.org/research_funding/old-grant/"><strong>Old Grant</strong></a> provides funding of <strong>£500</strong>. <strong>Next closing date: Friday 1 January 2024.</strong></li>
</ul>
</div></main>
</body>
</html>`;

const FIXTURE_NO_OPEN_CALLS = `
<!DOCTYPE html>
<html><body><main><div class="entry-content">
<h3>About our grants</h3>
<p>We offer various grants.</p>
</div></main></body></html>`;

describe("parseRhsPage", () => {
  it("parses entries from Current open calls section", () => {
    const results = parseRhsPage(FIXTURE);
    expect(results).toHaveLength(3);
  });

  it("extracts title from strong inside link", () => {
    const results = parseRhsPage(FIXTURE);
    expect(results[0].title).toBe("International Research Support Grants");
  });

  it("extracts absolute URL", () => {
    const results = parseRhsPage(FIXTURE);
    expect(results[0].url).toContain("royalhistsoc.org");
  });

  it("extracts deadline from 'Next closing date' text", () => {
    const results = parseRhsPage(FIXTURE);
    expect(results[0].deadlineRaw).toContain("May 2026");
  });

  it("extracts amount from bold £ value", () => {
    const results = parseRhsPage(FIXTURE);
    expect(results[0].amountRaw).toContain("£1000");
  });

  it("extracts range amount '£500 or £1000'", () => {
    const results = parseRhsPage(FIXTURE);
    const pgr = results.find(r => r.title.includes("Postgraduate Research Support"));
    expect(pgr?.amountRaw).toContain("£500");
  });

  it("sets status to open for future deadlines", () => {
    const results = parseRhsPage(FIXTURE);
    results.forEach(r => expect(r.status).toBe("open"));
  });

  it("sets status to closed for past deadline", () => {
    const results = parseRhsPage(FIXTURE_PAST_DEADLINE);
    expect(results[0].status).toBe("closed");
  });

  it("does not include non-open-call links (overview links above h3)", () => {
    const results = parseRhsPage(FIXTURE);
    expect(results.map(r => r.title)).not.toContain("Postgraduate Research Funding");
  });

  it("returns empty array when no Current open calls h3", () => {
    expect(parseRhsPage(FIXTURE_NO_OPEN_CALLS)).toHaveLength(0);
  });
});

describe("normaliseRhs", () => {
  const raw = {
    title: "Postgraduate Research Support Grants",
    url: "https://royalhistsoc.org/research_funding/postgraduate-research-funding/pgr-research-support-grants/",
    status: "open",
    description: "Provide funding of either £500 or £1000 to postgraduate researchers.",
    amountRaw: "£500 or £1000",
    deadlineRaw: "5 June 2026",
    eligibility: null,
  };

  it("sets source to royal_historical_society", () => {
    expect(normaliseRhs(raw).source).toBe("royal_historical_society");
  });

  it("sets funder_slug to royal-historical-society", () => {
    expect(normaliseRhs(raw).funder_slug).toBe("royal-historical-society");
  });

  it("parses deadline_date from DD Month YYYY", () => {
    expect(normaliseRhs(raw).deadline_date).toBe("2026-06-05");
  });

  it("parses amount_max from range taking higher value", () => {
    expect(normaliseRhs(raw).amount_max).toBe(100_000); // £1,000 in pence
  });

  it("sets funding_type to grant", () => {
    expect(normaliseRhs(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to fellowship for fellowship entries", () => {
    const fellowRaw = { ...raw, title: "David Berry Fellowship" };
    expect(normaliseRhs(fellowRaw).funding_type).toBe("fellowship");
  });

  it("generates a slug", () => {
    expect(normaliseRhs(raw).slug).toBe("postgraduate-research-support-grants");
  });
});
