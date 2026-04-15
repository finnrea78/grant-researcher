import { parseSalPage } from "../../src/sources/sal";
import { normaliseSal } from "../../src/transforms/normalise-sal";

// Current year for recurring deadline tests
const YEAR = new Date().getFullYear();
// April 15 2026 is "today" in this project context.
// January 15 has passed → resolves to next year.
// August 31 is future → resolves to current year.
const JAN_YEAR = YEAR + 1; // Jan 15 already passed in April
const AUG_YEAR = YEAR;     // Aug 31 still future in April

const FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
<ul uk-accordion>
  <!-- Skip: overview nav item -->
  <li>
    <a class="uk-accordion-title" href="#">
      <span>More information on Research and Travel Grants.</span>
    </a>
    <div class="uk-accordion-content">
      <p>Visit the grants page for more information.</p>
    </div>
  </li>
  <!-- Real grant item 1 -->
  <li>
    <a class="uk-accordion-title" href="#">
      <span>Research Awards: Grants of £500 to £5,000 for research into the human past through its material culture.</span>
    </a>
    <div class="uk-accordion-content">
      <p>Open to Fellows and Members of the Society who are engaged in research.</p>
      <p><strong>Amount of Award</strong></p>
      <p>£500 to £5,000</p>
      <p><strong>Deadline for Applications</strong></p>
      <p>15 January annually</p>
    </div>
  </li>
  <!-- Real grant item 2 -->
  <li>
    <a class="uk-accordion-title" href="#">
      <span>Janet Arnold Awards: Annual grants of £350 to £5,000 for research on the history of dress.</span>
    </a>
    <div class="uk-accordion-content">
      <p>For research on the history of dress and the materials of which it is made.</p>
      <p><strong>Award Amount</strong></p>
      <p>£350 to £5,000</p>
      <p><strong>Deadline for Applications</strong></p>
      <p>15 January annually</p>
    </div>
  </li>
  <!-- Travel bursary -->
  <li>
    <a class="uk-accordion-title" href="#">
      <span>Tessa and Mortimer Wheeler Travel Awards: Travel grants of up to £500 for undergraduate students.</span>
    </a>
    <div class="uk-accordion-content">
      <p>For undergraduate and first-year postgraduate students studying archaeology.</p>
      <p><strong>Award Amount</strong></p>
      <p>Up to £500</p>
      <p><strong>Deadline for Applications</strong></p>
      <p>31 August annually</p>
    </div>
  </li>
</ul>
</main>
</body>
</html>`;

const FIXTURE_NO_ACCORDION = `
<!DOCTYPE html>
<html><body><main><p>No grants listed.</p></main></body></html>`;

describe("parseSalPage", () => {
  it("parses 3 grant entries, skipping the nav item", () => {
    const results = parseSalPage(FIXTURE);
    expect(results).toHaveLength(3);
  });

  it("extracts title from span before the first colon", () => {
    const results = parseSalPage(FIXTURE);
    expect(results[0].title).toBe("Research Awards");
  });

  it("handles 'Amount of Award' label (item 2 inconsistency)", () => {
    const results = parseSalPage(FIXTURE);
    expect(results[0].amountRaw).toBe("£500 to £5,000");
  });

  it("handles 'Award Amount' label (items 3+)", () => {
    const results = parseSalPage(FIXTURE);
    expect(results[1].amountRaw).toBe("£350 to £5,000");
  });

  it("handles 'Up to £X' amount format", () => {
    const results = parseSalPage(FIXTURE);
    expect(results[2].amountRaw).toBe("Up to £500");
  });

  it("resolves 'annually' deadline to next future year for Jan (already passed)", () => {
    const results = parseSalPage(FIXTURE);
    expect(results[0].deadlineRaw).toContain(`January ${JAN_YEAR}`);
  });

  it("resolves 'annually' deadline to current year for August (still future)", () => {
    const results = parseSalPage(FIXTURE);
    expect(results[2].deadlineRaw).toContain(`August ${AUG_YEAR}`);
  });

  it("sets status based on resolved deadline", () => {
    const results = parseSalPage(FIXTURE);
    // Jan next year is in the future → open
    expect(results[0].status).toBe("open");
    // Aug this year is in the future → open
    expect(results[2].status).toBe("open");
  });

  it("extracts description from first non-label paragraph", () => {
    const results = parseSalPage(FIXTURE);
    expect(results[0].description).toContain("Fellows and Members");
  });

  it("skips the More information nav item", () => {
    const results = parseSalPage(FIXTURE);
    expect(results.map(r => r.title)).not.toContain("More information on Research and Travel Grants.");
  });

  it("returns empty array when no accordion present", () => {
    expect(parseSalPage(FIXTURE_NO_ACCORDION)).toHaveLength(0);
  });
});

describe("normaliseSal", () => {
  const raw = {
    title: "Research Awards",
    url: "https://www.sal.org.uk/what-we-do/grants/our-grant-programmes/",
    status: "open",
    description: "Open to Fellows and Members engaged in research into the human past.",
    amountRaw: "£500 to £5,000",
    deadlineRaw: `15 January ${JAN_YEAR}`,
  };

  it("sets source to sal", () => {
    expect(normaliseSal(raw).source).toBe("sal");
  });

  it("sets funder_slug to society-of-antiquaries-london", () => {
    expect(normaliseSal(raw).funder_slug).toBe("society-of-antiquaries-london");
  });

  it("parses amount_min from range lower bound", () => {
    expect(normaliseSal(raw).amount_min).toBe(50_000); // £500 in pence
  });

  it("parses amount_max from range upper bound", () => {
    expect(normaliseSal(raw).amount_max).toBe(500_000); // £5,000 in pence
  });

  it("parses deadline_date", () => {
    expect(normaliseSal(raw).deadline_date).toBe(`${JAN_YEAR}-01-15`);
  });

  it("sets funding_type to grant for research awards", () => {
    expect(normaliseSal(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to bursary for travel awards", () => {
    const travelRaw = { ...raw, title: "Tessa and Mortimer Wheeler Travel Awards" };
    expect(normaliseSal(travelRaw).funding_type).toBe("bursary");
  });

  it("sets scope to archaeology", () => {
    expect(normaliseSal(raw).scope).toContain("archaeology");
  });

  it("generates a slug", () => {
    expect(normaliseSal(raw).slug).toBe("research-awards");
  });
});
