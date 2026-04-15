import { parseSciListingPage, parseSciGrantPage } from "../../src/sources/sci";
import { normaliseSci } from "../../src/transforms/normalise-sci";

const LISTING_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <div class="row">
    <div class="col">
      <a href="/awards/travel-bursaries/aj-banks-travel-bursary">
        <h5>AJ Banks Travel Bursary</h5>
        <p>Support for travel to conferences in the chemical sciences.</p>
      </a>
    </div>
    <div class="col">
      <a href="/awards/travel-bursaries/leverhulme-travel-bursary">
        <h5>Leverhulme Travel Bursary</h5>
        <p>For early career researchers.</p>
      </a>
    </div>
    <div class="col">
      <a href="/awards/travel-bursaries/messel-travel-bursary">
        <h5>Messel Travel Bursary</h5>
        <p>Named after Otto Messel.</p>
      </a>
    </div>
    <!-- Nav link should be excluded (only 2 segments) -->
    <a href="/awards/travel-bursaries">
      <h5>Travel Bursaries Overview</h5>
    </a>
    <!-- Non-awards link should be excluded -->
    <a href="/about/membership">
      <h5>Membership</h5>
    </a>
  </div>
</main>
</body>
</html>`;

const GRANT_PAGE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>AJ Banks Travel Bursary</h1>
  <p>The AJ Banks Travel Bursary offers awards of up to £1,500 to support SCI members travelling to international conferences in the chemical sciences.</p>
  <table>
    <tbody>
      <tr><td>Opens:</td><td>1 August 2026</td></tr>
      <tr><td>Closes:</td><td>31 October 2026</td></tr>
      <tr><td>Frequency:</td><td>Annual</td></tr>
    </tbody>
  </table>
</main>
</body>
</html>`;

const GRANT_PAGE_NO_TIMETABLE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Rideal Travel Bursary</h1>
  <p>The Rideal Travel Bursary provides £500 grants for travel to conferences.</p>
</main>
</body>
</html>`;

const PAST_DEADLINE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Old Award</h1>
  <table>
    <tbody>
      <tr><td>Closes:</td><td>1 January 2024</td></tr>
    </tbody>
  </table>
</main>
</body>
</html>`;

const URL = "https://www.soci.org/awards/travel-bursaries/aj-banks-travel-bursary";

describe("parseSciListingPage", () => {
  it("extracts award entries from a:has(h5) pattern", () => {
    const results = parseSciListingPage(LISTING_FIXTURE);
    expect(results).toHaveLength(3);
  });

  it("extracts title from h5 inside link", () => {
    const results = parseSciListingPage(LISTING_FIXTURE);
    expect(results[0].title).toBe("AJ Banks Travel Bursary");
  });

  it("resolves relative href to absolute URL", () => {
    const results = parseSciListingPage(LISTING_FIXTURE);
    expect(results[0].url).toBe("https://www.soci.org/awards/travel-bursaries/aj-banks-travel-bursary");
  });

  it("filters out category overview links (only 2 path segments)", () => {
    const results = parseSciListingPage(LISTING_FIXTURE);
    expect(results.map(r => r.title)).not.toContain("Travel Bursaries Overview");
  });

  it("filters out non-/awards/ links", () => {
    const results = parseSciListingPage(LISTING_FIXTURE);
    expect(results.map(r => r.title)).not.toContain("Membership");
  });

  it("deduplicates identical URLs", () => {
    const html = `
      <html><body>
      <a href="/awards/travel-bursaries/aj-banks-travel-bursary"><h5>AJ Banks</h5></a>
      <a href="/awards/travel-bursaries/aj-banks-travel-bursary"><h5>AJ Banks</h5></a>
      </body></html>`;
    const results = parseSciListingPage(html);
    expect(results).toHaveLength(1);
  });

  it("returns empty array when no a:has(h5) elements", () => {
    expect(parseSciListingPage("<html><body><p>No awards</p></body></html>")).toHaveLength(0);
  });
});

