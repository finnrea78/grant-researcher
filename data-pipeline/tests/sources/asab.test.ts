import { parseAsabGrantPage, parseAsabOverviewPage } from "../../src/sources/asab";
import { normaliseAsab } from "../../src/transforms/normalise-asab";

const RESEARCH_GRANTS_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Research Grants of up to £15,000 support original research projects.</h1>
  <div class="sqs-block-content">
    <p>Research Grants are intended to support original research projects in animal behaviour. Grants will not exceed £15,000.</p>
    <p>The next application deadline for Research Grants is 1st June 2026.</p>
    <p>Applications should be submitted by email.</p>
  </div>
</main>
</body>
</html>`;

const CONFERENCE_GRANTS_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Conference Attendance Grants help PhD students and others with limited funds to attend ASAB conferences.</h1>
  <div class="sqs-block-content">
    <p>Conference Attendance Grants support attendance at ASAB-run events. Awards of up to £750 are available for standard applicants.</p>
    <p>The next application deadline for Conference Attendance Grants is 1st October 2026.</p>
  </div>
</main>
</body>
</html>`;

const CHILDCARE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Childcare Grants</h1>
  <div class="sqs-block-content">
    <p>Childcare Grants of up to £500 are available to members who need childcare support to attend ASAB events.</p>
    <p>Rolling deadline — apply at any time.</p>
  </div>
</main>
</body>
</html>`;

const PAST_DEADLINE_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Research Grants of up to £15,000 support original research projects.</h1>
  <div class="sqs-block-content">
    <p>The next application deadline for Research Grants is 1st January 2024.</p>
  </div>
</main>
</body>
</html>`;

const OVERVIEW_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main class="container">
  <a class="sqs-block-image-link" href="/research-grants">Research</a>
  <a class="sqs-block-image-link" href="/conference-grants">Conferences</a>
  <a class="sqs-block-image-link" href="/childcare">Childcare</a>
  <a class="sqs-block-image-link" href="/scholarships">Scholarships</a>
  <a href="/about">About ASAB</a>
  <a href="/contact">Contact</a>
</main>
</body>
</html>`;

const URL = "https://www.asab.org/research-grants";

describe("parseAsabGrantPage", () => {
  it("strips description from h1 to extract grant name", () => {
    const result = parseAsabGrantPage(RESEARCH_GRANTS_FIXTURE, URL);
    expect(result.title).toBe("Research Grants");
  });

  it("extracts amount from prose", () => {
    const result = parseAsabGrantPage(RESEARCH_GRANTS_FIXTURE, URL);
    expect(result.amountRaw).toContain("£15,000");
  });

  it("extracts specific next deadline date", () => {
    const result = parseAsabGrantPage(RESEARCH_GRANTS_FIXTURE, URL);
    expect(result.deadlineRaw).toContain("June 2026");
  });

  it("strips ordinal suffix from deadline for parseDate compatibility", () => {
    const result = parseAsabGrantPage(RESEARCH_GRANTS_FIXTURE, URL);
    // "1st June 2026" → "1 June 2026"
    expect(result.deadlineRaw).not.toMatch(/\d+(st|nd|rd|th)/i);
  });

  it("sets status open for future deadline", () => {
    const result = parseAsabGrantPage(RESEARCH_GRANTS_FIXTURE, URL);
    expect(result.status).toBe("open");
  });

  it("sets status closed for past deadline", () => {
    const result = parseAsabGrantPage(PAST_DEADLINE_FIXTURE, URL);
    expect(result.status).toBe("closed");
  });

  it("extracts description from first substantive paragraph", () => {
    const result = parseAsabGrantPage(RESEARCH_GRANTS_FIXTURE, URL);
    expect(result.description).toContain("animal behaviour");
  });

  it("handles conference grants with up to amount", () => {
    const result = parseAsabGrantPage(CONFERENCE_GRANTS_FIXTURE, "https://www.asab.org/conference-grants");
    expect(result.title).toBe("Conference Attendance Grants");
    expect(result.amountRaw).toContain("£750");
  });

  it("handles plain h1 title without verb phrase", () => {
    const result = parseAsabGrantPage(CHILDCARE_FIXTURE, "https://www.asab.org/childcare");
    expect(result.title).toBe("Childcare Grants");
  });

  it("sets deadlineRaw null when no specific next deadline found", () => {
    const result = parseAsabGrantPage(CHILDCARE_FIXTURE, "https://www.asab.org/childcare");
    expect(result.deadlineRaw).toBeNull();
  });
});

describe("parseAsabOverviewPage", () => {
  it("extracts grant page URLs from overview", () => {
    const urls = parseAsabOverviewPage(OVERVIEW_FIXTURE);
    expect(urls.length).toBeGreaterThanOrEqual(3);
  });

  it("includes research-grants URL", () => {
    const urls = parseAsabOverviewPage(OVERVIEW_FIXTURE);
    expect(urls).toContain("https://www.asab.org/research-grants");
  });

  it("filters out non-grant navigation links", () => {
    const urls = parseAsabOverviewPage(OVERVIEW_FIXTURE);
    expect(urls).not.toContain("https://www.asab.org/about");
    expect(urls).not.toContain("https://www.asab.org/contact");
  });
});

describe("normaliseAsab", () => {
  const raw = {
    title: "Research Grants",
    url: "https://www.asab.org/research-grants",
    status: "open",
    description: "Grants to support original research projects in animal behaviour.",
    amountRaw: "up to £15,000",
    deadlineRaw: "1 June 2026",
    eligibility: null,
  };

  it("sets source to asab", () => {
    expect(normaliseAsab(raw).source).toBe("asab");
  });

  it("sets funder_slug to asab", () => {
    expect(normaliseAsab(raw).funder_slug).toBe("asab");
  });

  it("sets funder_name", () => {
    expect(normaliseAsab(raw).funder_name).toBe("Association for the Study of Animal Behaviour");
  });

  it("parses amount_max from 'up to £15,000'", () => {
    expect(normaliseAsab(raw).amount_max).toBe(1_500_000);
  });

  it("parses deadline_date", () => {
    expect(normaliseAsab(raw).deadline_date).toBe("2026-06-01");
  });

  it("sets funding_type to grant", () => {
    expect(normaliseAsab(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to fellowship for scholarship entries", () => {
    const scholarRaw = { ...raw, title: "Undergraduate Project Scholarships" };
    expect(normaliseAsab(scholarRaw).funding_type).toBe("fellowship");
  });

  it("sets scope to null", () => {
    expect(normaliseAsab(raw).scope).toBeNull();
  });

  it("generates a slug", () => {
    expect(normaliseAsab(raw).slug).toBe("research-grants");
  });
});
