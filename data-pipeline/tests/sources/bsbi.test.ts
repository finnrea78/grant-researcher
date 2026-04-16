import { parseBsbiPage, parseBsbiDetailPage } from "../../src/sources/bsbi";
import { normaliseBsbi } from "../../src/transforms/normalise-bsbi";

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<article class="page-content mt-xl-4">

<p><strong>All our grant programmes have now closed for 2026. Applications for 2027 will open on 1 Dec 2026.</strong></p>

<div id="heading2"></div>
<h3>Training Grants</h3>
<ul>
  <li>Up to £250 (or € equivalent for applicants from the Republic of Ireland) for aspiring botanists who want to go on botanical training courses from external providers.</li>
  <li>Typical applicants would include recent graduates looking to start a career in botany.</li>
</ul>
<p><a href="/learn/grants/training" class="btn btn-primary">Find out more</a></p>

<div id="heading3"></div>
<h3>Identiplant Grants</h3>
<ul>
  <li>Up to £250 (or € equivalent) to cover part of the cost of the Identiplant correspondence course.</li>
</ul>
<p><a href="/learn/grants/identiplant" class="btn btn-primary">Find out more</a></p>

<div id="heading4"></div>
<h3>Plant Study Grants</h3>
<ul>
  <li>Up to £1,000 (or € equivalent) for those undertaking field studies of wild plant groups.</li>
</ul>
<p><a href="/learn/grants/plant-study" class="btn btn-primary">Find out more</a></p>

<div id="heading6"></div>
<h3>Trial FISC Grants</h3>
<p>BSBI is trialling a new grant scheme for 2026 for individuals who are unwaged, students or volunteers.</p>
<p>Twenty grants of up to £175 will be available to part cover the cost of a FISC.</p>
<p>Applications open on 1 December 2025 and close on 28 February 2026. This trial will help us understand demand.</p>
<p><a href="/learn/grants/trial-fisc-grants-for-2026" class="btn btn-primary">Find out more</a></p>

</article>
</main>
</body>
</html>`;

// Fixture without global closed message → all open
const FIXTURE_OPEN = `
<!DOCTYPE html>
<html>
<body>
<article class="page-content mt-xl-4">
<div id="heading2"></div>
<h3>Training Grants</h3>
<ul>
  <li>Up to £250 for botanical training courses.</li>
</ul>
<p><a href="/learn/grants/training" class="btn btn-primary">Find out more</a></p>
</article>
</body>
</html>`;

const FIXTURE_EMPTY = `
<html><body><article class="page-content"><p>No grants listed.</p></article></body></html>`;

describe("parseBsbiPage", () => {
  it("parses 4 grant entries from the listing page", () => {
    const results = parseBsbiPage(FIXTURE);
    expect(results).toHaveLength(4);
  });

  it("extracts title from h3 following div[id^='heading']", () => {
    const results = parseBsbiPage(FIXTURE);
    expect(results[0].title).toBe("Training Grants");
  });

  it("extracts amount from ul li text", () => {
    const results = parseBsbiPage(FIXTURE);
    expect(results[0].amountRaw).toContain("£250");
  });

  it("extracts individual page URL from btn-primary link", () => {
    const results = parseBsbiPage(FIXTURE);
    expect(results[0].url).toContain("/learn/grants/training");
  });

  it("sets global status to closed when intro says 'now closed'", () => {
    const results = parseBsbiPage(FIXTURE);
    // Training, Identiplant, Plant Study should all be closed
    expect(results[0].status).toBe("closed");
    expect(results[1].status).toBe("closed");
    expect(results[2].status).toBe("closed");
  });

  it("overrides global closed status with specific date for Trial FISC", () => {
    const results = parseBsbiPage(FIXTURE);
    const fisc = results.find(r => r.title === "Trial FISC Grants");
    // Close date 28 Feb 2026 has passed → closed
    expect(fisc?.status).toBe("closed");
  });

  it("extracts close date from prose for Trial FISC Grants", () => {
    const results = parseBsbiPage(FIXTURE);
    const fisc = results.find(r => r.title === "Trial FISC Grants");
    expect(fisc?.deadlineRaw).toContain("2026");
  });

  it("extracts amount from prose p when no ul present", () => {
    const results = parseBsbiPage(FIXTURE);
    const fisc = results.find(r => r.title === "Trial FISC Grants");
    expect(fisc?.amountRaw).toContain("£175");
  });

  it("sets status to open when no global closed message", () => {
    const results = parseBsbiPage(FIXTURE_OPEN);
    expect(results[0].status).toBe("open");
  });

  it("returns empty array when no heading anchors", () => {
    expect(parseBsbiPage(FIXTURE_EMPTY)).toHaveLength(0);
  });
});

describe("normaliseBsbi", () => {
  const raw = {
    title: "Training Grants",
    url: "https://bsbi.org/learn/grants/training",
    status: "closed",
    amountRaw: "Up to £250",
    deadlineRaw: null,
  };

  it("sets source to bsbi", () => {
    expect(normaliseBsbi(raw).source).toBe("bsbi");
  });

  it("sets funder_slug to bsbi", () => {
    expect(normaliseBsbi(raw).funder_slug).toBe("bsbi");
  });

  it("sets funder_name", () => {
    expect(normaliseBsbi(raw).funder_name).toBe("Botanical Society of Britain and Ireland");
  });

  it("parses amount_max from 'Up to £250'", () => {
    expect(normaliseBsbi(raw).amount_max).toBe(25_000);
  });

  it("sets deadline_date null when deadlineRaw is null", () => {
    expect(normaliseBsbi(raw).deadline_date).toBeNull();
  });

  it("sets funding_type to grant", () => {
    expect(normaliseBsbi(raw).funding_type).toBe("grant");
  });

  it("sets scope to null (not hardcoded subject string)", () => {
    expect(normaliseBsbi(raw).scope).toBeNull();
  });

  it("generates a slug", () => {
    expect(normaliseBsbi(raw).slug).toBe("training-grants");
  });
});

const DETAIL_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <article class="page-content">
    <p>The BSBI offers annual grants of up to £250 for aspiring botanists who wish to undertake training courses from external providers. You do not need to be a BSBI member to apply, although members are favoured in the award process.</p>
    <p>Typical applicants include recent graduates looking to start a career in botany and amateur botanists interested in botanical recording.</p>
    <h3>Eligibility</h3>
    <p>Open to anyone with an interest in botany. Members are given priority in the selection process. Applicants must be based in Britain or Ireland.</p>
  </article>
</main>
</body>
</html>`;

describe("parseBsbiDetailPage", () => {
  it("extracts multi-paragraph description", () => {
    const { description } = parseBsbiDetailPage(DETAIL_FIXTURE);
    expect(description).not.toBeNull();
    expect(description).toContain("aspiring botanists");
    expect(description).toContain("Typical applicants");
  });

  it("extracts eligibility from Eligibility heading", () => {
    const { eligibility } = parseBsbiDetailPage(DETAIL_FIXTURE);
    expect(eligibility).not.toBeNull();
    expect(eligibility).toContain("Members are given priority");
  });

  it("returns nulls for empty page", () => {
    const { description, eligibility } = parseBsbiDetailPage("<html><body><main></main></body></html>");
    expect(description).toBeNull();
    expect(eligibility).toBeNull();
  });
});