const GRANT_PAGE_WITH_ELIGIBILITY = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Ramsay Trust Memorial Fellowship</h1>
  <p>The Ramsay Trust Memorial Fellowships support postdoctoral chemists in the early stages of their career so that they may initiate a programme of original and independent research in inorganic chemistry.</p>
  <h3>Eligibility</h3>
  <p>Applicants must be university graduates with distinction in chemical sciences and have some postdoctoral experience. Applicants from under-represented groups are particularly welcome.</p>
  <table>
    <tbody>
      <tr><td>Closes:</td><td>30 November 2025</td></tr>
    </tbody>
  </table>
  <p>Value: up to £24,000.</p>
</main>
</body>
</html>`;

describe("parseSciGrantPage", () => {
  it("extracts closes date from timetable", () => {
    const result = parseSciGrantPage(GRANT_PAGE_FIXTURE, URL);
    expect(result.deadlineRaw).toBe("31 October 2026");
  });

  it("sets status open for future deadline", () => {
    const result = parseSciGrantPage(GRANT_PAGE_FIXTURE, URL);
    expect(result.status).toBe("open");
  });

  it("sets status closed for past deadline", () => {
    const result = parseSciGrantPage(PAST_DEADLINE_FIXTURE, URL);
    expect(result.status).toBe("closed");
  });

  it("extracts amount from prose", () => {
    const result = parseSciGrantPage(GRANT_PAGE_FIXTURE, URL);
    expect(result.amountRaw).toContain("£1,500");
  });

  it("sets deadlineRaw null when no timetable", () => {
    const result = parseSciGrantPage(GRANT_PAGE_NO_TIMETABLE, URL);
    expect(result.deadlineRaw).toBeNull();
  });

  it("extracts amount even without timetable", () => {
    const result = parseSciGrantPage(GRANT_PAGE_NO_TIMETABLE, URL);
    expect(result.amountRaw).toContain("£500");
  });

  it("extracts description from main paragraphs", () => {
    const result = parseSciGrantPage(GRANT_PAGE_WITH_ELIGIBILITY, URL);
    expect(result.description).not.toBeNull();
    expect(result.description).toContain("Ramsay Trust Memorial Fellowships");
  });

  it("extracts eligibility section", () => {
    const result = parseSciGrantPage(GRANT_PAGE_WITH_ELIGIBILITY, URL);
    expect(result.eligibility).not.toBeNull();
    expect(result.eligibility).toContain("postdoctoral experience");
  });

  it("returns null description for sparse pages", () => {
    const result = parseSciGrantPage("<html><body><p>Short.</p></body></html>", URL);
    expect(result.description).toBeNull();
    expect(result.eligibility).toBeNull();
  });
});

describe("normaliseSci", () => {
  const raw = {
    title: "AJ Banks Travel Bursary",
    url: "https://www.soci.org/awards/travel-bursaries/aj-banks-travel-bursary",
    status: "open",
    description: null,
    eligibility: null,
    amountRaw: "up to £1,500",
    deadlineRaw: "31 October 2026",
  };

  it("sets source to sci", () => {
    expect(normaliseSci(raw).source).toBe("sci");
  });

  it("sets funder_slug to sci", () => {
    expect(normaliseSci(raw).funder_slug).toBe("sci");
  });

  it("sets funder_name to Society of Chemical Industry", () => {
    expect(normaliseSci(raw).funder_name).toBe("Society of Chemical Industry");
  });

  it("parses deadline_date from day month year", () => {
    expect(normaliseSci(raw).deadline_date).toBe("2026-10-31");
  });

  it("parses amount_max in pence", () => {
    expect(normaliseSci(raw).amount_max).toBe(150_000);
  });

  it("sets funding_type to bursary for travel bursary", () => {
    expect(normaliseSci(raw).funding_type).toBe("bursary");
  });

  it("sets funding_type to fellowship for fellowship entries", () => {
    const fellowRaw = { ...raw, title: "Ramsay Trust Memorial Fellowship" };
    expect(normaliseSci(fellowRaw).funding_type).toBe("fellowship");
  });

  it("generates a slug", () => {
    expect(normaliseSci(raw).slug).toBe("aj-banks-travel-bursary");
  });

  it("sets scope to null (not hardcoded subject labels)", () => {
    expect(normaliseSci(raw).scope).toBeNull();
  });
});
