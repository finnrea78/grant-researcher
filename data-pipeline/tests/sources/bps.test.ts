import { parseBpsPage, extractBpsNextPage } from "../../src/sources/bps";
import { normaliseBps } from "../../src/transforms/normalise-bps";

const BASE_URL = "https://www.bps.ac.uk";

// Fixture with two grant cards: one with future deadline, one with no deadline
const FIXTURE_PAGE1 = `
<!DOCTYPE html>
<html lang="en">
<body>
<div class="list-container">

  <div class="article articletype-0" itemscope itemtype="https://schema.org/Article">
    <div class="categories-tags">
      <span class="news-list-category" data-slug="grant">Grant</span>
    </div>
    <div class="header">
      <h3>
        <a itemprop="url" title="Engagement Grants"
           href="/membership-community/prizes-awards-grants-bursaries/prizes-awards-grants/article/engagement-grants/">
          <span itemprop="headline">Engagement Grants</span>
        </a>
      </h3>
    </div>
    <div class="teaser-text">
      <div itemprop="description">
        <div class="articlecontent">
          <p>Support public engagement activities. Awards of up to £2,500 are available for BPS members.</p>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>
        Deadline: <span class="news-list-date">
          <time itemprop="datePublished" datetime="2026-09-30"> 30/09/2026 </time>
        </span>
      </p>
    </div>
  </div>

  <div class="article articletype-0" itemscope itemtype="https://schema.org/Article">
    <div class="categories-tags">
      <span class="news-list-category" data-slug="prize">Prize</span>
    </div>
    <div class="header">
      <h3>
        <a itemprop="url" title="Bill Bowman Prize"
           href="/membership-community/prizes-awards-grants-bursaries/prizes-awards-grants/article/bill-bowman-prize/">
          <span itemprop="headline">Bill Bowman Prize</span>
        </a>
      </h3>
    </div>
    <div class="teaser-text">
      <div itemprop="description">
        <div class="articlecontent">
          <p>Biennial prize for early career non-clinical members. Awarded up to £5,000 in travel and accommodation.</p>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>
        Deadline: <span class="news-list-date">
          <time itemprop="datePublished" datetime="2026-03-30"> 30/03/2026 </time>
        </span>
      </p>
    </div>
  </div>

  <div class="article articletype-0" itemscope itemtype="https://schema.org/Article">
    <div class="categories-tags">
      <span class="news-list-category" data-slug="grant">Grant</span>
    </div>
    <div class="header">
      <h3>
        <a itemprop="url" title="Ambassadors grant"
           href="/membership-community/prizes-awards-grants-bursaries/prizes-awards-grants/article/ambassadors-grant/">
          <span itemprop="headline">Ambassadors grant</span>
        </a>
      </h3>
    </div>
    <div class="teaser-text">
      <div itemprop="description">
        <div class="articlecontent">
          <p>As an Ambassador you can apply for up to £250 a year to enable you to carry out your role effectively.</p>
        </div>
      </div>
    </div>
    <div class="footer"><p></p></div>
  </div>

</div>

<ul class="f3-widget-paginator">
  <li class="current">1</li>
  <li><a href="/membership-community/prizes-awards-grants-bursaries/prizes-awards-grants/page-2/">2</a></li>
  <li class="next"><a href="/membership-community/prizes-awards-grants-bursaries/prizes-awards-grants/page-2/">next</a></li>
</ul>
</body>
</html>`;

// Last page — no "next" paginator link
const FIXTURE_LAST_PAGE = `
<!DOCTYPE html>
<html lang="en">
<body>
<ul class="f3-widget-paginator">
  <li><a href="/page-2/">prev</a></li>
  <li class="current">3</li>
</ul>
</body>
</html>`;

describe("parseBpsPage", () => {
  it("extracts all grant cards", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    expect(result).toHaveLength(3);
  });

  it("extracts grant title from headline span", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    expect(result[0].title).toBe("Engagement Grants");
  });

  it("extracts ISO deadline from time datetime attribute", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    expect(result[0].deadlineIso).toBe("2026-09-30");
  });

  it("sets status to open for future deadline", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    expect(result[0].status).toBe("open"); // 2026-09-30 is future
  });

  it("sets status to closed for past deadline", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    const bill = result.find(r => r.title === "Bill Bowman Prize");
    expect(bill?.status).toBe("closed"); // 2026-03-30 is past (today 2026-04-15)
  });

  it("sets deadlineIso to null when no time element present", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    const ambassador = result.find(r => r.title === "Ambassadors grant");
    expect(ambassador?.deadlineIso).toBeNull();
  });

  it("extracts amount from teaser text", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    expect(result[0].amountRaw).toContain("£2,500");
  });

  it("builds absolute URL from relative href", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    expect(result[0].url).toMatch(/^https:\/\/www\.bps\.ac\.uk/);
  });

  it("extracts category from news-list-category span", () => {
    const result = parseBpsPage(FIXTURE_PAGE1);
    expect(result[0].category).toBe("Grant");
    expect(result[1].category).toBe("Prize");
  });
});

describe("extractBpsNextPage", () => {
  it("returns next page URL when paginator has li.next", () => {
    const next = extractBpsNextPage(FIXTURE_PAGE1, "https://www.bps.ac.uk/page-1/");
    expect(next).toMatch(/page-2/);
  });

  it("returns null on last page (no li.next)", () => {
    const next = extractBpsNextPage(FIXTURE_LAST_PAGE, "https://www.bps.ac.uk/page-3/");
    expect(next).toBeNull();
  });
});

describe("normaliseBps", () => {
  it("sets source to bps", () => {
    const raw = parseBpsPage(FIXTURE_PAGE1)[0];
    const result = normaliseBps(raw);
    expect(result.source).toBe("bps");
  });

  it("sets funder_slug to british-psychological-society", () => {
    const raw = parseBpsPage(FIXTURE_PAGE1)[0];
    const result = normaliseBps(raw);
    expect(result.funder_slug).toBe("british-psychological-society");
  });

  it("uses deadlineIso directly as deadline_date", () => {
    const raw = parseBpsPage(FIXTURE_PAGE1)[0];
    const result = normaliseBps(raw);
    expect(result.deadline_date).toBe("2026-09-30");
  });

  it("parses amount_max from up-to text", () => {
    const raw = parseBpsPage(FIXTURE_PAGE1)[0]; // up to £2,500
    const result = normaliseBps(raw);
    expect(result.amount_max).toBe(250_000); // £2,500 in pence
    expect(result.amount_min).toBeNull();
  });

  it("sets funding_type to prize for Prize category", () => {
    const raw = parseBpsPage(FIXTURE_PAGE1).find(r => r.category === "Prize")!;
    const result = normaliseBps(raw);
    expect(result.funding_type).toBe("prize");
  });
});
