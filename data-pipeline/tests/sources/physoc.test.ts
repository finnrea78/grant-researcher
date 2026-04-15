import { parsePhysocListingPage, parsePhysocGrantPage } from "../../src/sources/physoc";
import { normalisePhysoc } from "../../src/transforms/normalise-physoc";

const LISTING_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<div class="row">
  <div class="col-lg-4 d-flex">
    <a href="https://www.physoc.org/grants-and-prizes/grants/conference-attendance-award/" class="info-box type3-md overlay-type2">
      <figure class="bg-img">
        <figcaption>
          <h2>Conference Attendance Award</h2>
          <div class="descr">
            <p>Funding to attend a Society and/or Society-sponsored conference.</p>
          </div>
        </figcaption>
      </figure>
    </a>
  </div>
  <div class="col-lg-4 d-flex">
    <a href="https://www.physoc.org/grants-and-prizes/grants/education-and-teaching-award/" class="info-box type3-md overlay-type2">
      <figure class="bg-img">
        <figcaption>
          <h2>Education and Teaching Award</h2>
          <div class="descr">
            <p>Support for educational resources and research.</p>
          </div>
        </figcaption>
      </figure>
    </a>
  </div>
  <div class="col-lg-4 d-flex">
    <a href="/grants-and-prizes/grants/paton-prize-bursary/" class="info-box type3-md overlay-type2">
      <figure class="bg-img">
        <figcaption>
          <h2>Paton Historical Studies Fund</h2>
          <div class="descr">
            <p>Support for historical studies in physiology.</p>
          </div>
        </figcaption>
      </figure>
    </a>
  </div>
</div>
</main>
</body>
</html>`;

const GRANT_PAGE_WITH_DEADLINE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <figure class="icon-block">
    <div class="icon"><i class="fa fa-gbp"></i></div>
    <figcaption>
      <h3>How much funding is available?</h3>
      <p>Up to £10,000 per award.</p>
    </figcaption>
  </figure>
  <figure class="icon-block">
    <div class="icon"><i class="fa fa-calendar"></i></div>
    <figcaption>
      <h3>When can I apply?</h3>
      <p>Applications are now open for 2026.</p>
    </figcaption>
  </figure>
  <figure class="icon-block">
    <div class="icon"><i class="fa fa-clock"></i></div>
    <figcaption>
      <h3>Deadline</h3>
      <p>Apply by 20 April 2026.</p>
    </figcaption>
  </figure>
</main>
</body>
</html>`;

const GRANT_PAGE_MULTIPLE_DEADLINES = `
<!DOCTYPE html>
<html>
<body>
<main>
  <figure class="icon-block">
    <figcaption>
      <h3>How much funding is available?</h3>
      <p>Up to £375 per award.</p>
    </figcaption>
  </figure>
  <figure class="icon-block">
    <figcaption>
      <h3>Deadline</h3>
      <p>Deadlines in 2026:</p>
      <ul>
        <li><strong>30 April 2026</strong></li>
        <li><strong>30 June 2026</strong></li>
        <li><strong>30 September 2026</strong></li>
      </ul>
    </figcaption>
  </figure>
</main>
</body>
</html>`;

const GRANT_PAGE_CLOSED = `
<!DOCTYPE html>
<html>
<body>
<main>
  <figure class="icon-block">
    <figcaption>
      <h3>How much funding is available?</h3>
      <p>Up to £2,500 per award.</p>
    </figcaption>
  </figure>
  <figure class="icon-block">
    <figcaption>
      <h3>When can I apply?</h3>
      <p>This scheme is currently closed.</p>
    </figcaption>
  </figure>
  <figure class="icon-block">
    <figcaption>
      <h3>Deadline</h3>
      <p>Apply by 1 January 2024.</p>
    </figcaption>
  </figure>
</main>
</body>
</html>`;

describe("parsePhysocListingPage", () => {
  it("parses all grant cards", () => {
    const results = parsePhysocListingPage(LISTING_FIXTURE);
    expect(results).toHaveLength(3);
  });

  it("extracts title from h2 inside info-box", () => {
    const results = parsePhysocListingPage(LISTING_FIXTURE);
    expect(results[0].title).toBe("Conference Attendance Award");
  });

  it("keeps absolute URLs unchanged", () => {
    const results = parsePhysocListingPage(LISTING_FIXTURE);
    expect(results[0].url).toBe("https://www.physoc.org/grants-and-prizes/grants/conference-attendance-award/");
  });

  it("converts relative URL to absolute", () => {
    const results = parsePhysocListingPage(LISTING_FIXTURE);
    expect(results[2].url).toMatch(/^https:\/\/www\.physoc\.org/);
  });

  it("extracts description from descr p", () => {
    const results = parsePhysocListingPage(LISTING_FIXTURE);
    expect(results[0].description).toContain("Society-sponsored conference");
  });
});

describe("parsePhysocGrantPage (single deadline)", () => {
  it("extracts amount from funding icon-block", () => {
    const result = parsePhysocGrantPage(GRANT_PAGE_WITH_DEADLINE, "url");
    expect(result.amountRaw).toContain("£10,000");
  });

  it("extracts deadline from Apply by text", () => {
    const result = parsePhysocGrantPage(GRANT_PAGE_WITH_DEADLINE, "url");
    expect(result.deadlineRaw).toContain("20 April 2026");
  });

  it("sets status to open for future deadline", () => {
    const result = parsePhysocGrantPage(GRANT_PAGE_WITH_DEADLINE, "url");
    expect(result.status).toBe("open");
  });
});

describe("parsePhysocGrantPage (multiple deadlines)", () => {
  it("extracts first future deadline from list", () => {
    const result = parsePhysocGrantPage(GRANT_PAGE_MULTIPLE_DEADLINES, "url");
    expect(result.deadlineRaw).toMatch(/2026/);
  });

  it("sets status to open when future deadlines exist", () => {
    const result = parsePhysocGrantPage(GRANT_PAGE_MULTIPLE_DEADLINES, "url");
    expect(result.status).toBe("open");
  });
});

describe("parsePhysocGrantPage (closed scheme)", () => {
  it("sets status to closed for past deadline", () => {
    const result = parsePhysocGrantPage(GRANT_PAGE_CLOSED, "url");
    expect(result.status).toBe("closed");
  });
});

describe("normalisePhysoc", () => {
  const raw = {
    title: "Education and Teaching Award",
    url: "https://www.physoc.org/grants-and-prizes/grants/education-and-teaching-award/",
    status: "open",
    description: "Support for educational resources.",
    amountRaw: "£10,000",
    deadlineRaw: "20 April 2026",
  };

  it("sets source to physoc", () => {
    expect(normalisePhysoc(raw).source).toBe("physoc");
  });

  it("sets funder_slug to physiological-society", () => {
    expect(normalisePhysoc(raw).funder_slug).toBe("physiological-society");
  });

  it("parses amount_max", () => {
    expect(normalisePhysoc(raw).amount_max).toBe(1_000_000); // £10,000 in pence
  });

  it("parses deadline_date from DD Month YYYY", () => {
    expect(normalisePhysoc(raw).deadline_date).toBe("2026-04-20");
  });

  it("sets funding_type to grant", () => {
    expect(normalisePhysoc(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to studentship for bursary entries", () => {
    const bursaryRaw = { ...raw, title: "Paton Prize Bursary" };
    expect(normalisePhysoc(bursaryRaw).funding_type).toBe("studentship");
  });

  it("generates a slug from the title", () => {
    expect(normalisePhysoc(raw).slug).toBe("education-and-teaching-award");
  });
});
