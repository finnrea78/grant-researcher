import { parseActionMedicalPage } from "../../src/sources/action-medical";
import { normaliseActionMedical } from "../../src/transforms/normalise-action-medical";

const PAGE_URL = "https://action.org.uk/research/apply-research-grant/apply-project-grant";

const FIXTURE_NO_CALLS = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Apply for a Project Grant</h1>
  <div id="no-calls" class="section__wrapper wrapper d-section">
    <div class="copy">
      <div class="copy__hgroup hgroup">
        <p class="hgroup__subtitle subtitle">We currently do not have an open project calls.</p>
      </div>
    </div>
  </div>
  <section id="past-calls" class="section section--text">
    <div class="copy__hgroup hgroup">
      <h2 class="hgroup__title title">Past calls</h2>
    </div>
    <div class="s-the-measure__intro">
      <em>THESE CALLS HAVE NOW CLOSED</em>
    </div>
  </section>
</main>
</body>
</html>`;

const FIXTURE_OPEN_CALL = `
<!DOCTYPE html>
<html lang="en">
<body>
<main>
  <h1>Apply for a Project Grant</h1>

  <section id="project-grant-2027-outline" class="section section--text">
    <div class="section__wrapper wrapper">
      <div class="copy">
        <div class="copy__hgroup hgroup">
          <h2 class="hgroup__title title">Project Grant 2027 Outline Application</h2>
        </div>
        <div class="copy__body">
          <div class="copy__text s-the-measure the-measure">
            <div class="simple-toggle simple-toggle--faqs">
              <h3 class="simple-toggle__marker">VIEW CALL DETAILS - click to expand</h3>
              <div class="simple-toggle__child">
                <p><span>Project Grants in Child Health: Applications are invited across the breadth of Action's remit.</span></p>
                <p><span><strong>Applications open:</strong> December 2026</span></p>
                <p><span><strong>Outline application deadline:</strong> 17 February 2027, 5pm</span></p>
                <p><span><strong>Full application deadline:</strong> 9 June 2027</span></p>
                <p><span><strong>Decision:</strong> Late November 2027</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="past-calls" class="section section--text">
    <div class="copy__hgroup hgroup">
      <h2 class="hgroup__title title">Past calls</h2>
    </div>
  </section>
</main>
</body>
</html>`;

describe("parseActionMedicalPage (no open calls)", () => {
  it("returns a single closed entry when #no-calls is present", () => {
    const result = parseActionMedicalPage(FIXTURE_NO_CALLS, PAGE_URL, "Project Grants");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("closed");
  });

  it("uses page h1 as title", () => {
    const result = parseActionMedicalPage(FIXTURE_NO_CALLS, PAGE_URL, "Project Grants");
    expect(result[0].title).toBe("Apply for a Project Grant");
  });

  it("sets all date fields to null when closed", () => {
    const result = parseActionMedicalPage(FIXTURE_NO_CALLS, PAGE_URL, "Project Grants");
    expect(result[0].deadlineRaw).toBeNull();
    expect(result[0].openDateRaw).toBeNull();
  });
});

describe("parseActionMedicalPage (open call)", () => {
  it("extracts the open call section", () => {
    const result = parseActionMedicalPage(FIXTURE_OPEN_CALL, PAGE_URL, "Project Grants");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("open");
  });

  it("extracts title from section heading", () => {
    const result = parseActionMedicalPage(FIXTURE_OPEN_CALL, PAGE_URL, "Project Grants");
    expect(result[0].title).toContain("Project Grant 2027");
  });

  it("extracts outline deadline", () => {
    const result = parseActionMedicalPage(FIXTURE_OPEN_CALL, PAGE_URL, "Project Grants");
    expect(result[0].deadlineRaw).toContain("February 2027");
  });

  it("extracts full application deadline", () => {
    const result = parseActionMedicalPage(FIXTURE_OPEN_CALL, PAGE_URL, "Project Grants");
    expect(result[0].fullDeadlineRaw).toContain("June 2027");
  });

  it("does not include past-calls content as open", () => {
    const result = parseActionMedicalPage(FIXTURE_OPEN_CALL, PAGE_URL, "Project Grants");
    expect(result.every(r => r.title !== "Past calls")).toBe(true);
  });
});

describe("normaliseActionMedical", () => {
  it("normalises a closed grant", () => {
    const raw = parseActionMedicalPage(FIXTURE_NO_CALLS, PAGE_URL, "Project Grants")[0];
    const result = normaliseActionMedical(raw);

    expect(result.source).toBe("action_medical");
    expect(result.funder_slug).toBe("action-medical-research");
    expect(result.status).toBe("closed");
    expect(result.amount_min).toBeNull();
  });

  it("normalises an open grant with full deadline date", () => {
    const raw = parseActionMedicalPage(FIXTURE_OPEN_CALL, PAGE_URL, "Project Grants")[0];
    const result = normaliseActionMedical(raw);

    expect(result.status).toBe("open");
    expect(result.deadline_date).toBe("2027-06-09");
  });
});
