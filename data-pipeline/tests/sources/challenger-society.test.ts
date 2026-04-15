import { parseChallengerListingPage, parseChallengerGrantPage } from "../../src/sources/challenger-society";
import { normaliseChallengerSociety } from "../../src/transforms/normalise-challenger-society";

const LISTING_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<article>
<div class="entry-content">

<p>The Challenger Society offers several awards and grants.</p>

<!-- Skip: honorary -->
<h4 class="wp-block-heading"><a href="/awards-and-grants/honorary-membership/">Honorary Membership</a></h4>
<p class="wp-block-paragraph">Awarded to distinguished marine scientists.</p>

<!-- Skip: medal -->
<h4 class="wp-block-heading"><a href="/awards-and-grants/the-challenger-medal/">The Challenger Medal</a></h4>
<p class="wp-block-paragraph">Biennial award for outstanding contributions.</p>

<!-- Keep: bursary with amount -->
<h4 class="wp-block-heading"><a href="https://challenger-society.org.uk/awards-and-grants/stepping-stones-bursary/" data-type="page">Stepping Stones Bursary</a></h4>
<p class="wp-block-paragraph">The Stepping Stone Research Bursary Scheme can allocate up to £1000 per grant to support research activities in marine science.</p>

<!-- Keep: fellowship with link -->
<h4 class="wp-block-heading"><a href="https://challenger-society.org.uk/awards-and-grants/challenger-ecr-fellowships/">Fellowships</a></h4>
<p class="wp-block-paragraph">Early career researcher fellowships in marine science. Applications open annually.</p>

<!-- Keep: no link, has amount -->
<h4 class="wp-block-heading">Challenger Society for Marine Science Student Award</h4>
<p class="wp-block-paragraph">The winning student will receive a cheque for £500. All winning students receive one year's complimentary membership.</p>

<!-- Keep: travel awards -->
<h4 class="wp-block-heading"><a href="https://challenger-society.org.uk/awards-and-grants/travel-awards/">Travel Awards</a></h4>
<p class="wp-block-paragraph">Support for travel to conferences in marine science.</p>

<!-- Skip: meeting prizes (skip) -->
<h4 class="wp-block-heading">Meeting Prizes</h4>
<p class="wp-block-paragraph">Prizes awarded at biennial meetings.</p>

</div>
</article>
</body>
</html>`;

const SUBPAGE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<article class="entry-content">
  <h3>Student Dissertation Award</h3>
  <p>The purpose of the Award is to raise the status of Marine Science education in the UK.</p>
  <p>The deadline for submissions for this year is <strong>30th April 2026</strong>. Submissions should be emailed to the Honorary Secretary.</p>
</article>
</body>
</html>`;

const SUBPAGE_NO_DATE = `
<!DOCTYPE html>
<html>
<body>
<article class="entry-content">
  <p>Applications are considered on a rolling basis throughout the year.</p>
</article>
</body>
</html>`;

describe("parseChallengerListingPage", () => {
  it("parses grant entries, skipping honorary and medal entries", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    const titles = results.map(r => r.title);
    expect(titles).not.toContain("Honorary Membership");
    expect(titles).not.toContain("The Challenger Medal");
  });

  it("skips Meeting Prizes", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    expect(results.map(r => r.title)).not.toContain("Meeting Prizes");
  });

  it("parses 4 kept grant entries", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    expect(results).toHaveLength(4);
  });

  it("extracts title from h4 text", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    expect(results[0].title).toBe("Stepping Stones Bursary");
  });

  it("extracts subpage URL from h4 link", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    expect(results[0].subpageUrl).toContain("stepping-stones-bursary");
  });

  it("sets subpageUrl null for unlinked entries", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    const studentAward = results.find(r => r.title === "Challenger Society for Marine Science Student Award");
    expect(studentAward?.subpageUrl).toBeNull();
  });

  it("extracts £ amount from prose", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    expect(results[0].amountRaw).toContain("£1000");
  });

  it("extracts amount from unlinked entry prose", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    const studentAward = results.find(r => r.title.includes("Student Award"));
    expect(studentAward?.amountRaw).toContain("£500");
  });

  it("extracts description from first p after h4", () => {
    const results = parseChallengerListingPage(LISTING_FIXTURE);
    expect(results[0].description).toContain("marine science");
  });

  it("deduplicates identical titles", () => {
    const html = `
      <html><body><div class="entry-content">
      <h4 class="wp-block-heading">Stepping Stones Bursary</h4>
      <p>£1000 grant.</p>
      <h4 class="wp-block-heading">Stepping Stones Bursary</h4>
      <p>£1000 grant.</p>
      </div></body></html>`;
    expect(parseChallengerListingPage(html)).toHaveLength(1);
  });
});

describe("parseChallengerGrantPage", () => {
  it("extracts deadline from prose date pattern", () => {
    const result = parseChallengerGrantPage(SUBPAGE_FIXTURE);
    expect(result.deadlineRaw).toContain("April 2026");
  });

  it("strips ordinal suffix from deadline", () => {
    const result = parseChallengerGrantPage(SUBPAGE_FIXTURE);
    expect(result.deadlineRaw).not.toMatch(/\d+(st|nd|rd|th)/i);
  });

  it("returns null when no date found", () => {
    const result = parseChallengerGrantPage(SUBPAGE_NO_DATE);
    expect(result.deadlineRaw).toBeNull();
  });
});

describe("normaliseChallengerSociety", () => {
  const raw = {
    title: "Stepping Stones Bursary",
    url: "https://challenger-society.org.uk/awards-and-grants/stepping-stones-bursary/",
    status: "open",
    description: "Up to £1000 to support marine science research activities.",
    amountRaw: "up to £1000",
    deadlineRaw: null,
  };

  it("sets source to challenger_society", () => {
    expect(normaliseChallengerSociety(raw).source).toBe("challenger_society");
  });

  it("sets funder_slug to challenger-society", () => {
    expect(normaliseChallengerSociety(raw).funder_slug).toBe("challenger-society");
  });

  it("sets funder_name", () => {
    expect(normaliseChallengerSociety(raw).funder_name).toBe("Challenger Society for Marine Science");
  });

  it("parses amount_max from 'up to £1000'", () => {
    expect(normaliseChallengerSociety(raw).amount_max).toBe(100_000);
  });

  it("sets funding_type to bursary", () => {
    expect(normaliseChallengerSociety(raw).funding_type).toBe("bursary");
  });

  it("sets funding_type to fellowship for fellowship entries", () => {
    const fellowRaw = { ...raw, title: "Challenger ECR Fellowships" };
    expect(normaliseChallengerSociety(fellowRaw).funding_type).toBe("fellowship");
  });

  it("sets funding_type to prize for award entries", () => {
    const awardRaw = { ...raw, title: "Challenger Society for Marine Science Student Award" };
    expect(normaliseChallengerSociety(awardRaw).funding_type).toBe("prize");
  });

  it("sets scope to marine science", () => {
    expect(normaliseChallengerSociety(raw).scope).toContain("marine science");
  });

  it("generates a slug", () => {
    expect(normaliseChallengerSociety(raw).slug).toBe("stepping-stones-bursary");
  });
});
