import { parseNuffieldPage, parseNuffieldDetailPage } from "../../src/sources/nuffield";
import { normaliseNuffield } from "../../src/transforms/normalise-nuffield";

// Fixture matches real Nuffield Foundation HTML structure (WordPress theme "salty")
const FIXTURE_HTML = `
<!DOCTYPE html>
<html lang="en-GB">
<body>
<ul class="fund-cards custom-list">
  <li class="fund-card">
    <a href="https://www.nuffieldfoundation.org/funding-for-research/main-grants">
      <span class="fund-card-tag fund-card-tag--open">Open</span>
      <div class="fund-card-content">
        <h3 class="fund-card-title">Main Grants (Research, Development and Analysis Fund)</h3>
        <ul class="fund-card-meta">
          <li><svg width="20" height="20"><path d="M0 0"/></svg>Up to £500,000</li>
          <li><svg width="20" height="20"><path d="M0 0"/></svg>Outline application deadline: October 2026</li>
          <li><svg width="20" height="20"><path d="M0 0"/></svg>Usually six months to three years</li>
        </ul>
        <div class="fund-card-description">
          <p>Funding for research projects that address one or more of our five interconnected priorities</p>
        </div>
      </div>
    </a>
  </li>

  <li class="fund-card">
    <a href="https://www.nuffieldfoundation.org/funding-for-research/racial-diversity-uk-fund">
      <span class="fund-card-tag fund-card-tag--closed">Closed</span>
      <div class="fund-card-content">
        <h3 class="fund-card-title">Racial Diversity UK Fund</h3>
        <ul class="fund-card-meta">
          <li><svg width="20" height="20"><path d="M0 0"/></svg>Up to £500,000</li>
          <li><svg width="20" height="20"><path d="M0 0"/></svg>Outline application deadline: October 2026</li>
          <li><svg width="20" height="20"><path d="M0 0"/></svg>Usually six months to three years</li>
        </ul>
        <div class="fund-card-description">
          <p>Research funding to understand the barriers and pathways to a racially just and inclusive society</p>
        </div>
      </div>
    </a>
  </li>

  <li class="fund-card">
    <a href="https://www.nuffieldfoundation.org/funding-for-research/oliver-bird-fund">
      <span class="fund-card-tag fund-card-tag--closed">Closed</span>
      <div class="fund-card-content">
        <h3 class="fund-card-title">Oliver Bird Fund</h3>
        <ul class="fund-card-meta">
          <li><svg width="20" height="20"><path d="M0 0"/></svg>Up to £750,000</li>
          <li><svg width="20" height="20"><path d="M0 0"/></svg>Up to 4 years</li>
        </ul>
        <div class="fund-card-description">
          <p>Support for research into the causes, prevention and treatment of rheumatic diseases</p>
        </div>
      </div>
    </a>
  </li>
</ul>
</body>
</html>`;

const FIXTURE_DETAIL = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Main Grants</h1>
  <p>The Nuffield Foundation funds research projects that address its five interconnected priorities aimed at improving lives in the UK.</p>
  <p>Projects typically last from six months to three years and receive grants of up to £500,000. Most awards are below £300,000.</p>
  <h2>Who can apply</h2>
  <p>Applicants must be employed by, or have formal affiliation with, a UK-based organisation.</p>
  <p>The Foundation does not fund individuals without formal institutional affiliation or PhD-focused work.</p>
</main>
</body>
</html>`;

describe("parseNuffieldDetailPage", () => {
  it("extracts multi-paragraph description", () => {
    const result = parseNuffieldDetailPage(FIXTURE_DETAIL);
    expect(result.description).not.toBeNull();
    expect(result.description).toContain("Nuffield Foundation");
    expect(result.description!.length).toBeGreaterThan(100);
  });

  it("extracts eligibility from who can apply section", () => {
    const result = parseNuffieldDetailPage(FIXTURE_DETAIL);
    expect(result.eligibility).not.toBeNull();
    expect(result.eligibility).toContain("UK-based organisation");
  });
});

describe("normaliseNuffield", () => {
  it("maps eligibility field", () => {
    const raw = {
      title: "Main Grants", url: "https://example.com", status: "open",
      amountRaw: null, deadlineRaw: null, durationRaw: null,
      description: "desc", eligibility: "Must be at a UK institution"
    };
    expect(normaliseNuffield(raw).eligibility).toBe("Must be at a UK institution");
  });
});

describe("parseNuffieldPage", () => {
  it("extracts all fund cards from the page", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result).toHaveLength(3);
  });

  it("maps scheme title", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[0].title).toBe("Main Grants (Research, Development and Analysis Fund)");
    expect(result[1].title).toBe("Racial Diversity UK Fund");
    expect(result[2].title).toBe("Oliver Bird Fund");
  });

  it("uses absolute URL from href", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[0].url).toBe(
      "https://www.nuffieldfoundation.org/funding-for-research/main-grants"
    );
  });

  it("detects open status from fund-card-tag--open class", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[0].status).toBe("open");
  });

  it("detects closed status from fund-card-tag--closed class", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[1].status).toBe("closed");
    expect(result[2].status).toBe("closed");
  });

  it("extracts amount raw text (SVG stripped)", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[0].amountRaw).toBe("Up to £500,000");
  });

  it("extracts deadline raw text (SVG stripped)", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[0].deadlineRaw).toBe("Outline application deadline: October 2026");
  });

  it("extracts duration raw text (SVG stripped)", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[0].durationRaw).toBe("Usually six months to three years");
  });

  it("sets durationRaw null when only two meta items present", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[2].durationRaw).toBeNull();
  });

  it("extracts description", () => {
    const result = parseNuffieldPage(FIXTURE_HTML);
    expect(result[0].description).toBe(
      "Funding for research projects that address one or more of our five interconnected priorities"
    );
  });

  it("throws on page with no fund cards", () => {
    expect(() => parseNuffieldPage("<html><body><main></main></body></html>")).toThrow();
  });
});
