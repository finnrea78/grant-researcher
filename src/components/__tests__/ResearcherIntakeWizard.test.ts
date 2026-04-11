import { TOTAL_STEPS, STEP_LABELS } from "@/components/ResearcherIntakeWizard.constants";

describe("ResearcherIntakeWizard step constants — 3-step target", () => {
  it("TOTAL_STEPS is 3", () => {
    expect(TOTAL_STEPS).toBe(3);
  });

  it("STEP_LABELS has length 3", () => {
    expect(STEP_LABELS).toHaveLength(3);
  });

  it('STEP_LABELS[0] is "About You"', () => {
    expect(STEP_LABELS[0]).toBe("About You");
  });

  it('STEP_LABELS[1] is "Your Proposal"', () => {
    expect(STEP_LABELS[1]).toBe("Your Proposal");
  });

  it('STEP_LABELS[2] is "CV Upload"', () => {
    expect(STEP_LABELS[2]).toBe("CV Upload");
  });

  it('STEP_LABELS does not include "Career"', () => {
    expect(Array.from(STEP_LABELS)).not.toContain("Career");
  });

  it('STEP_LABELS does not include "Research"', () => {
    expect(Array.from(STEP_LABELS)).not.toContain("Research");
  });

  it('STEP_LABELS does not include "Eligibility"', () => {
    expect(Array.from(STEP_LABELS)).not.toContain("Eligibility");
  });
});
