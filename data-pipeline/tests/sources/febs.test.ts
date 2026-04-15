import { parseFebsListingPage, parseFebsGrantPage } from "../../src/sources/febs";
import { normaliseFebs } from "../../src/transforms/normalise-febs";

const LISTING_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<aside>
  <div class="sidebar_block sidebar_menu">
    <h2 class="m-0"><span>IN THIS SECTION</span></h2>
    <ul class="mt-2 ml-2">
      <li class="page_item page_item_has_children">
        <a href="https://www.febs.org/funding/fellowships/">Fellowships</a>
        <ul class="children">
          <li class="page_item"><a href="https://www.febs.org/funding/fellowships/general-guidelines-for-fellowships/">General guidelines for Fellowships</a></li>
          <li class="page_item"><a href="https://www.febs.org/funding/fellowships/short-term-fellowships/">Short-Term Fellowships</a></li>
          <li class="page_item"><a href="https://www.febs.org/funding/fellowships/ukrainian-short-term-fellowships/">Ukrainian Short-Term Fellowships</a></li>
          <li class="page_item"><a href="https://www.febs.org/funding/fellowships/probio-africa-fellowships/">PROBio-Africa Fellowships</a></li>
        </ul>
      </li>
      <li class="page_item page_item_has_children">
        <a href="https://www.febs.org/funding/excellence-awards/">Excellence Awards</a>
        <ul class="children">
          <li class="page_item"><a href="https://www.febs.org/funding/excellence-awards/excellence-awards-faqs/">Excellence Awards FAQs</a></li>
        </ul>
      </li>
      <li class="page_item"><a href="https://www.febs.org/funding/meeting-attendance-support/">Meeting attendance</a></li>
      <li class="page_item"><a href="https://www.febs.org/funding/event-organization/">Event organization</a></li>
    </ul>
  </div>
</aside>
</body>
</html>`;

const GRANT_PAGE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<section class="page_header module--hero">
  <div class="hero_item__copy">
    <h2 class="hero_item__title h1_size">Short-Term Fellowships</h2>
  </div>
</section>
<div class="text_column text_column--65">
  <h2>BENEFITS</h2>
  <p><u>Stipend and travel costs</u></p>
  <p>The daily subsistence allowance amounts to <strong>€100 per day</strong>. Travel costs will provide for an economy flight up to a maximum of €300.</p>
  <h2>ELIGIBILITY</h2>
  <p>Applicants must be early-career scientists.</p>
  <h2>APPLICATION</h2>
  <p>Applications may be made throughout the year but should be submitted at least three months before the proposed starting date.</p>
</div>
</body>
</html>`;

const GRANT_PAGE_WITH_DEADLINE = `
<!DOCTYPE html>
<html>
<body>
<section class="page_header module--hero">
  <h2 class="hero_item__title h1_size">PROBio-Africa Fellowships</h2>
</section>
<div class="text_column text_column--65">
  <h2>BENEFITS</h2>
  <p>Fellowship amount: <strong>€500 per month</strong>.</p>
  <h2>APPLICATION</h2>
  <p>The deadline for applications is April 19, 2026. Applications should be submitted via the online system.</p>
</div>
</body>
</html>`;

const PAST_DEADLINE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<section class="page_header module--hero">
  <h2 class="hero_item__title h1_size">Old Fellowship</h2>
</section>
<div class="text_column text_column--65">
  <h2>BENEFITS</h2>
  <p><strong>€200 per day</strong>.</p>
  <h2>APPLICATION</h2>
  <p>The deadline closes on 1 January 2024.</p>
