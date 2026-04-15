import { parseBloodCancerUKPage } from "../../src/sources/blood-cancer-uk";
import { normaliseBloodCancerUK } from "../../src/transforms/normalise-blood-cancer-uk";

const FIXTURE_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <section>
    <h2>Annual funding calls</h2>
    <p>We run annual funding calls across our portfolio.</p>

    <div>
      <a href="/research/for-researchers/funding-calls/innovative-pilot-grants/">
        <img src="/images/researchers.jpg" alt="Researchers in lab">
        <h3>Innovative Pilot Grants</h3>
        <p>Our Innovative Pilot Grants help researchers develop pilot data for novel blood cancer research ideas.</p>
        <p>Find out more</p>
        <p><strong>Call closed</strong></p>
        <p><strong>Next call: Autumn 2026</strong></p>
      </a>
    </div>

    <div>
      <a href="/research/for-researchers/funding-calls/project-grants/">
        <img src="/images/lab.jpg" alt="Lab">
        <h3>Project Grants</h3>
        <p>Our project grants support world class research proposals that aim to address vital questions in blood cancer.</p>
        <p>Find out more</p>
        <p><strong>Call closed</strong></p>
      </a>
    </div>

    <div>
      <a href="/research/for-researchers/funding-calls/early-career-fellowships/">
        <img src="/images/fellowship.jpg" alt="Fellowship">
        <h3>Early Career Fellowships</h3>
        <p>Our fellowships help early career blood cancer researchers make the next steps in their careers.</p>
        <p>Find out more</p>
        <p><strong>Call open</strong></p>
        <p><strong>Next call: Spring 2027</strong></p>
      </a>
    </div>

  </section>
</main>
</body>
</html>`;

describe("parseBloodCancerUKPage", () => {
  it("extracts all funding scheme entries", () => {
    const result = parseBloodCancerUKPage(FIXTURE_HTML);
    expect(result).toHaveLength(3);
  });

  it("maps title from h3", () => {
    const result = parseBloodCancerUKPage(FIXTURE_HTML);
    expect(result[0].title).toBe("Innovative Pilot Grants");
    expect(result[1].title).toBe("Project Grants");
    expect(result[2].title).toBe("Early Career Fellowships");
  });

  it("constructs absolute URL from relative href", () => {
    const result = parseBloodCancerUKPage(FIXTURE_HTML);
    expect(result[0].url).toBe(
      "https://bloodcancer.org.uk/research/for-researchers/funding-calls/innovative-pilot-grants/"
    );
  });

  it("detects closed status from 'Call closed' text", () => {
    const result = parseBloodCancerUKPage(FIXTURE_HTML);
    expect(result[0].status).toBe("closed");
    expect(result[1].status).toBe("closed");
  });

  it("detects open status from 'Call open' text", () => {
    const result = parseBloodCancerUKPage(FIXTURE_HTML);
    expect(result[2].status).toBe("open");
  });

  it("extracts next call from strong tag", () => {
    const result = parseBloodCancerUKPage(FIXTURE_HTML);
    expect(result[0].nextCallRaw).toBe("Autumn 2026");
    expect(result[2].nextCallRaw).toBe("Spring 2027");
  });

  it("returns null nextCallRaw when not present", () => {
    const result = parseBloodCancerUKPage(FIXTURE_HTML);
    expect(result[1].nextCallRaw).toBeNull();
  });

  it("extracts description from first <p>", () => {
    const result = parseBloodCancerUKPage(FIXTURE_HTML);
    expect(result[0].description).toContain("pilot data");
  });

  it("throws when no scheme entries found", () => {
    expect(() =>
      parseBloodCancerUKPage("<html><body><main><section><h2>Title</h2></section></main></body></html>")
    ).toThrow("no funding scheme entries found");
  });
});

describe("normaliseBloodCancerUK", () => {
  it("normalises a closed scheme", () => {
    const raw = parseBloodCancerUKPage(FIXTURE_HTML)[0];
    const result = normaliseBloodCancerUK(raw);

    expect(result.source).toBe("blood_cancer_uk");
    expect(result.funder_slug).toBe("blood-cancer-uk");
    expect(result.status).toBe("closed");
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
    expect(result.source_metadata).toMatchObject({ next_call: "Autumn 2026" });
  });

  it("normalises an open scheme", () => {
    const raw = parseBloodCancerUKPage(FIXTURE_HTML)[2];
    const result = normaliseBloodCancerUK(raw);
    expect(result.status).toBe("open");
  });
});
