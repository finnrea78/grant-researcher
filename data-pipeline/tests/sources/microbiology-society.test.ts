import { parseMicrobiologySocietyPage, parseMicrobiologySocietyDetailPage } from "../../src/sources/microbiology-society";
import { normaliseMicrobiologySociety } from "../../src/transforms/normalise-microbiology-society";

const GRANTS_URL = "https://microbiologysociety.org/grants-prizes/all-grants.html";

const FIXTURE_LISTING = `
<!DOCTYPE html>
<html lang="en">
<body>
<div class="article toc-item">
  <h3><a class="article-heading-link" href="/grants-prizes/travel-grants/">Travel Grants</a></h3>
  <p class="article-text">These grants support Microbiology Society members to attend scientific meetings. Awards of up to £750 are available for members to attend meetings outside the UK.</p>
</div>
<div class="article toc-item">
  <h3><a class="article-heading-link" href="/grants-prizes/research-visits/">Research Visit Grants</a></h3>
  <p class="article-text">These grants are available to support members to make short research visits to another laboratory. Awards of up to £2,000 are available.</p>
</div>
<div class="article toc-item">
  <h3><a class="article-heading-link" href="https://external.example.com/prize">External Prize</a></h3>
  <p class="article-text">A prize awarded annually for outstanding contributions to microbiology.</p>
</div>
<div class="article toc-item">
  <h3><span class="not-a-link">No Link Card</span></h3>
  <p class="article-text">This card has no link and should be skipped.</p>
</div>
</body>
</html>`;

const FIXTURE_DETAIL = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Travel Grants</h1>
  <p>The Microbiology Society Travel Grant scheme supports members to attend national and international scientific meetings and conferences.</p>
  <p>Awards of up to £750 are available for members to attend meetings outside the UK. Members can apply for up to two travel grants per year.</p>
  <h2>Eligibility</h2>
  <p>Applicants must be current members of the Microbiology Society. The grant is open to all career stages including students, postdoctoral researchers, and established academics.</p>
  <h2>How to Apply</h2>
  <p>Applications should be submitted via the online portal at least four weeks before the meeting.</p>
</main>
</body>
</html>`;

const FIXTURE_EMPTY = `
<!DOCTYPE html>
<html lang="en">
<body>
<p>No grants currently listed.</p>
</body>
</html>`;

describe("parseMicrobiologySocietyPage", () => {
  it("parses all cards with article-heading-link", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results).toHaveLength(3);
  });

  it("extracts title from article-heading-link", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results[0].title).toBe("Travel Grants");
  });

  it("builds absolute URL from relative href", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results[0].url).toBe("https://microbiologysociety.org/grants-prizes/travel-grants/");
  });

  it("preserves absolute URL unchanged", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results[2].url).toBe("https://external.example.com/prize");
  });

  it("extracts description from p.article-text", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results[0].description).toContain("scientific meetings");
  });

  it("extracts amount from 'Awards of up to £X' pattern", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results[0].amountRaw).toContain("£750");
  });

  it("extracts amount from second card", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results[1].amountRaw).toContain("£2,000");
  });

  it("sets amountRaw to null when no £ in description", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results[2].amountRaw).toBeNull();
  });

  it("sets status to open for all cards", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    results.forEach(r => expect(r.status).toBe("open"));
  });

  it("skips cards with no article-heading-link title", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    expect(results.map(r => r.title)).not.toContain("No Link Card");
  });

  it("sets eligibility to null initially (populated by detail fetch)", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_LISTING);
    results.forEach(r => expect(r.eligibility).toBeNull());
  });

  it("returns empty array for page with no grant cards", () => {
    const results = parseMicrobiologySocietyPage(FIXTURE_EMPTY);
    expect(results).toHaveLength(0);
  });
});

describe("parseMicrobiologySocietyDetailPage", () => {
  it("extracts multi-paragraph description", () => {
    const result = parseMicrobiologySocietyDetailPage(FIXTURE_DETAIL);
    expect(result.description).toContain("Travel Grant scheme");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility section", () => {
    const result = parseMicrobiologySocietyDetailPage(FIXTURE_DETAIL);
    expect(result.eligibility).toContain("current members");
  });
});

describe("normaliseMicrobiologySociety", () => {
  it("sets source to microbiology_society", () => {
    const raw = parseMicrobiologySocietyPage(FIXTURE_LISTING)[0];
    const result = normaliseMicrobiologySociety(raw);
    expect(result.source).toBe("microbiology_society");
  });

  it("sets funder_slug to microbiology-society", () => {
    const raw = parseMicrobiologySocietyPage(FIXTURE_LISTING)[0];
    const result = normaliseMicrobiologySociety(raw);
    expect(result.funder_slug).toBe("microbiology-society");
  });

  it("sets deadline_date to null (rolling schemes)", () => {
    const raw = parseMicrobiologySocietyPage(FIXTURE_LISTING)[0];
    const result = normaliseMicrobiologySociety(raw);
    expect(result.deadline_date).toBeNull();
  });

  it("parses amount_max for up-to grants", () => {
    const raw = parseMicrobiologySocietyPage(FIXTURE_LISTING)[0];
    const result = normaliseMicrobiologySociety(raw);
    expect(result.amount_max).toBe(75_000); // £750 in pence
    expect(result.amount_min).toBeNull();
  });

  it("generates a slug from the title", () => {
    const raw = parseMicrobiologySocietyPage(FIXTURE_LISTING)[0];
    const result = normaliseMicrobiologySociety(raw);
    expect(result.slug).toBe("travel-grants");
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    const raw = parseMicrobiologySocietyPage(FIXTURE_LISTING)[0];
    const result = normaliseMicrobiologySociety(raw);
    expect(result.scope).toBeNull();
  });

  it("passes through eligibility when set", () => {
    const raw = { ...parseMicrobiologySocietyPage(FIXTURE_LISTING)[0], eligibility: "Must be a Society member." };
    expect(normaliseMicrobiologySociety(raw).eligibility).toContain("Society member");
  });
});