</div>
</body>
</html>`;

const URL = "https://www.febs.org/funding/fellowships/short-term-fellowships/";

describe("parseFebsListingPage", () => {
  it("extracts individual scheme URLs from sidebar", () => {
    const urls = parseFebsListingPage(LISTING_FIXTURE);
    expect(urls.length).toBeGreaterThanOrEqual(5);
  });

  it("includes short-term-fellowships URL", () => {
    const urls = parseFebsListingPage(LISTING_FIXTURE);
    expect(urls).toContain("https://www.febs.org/funding/fellowships/short-term-fellowships/");
  });

  it("filters out general-guidelines pages", () => {
    const urls = parseFebsListingPage(LISTING_FIXTURE);
    expect(urls.filter(u => u.includes("general-guidelines"))).toHaveLength(0);
  });

  it("filters out faq pages", () => {
    const urls = parseFebsListingPage(LISTING_FIXTURE);
    expect(urls.filter(u => u.includes("faqs"))).toHaveLength(0);
  });

  it("includes parent category pages like excellence-awards", () => {
    const urls = parseFebsListingPage(LISTING_FIXTURE);
    expect(urls).toContain("https://www.febs.org/funding/excellence-awards/");
  });

  it("deduplicates URLs", () => {
    const urls = parseFebsListingPage(LISTING_FIXTURE);
    expect(urls.length).toBe(new Set(urls).size);
  });
});

describe("parseFebsGrantPage", () => {
  it("extracts title from hero h2", () => {
    const result = parseFebsGrantPage(GRANT_PAGE_FIXTURE, URL);
    expect(result.title).toBe("Short-Term Fellowships");
  });

  it("extracts € amount from BENEFITS section strong tag", () => {
    const result = parseFebsGrantPage(GRANT_PAGE_FIXTURE, URL);
    expect(result.amountRaw).toContain("€100");
  });

  it("sets deadlineRaw null for rolling applications", () => {
    const result = parseFebsGrantPage(GRANT_PAGE_FIXTURE, URL);
    expect(result.deadlineRaw).toBeNull();
  });

  it("sets status open for rolling applications", () => {
    const result = parseFebsGrantPage(GRANT_PAGE_FIXTURE, URL);
    expect(result.status).toBe("open");
  });

  it("extracts specific deadline date from APPLICATION section", () => {
    const result = parseFebsGrantPage(GRANT_PAGE_WITH_DEADLINE, "https://www.febs.org/funding/fellowships/probio-africa-fellowships/");
    expect(result.deadlineRaw).toContain("2026");
  });

  it("sets status closed for past deadline", () => {
    const result = parseFebsGrantPage(PAST_DEADLINE_FIXTURE, "https://www.febs.org/funding/old/");
    expect(result.status).toBe("closed");
  });
});

describe("normaliseFebs", () => {
  const raw = {
    title: "Short-Term Fellowships",
    url: "https://www.febs.org/funding/fellowships/short-term-fellowships/",
    status: "open",
    amountRaw: "€100 per day",
    deadlineRaw: null,
  };

  it("sets source to febs", () => {
    expect(normaliseFebs(raw).source).toBe("febs");
  });

  it("sets funder_slug to febs", () => {
    expect(normaliseFebs(raw).funder_slug).toBe("febs");
  });

  it("sets funder_name", () => {
    expect(normaliseFebs(raw).funder_name).toBe("Federation of European Biochemical Societies");
  });

  it("sets amount_currency to EUR", () => {
    expect(normaliseFebs(raw).amount_currency).toBe("EUR");
  });

  it("sets funding_type to fellowship", () => {
    expect(normaliseFebs(raw).funding_type).toBe("fellowship");
  });

  it("sets funding_type to prize for awards", () => {
    const awardRaw = { ...raw, title: "Excellence Awards" };
    expect(normaliseFebs(awardRaw).funding_type).toBe("prize");
  });

  it("sets funding_type to bursary for meeting attendance", () => {
    const meetingRaw = { ...raw, title: "Meeting Attendance Support" };
    expect(normaliseFebs(meetingRaw).funding_type).toBe("bursary");
  });

  it("sets scope to biochemistry", () => {
    expect(normaliseFebs(raw).scope).toContain("biochemistry");
  });

  it("generates a slug", () => {
    expect(normaliseFebs(raw).slug).toBe("short-term-fellowships");
  });
});
