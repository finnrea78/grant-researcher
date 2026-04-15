import { parseImaPage } from "../../src/sources/ima";
import { normaliseIma } from "../../src/transforms/normalise-ima";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main class="main">
<div class="page-header"><h1>Grants</h1></div>
<div class="row">

<article class="hero col-sm-12">
  <header>
    <h3 class="entry-title"><a href="https://ima.org.uk/support/grants/small-grant-scheme/">Small Grant Scheme</a></h3>
  </header>
  <div class="entry-summary">
    <p>The purpose of the Institute's Small Grant Scheme is to facilitate research activity in all areas of applicable mathematics. It is open to IMA members of all grades (barring eStudent).</p>
  </div>
</article>

<article class="hero col-sm-12">
  <header>
    <h3 class="entry-title"><a href="https://ima.org.uk/support/grants/university-liaison-grants-scheme/">University Liaison Grants Scheme</a></h3>
  </header>
  <div class="entry-summary">
    <p>Small grants of £400 are available to university student mathematical societies to provide funding for activities to enhance their programme.</p>
  </div>
</article>

<article class="hero col-sm-12">
  <header>
    <h3 class="entry-title"><a href="https://ima.org.uk/support/grants/grants-without-portfolio/">Grants without Portfolio</a></h3>
  </header>
  <div class="entry-summary">
    <p>A small budget has been assigned (£4,000), and consideration will be given to applications which do not fit the criteria of other schemes.</p>
  </div>
</article>

<article class="hero col-sm-12">
  <header>
    <h3 class="entry-title"><a href="/support/grants/qjmam-fund/">The QJMAM Fund for Applied Mathematics</a></h3>
  </header>
  <div class="entry-summary">
    <p>A major new fund for the support of UK Applied Mathematics from the Quarterly Journal of Mechanics and Applied Mathematics.</p>
  </div>
</article>

</div>
</main>
</body>
</html>`;

const FIXTURE_EMPTY = `
<!DOCTYPE html>
<html><body><main class="main"><div class="row"></div></main></body></html>`;

describe("parseImaPage", () => {
  it("parses all article.hero grant entries", () => {
    const results = parseImaPage(FIXTURE);
    expect(results).toHaveLength(4);
  });

  it("extracts title from h3.entry-title a", () => {
    const results = parseImaPage(FIXTURE);
    expect(results[0].title).toBe("Small Grant Scheme");
  });

  it("extracts absolute URL from href", () => {
    const results = parseImaPage(FIXTURE);
    expect(results[0].url).toBe("https://ima.org.uk/support/grants/small-grant-scheme/");
  });

  it("converts relative URL to absolute", () => {
    const results = parseImaPage(FIXTURE);
    const qjmam = results.find(r => r.title.includes("QJMAM"));
    expect(qjmam?.url).toMatch(/^https:\/\/ima\.org\.uk/);
  });

  it("extracts description from entry-summary p", () => {
    const results = parseImaPage(FIXTURE);
    expect(results[0].description).toContain("applicable mathematics");
  });

  it("extracts amount from description prose", () => {
    const results = parseImaPage(FIXTURE);
    const liaison = results.find(r => r.title.includes("University Liaison"));
    expect(liaison?.amountRaw).toContain("£400");
  });

  it("sets amountRaw to null when no £ in description", () => {
    const results = parseImaPage(FIXTURE);
    expect(results[0].amountRaw).toBeNull();
  });

  it("sets status to open for all entries", () => {
    const results = parseImaPage(FIXTURE);
    results.forEach(r => expect(r.status).toBe("open"));
  });

  it("returns empty array when no article.hero elements", () => {
    expect(parseImaPage(FIXTURE_EMPTY)).toHaveLength(0);
  });
});

describe("normaliseIma", () => {
  const raw = {
    title: "University Liaison Grants Scheme",
    url: "https://ima.org.uk/support/grants/university-liaison-grants-scheme/",
    status: "open",
    description: "Small grants of £400 are available to university student mathematical societies.",
    amountRaw: "£400",
  };

  it("sets source to ima", () => {
    expect(normaliseIma(raw).source).toBe("ima");
  });

  it("sets funder_slug to institute-of-mathematics-and-its-applications", () => {
    expect(normaliseIma(raw).funder_slug).toBe("institute-of-mathematics-and-its-applications");
  });

  it("parses amount_max", () => {
    expect(normaliseIma(raw).amount_max).toBe(40_000); // £400 in pence
  });

  it("sets deadline_date to null (rolling schemes)", () => {
    expect(normaliseIma(raw).deadline_date).toBeNull();
  });

  it("sets funding_type to grant", () => {
    expect(normaliseIma(raw).funding_type).toBe("grant");
  });

  it("generates a slug from the title", () => {
    expect(normaliseIma(raw).slug).toBe("university-liaison-grants-scheme");
  });

  it("sets scope to include mathematics", () => {
    expect(normaliseIma(raw).scope).toContain("mathematics");
  });
});
