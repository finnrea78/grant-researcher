import { parseIolantheListingPage } from "../../src/sources/iolanthe";
import { normaliseIolanthe } from "../../src/transforms/normalise-iolanthe";

const LISTING_FIXTURE = `
<!DOCTYPE html>
<html>
<body>
<main>
  <h1>Apply for an Award</h1>
  <p>Iolanthe Midwifery Trust offers several awards to support midwives and student midwives.</p>

  <h2>The Nicolette Peel Award</h2>
  <p>Awarded for: Training, self-development and conferences for midwives and students.</p>
  <p>Award Amount: Maximum £2,000</p>
  <p>Eligibility: NMC registered midwife or student midwife on a UK NMC approved programme.</p>
  <p>Next Application Round: 1 December 2026 – 1 February 2027</p>
  <p>Applications are closed.</p>
  <a href="/node/292">Full Award Details</a>

  <h2>The Midwifery Research Fellowship</h2>
  <p>Awarded for: Supporting midwives beginning doctoral write-up for a midwifery-led research project.</p>
  <p>Award Amount: Maximum £25,000</p>
  <p>Eligibility: NMC registered midwife beginning doctoral write-up phase.</p>
  <p>Next Application Round: 1 December 2026 – 1 February 2027</p>
  <a href="/node/301">Full Award Details</a>

  <h2>The Dora Opoku Midwives Award</h2>
  <p>Awarded for: Training, self-development and conferences specifically for Black and Brown midwives.</p>
  <p>Award Amount: Maximum £1,500</p>
  <p>Eligibility: Black or Brown NMC registered midwife.</p>
  <p>Next Application Round: 1 December 2026 – 1 February 2027</p>
  <p>Applications are now open for pilot round.</p>
  <a href="/node/305">Full Award Details</a>

  <h2>What do we fund?</h2>
  <p>We fund training, research, and service improvement projects.</p>
</main>
</body>
</html>`;

describe("parseIolantheListingPage", () => {
  it("parses multiple award entries", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("strips leading 'The' from award title", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const peel = results.find(r => r.title.includes("Nicolette"));
    expect(peel?.title).toBe("Nicolette Peel Award");
  });

  it("extracts description from 'Awarded for:' label", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const peel = results.find(r => r.title.includes("Nicolette"));
    expect(peel?.description).toContain("Training");
  });

  it("extracts amount from 'Award Amount:' label", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const peel = results.find(r => r.title.includes("Nicolette"));
    expect(peel?.amountRaw).toContain("£2,000");
  });

  it("extracts fellowship amount correctly", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const fellowship = results.find(r => r.title.includes("Research Fellowship"));
    expect(fellowship?.amountRaw).toContain("£25,000");
  });

  it("extracts eligibility from 'Eligibility:' label", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const peel = results.find(r => r.title.includes("Nicolette"));
    expect(peel?.eligibility).toContain("NMC registered midwife");
  });

  it("extracts deadline date from application round", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const peel = results.find(r => r.title.includes("Nicolette"));
    expect(peel?.deadlineRaw).toContain("2026");
  });

  it("sets status to closed by default", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const peel = results.find(r => r.title.includes("Nicolette"));
    expect(peel?.status).toBe("closed");
  });

  it("sets status to open when 'Applications are now open'", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const dora = results.find(r => r.title.includes("Dora Opoku"));
    expect(dora?.status).toBe("open");
  });

  it("builds absolute URL from /node/ link", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    const peel = results.find(r => r.title.includes("Nicolette"));
    expect(peel?.url).toBe("https://iolanthe.org/node/292");
  });

  it("skips navigation headings like 'What do we fund?'", () => {
    const results = parseIolantheListingPage(LISTING_FIXTURE);
    expect(results.map(r => r.title)).not.toContain("do we fund?");
  });

  it("deduplicates award entries with same title", () => {
    const html = `<html><body><main>
      <h2>Nicolette Peel Award</h2><p>Award Amount: Maximum £2,000</p>
      <h2>Nicolette Peel Award</h2><p>Award Amount: Maximum £2,000</p>
    </main></body></html>`;
    const results = parseIolantheListingPage(html);
    expect(results.filter(r => r.title === "Nicolette Peel Award")).toHaveLength(1);
  });
});

describe("normaliseIolanthe", () => {
  const raw = {
    title: "Nicolette Peel Award",
    url: "https://iolanthe.org/node/292",
    status: "closed",
    description: "Training, self-development and conferences for midwives and students.",
    eligibility: "NMC registered midwife or student midwife.",
    amountRaw: "Maximum £2,000",
    deadlineRaw: "1 December 2026",
  };

  it("sets source to iolanthe", () => {
    expect(normaliseIolanthe(raw).source).toBe("iolanthe");
  });

  it("sets funder_slug to iolanthe-midwifery-trust", () => {
    expect(normaliseIolanthe(raw).funder_slug).toBe("iolanthe-midwifery-trust");
  });

  it("sets funder_name", () => {
    expect(normaliseIolanthe(raw).funder_name).toBe("Iolanthe Midwifery Trust");
  });

  it("parses amount_max from 'Maximum £2,000'", () => {
    expect(normaliseIolanthe(raw).amount_max).toBe(200_000);
  });

  it("sets funding_type to grant for award", () => {
    expect(normaliseIolanthe(raw).funding_type).toBe("grant");
  });

  it("sets funding_type to fellowship for fellowship", () => {
    const fellowRaw = { ...raw, title: "Midwifery Research Fellowship" };
    expect(normaliseIolanthe(fellowRaw).funding_type).toBe("fellowship");
  });

  it("sets scope to null", () => {
    expect(normaliseIolanthe(raw).scope).toBeNull();
  });

  it("passes eligibility through", () => {
    expect(normaliseIolanthe(raw).eligibility).toContain("NMC registered");
  });

  it("generates a slug", () => {
    expect(normaliseIolanthe(raw).slug).toBe("nicolette-peel-award");
  });

  it("parses deadline_date from '1 December 2026'", () => {
    expect(normaliseIolanthe(raw).deadline_date).toBe("2026-12-01");
  });
});
