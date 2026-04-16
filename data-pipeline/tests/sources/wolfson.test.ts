import { parseWolfsonPlacesPage, parseWolfsonPeoplePage, parseWolfsonDetailPage } from "../../src/sources/wolfson";

// Minimal fixture matching real Wolfson Foundation Divi WordPress HTML structure
const PLACES_FIXTURE = `
<!DOCTYPE html>
<html lang="en-GB">
<body>
<div id="main-content">
  <div class="et_pb_section et_pb_section_1">
    <div class="et_pb_row">
      <div class="et_pb_column">
        <div class="et_pb_text">
          <p>Our main grants programme provides support for places — capital initiatives.</p>
        </div>
        <div class="et_pb_text">
          <ul>
            <li><a href="https://www.wolfson.org.uk/funding/funding-for-places/funding-for-museums-galleries/">Museums &amp; galleries funding</a></li>
            <li><a href="https://www.wolfson.org.uk/funding/funding-for-places/funding-for-universities-and-research-institutions/">Universities &amp; research institutions funding</a></li>
            <li><a href="https://www.wolfson.org.uk/funding/funding-for-places/funding-for-libraries-archives/">Libraries &amp; archives funding</a></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

const PEOPLE_FIXTURE = `
<!DOCTYPE html>
<html lang="en-GB">
<body>
<div id="main-content">
  <div class="et_pb_section et_pb_section_1">
    <div class="et_pb_row">
      <div class="et_pb_column et_pb_column_3">
        <div class="et_pb_text">
          <p>Wolfson Music Awards</p>
          <p>Scholarships for outstanding secondary school-age musicians at nine conservatoires.</p>
          <ul class="arrow"><li><a href="https://www.wolfson.org.uk/funding/funding-for-people/wolfson-music-awards/">View participating conservatoires</a></li></ul>
        </div>
      </div>
      <div class="et_pb_column et_pb_column_4">
        <div class="et_pb_text">
          <p>Wolfson Postgraduate Scholarships in the Humanities</p>
          <p>Scholarships for PhD students in history, literature and languages.</p>
          <ul class="arrow"><li><a href="https://www.wolfson.org.uk/funding/funding-for-people/wolfson-postgraduate-scholarships-in-the-humanities/">View participating universities</a></li></ul>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

describe("parseWolfsonPlacesPage", () => {
  it("extracts all sub-category opportunities", () => {
    const result = parseWolfsonPlacesPage(PLACES_FIXTURE);
    expect(result).toHaveLength(3);
  });

  it("maps sub-category title from link text", () => {
    const result = parseWolfsonPlacesPage(PLACES_FIXTURE);
    expect(result[0].title).toBe("Museums & galleries funding");
    expect(result[1].title).toBe("Universities & research institutions funding");
  });

  it("uses full absolute URL", () => {
    const result = parseWolfsonPlacesPage(PLACES_FIXTURE);
    expect(result[0].url).toBe(
      "https://www.wolfson.org.uk/funding/funding-for-places/funding-for-museums-galleries/"
    );
  });

  it("sets status to open (rolling programme)", () => {
    const result = parseWolfsonPlacesPage(PLACES_FIXTURE);
    expect(result[0].status).toBe("open");
  });

  it("sets programme to places", () => {
    const result = parseWolfsonPlacesPage(PLACES_FIXTURE);
    expect(result[0].programme).toBe("places");
  });
});

describe("parseWolfsonPeoplePage", () => {
  it("extracts named people programmes", () => {
    const result = parseWolfsonPeoplePage(PEOPLE_FIXTURE);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the programme URL", () => {
    const result = parseWolfsonPeoplePage(PEOPLE_FIXTURE);
    const urls = result.map(r => r.url);
    expect(urls).toContain(
      "https://www.wolfson.org.uk/funding/funding-for-people/wolfson-music-awards/"
    );
  });

  it("sets status to open", () => {
    const result = parseWolfsonPeoplePage(PEOPLE_FIXTURE);
    expect(result[0].status).toBe("open");
  });

  it("sets programme to people", () => {
    const result = parseWolfsonPeoplePage(PEOPLE_FIXTURE);
    expect(result[0].programme).toBe("people");
  });
});

const DETAIL_FIXTURE = `
<!DOCTYPE html>
<html lang="en-GB">
<body>
<main>
  <div class="et_pb_text">
    <p>The Wolfson Foundation provides capital funding for UK charities focused on mental health. Grants support new building, refurbishment work or equipment with emphasis on training, employment, and supported housing initiatives.</p>
    <p>We fund projects that make a meaningful difference to people living with mental health conditions.</p>
    <h3>Eligibility</h3>
    <p>Applicants must be a registered charity or local authority. Projects must have capital costs of at least £50,000 and a funding shortfall of at least £25,000.</p>
    <h3>When to apply</h3>
    <p>Stage 1 closes January 5 each year. Stage 2 closes March 1. Decisions announced in June.</p>
    <h3>How much can I apply for?</h3>
    <p>Typical grants range from £40,000–£75,000. Minimum grant is £25,000.</p>
  </div>
</main>
</body>
</html>`;

describe("parseWolfsonDetailPage", () => {
  it("extracts description from main paragraphs", () => {
    const result = parseWolfsonDetailPage(DETAIL_FIXTURE);
    expect(result.description).not.toBeNull();
    expect(result.description).toContain("Wolfson Foundation provides capital funding");
  });

  it("extracts eligibility section", () => {
    const result = parseWolfsonDetailPage(DETAIL_FIXTURE);
    expect(result.eligibility).not.toBeNull();
    expect(result.eligibility).toContain("registered charity");
  });

  it("extracts amount", () => {
    const result = parseWolfsonDetailPage(DETAIL_FIXTURE);
    expect(result.amountRaw).not.toBeNull();
    expect(result.amountRaw).toContain("£");
  });

  it("returns null for missing fields on sparse pages", () => {
    const result = parseWolfsonDetailPage("<html><body><p>Short.</p></body></html>");
    expect(result.description).toBeNull();
    expect(result.eligibility).toBeNull();
    expect(result.amountRaw).toBeNull();
    expect(result.deadlineRaw).toBeNull();
  });
});
