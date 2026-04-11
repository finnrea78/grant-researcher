import { TOTAL_STEPS, STEP_LABELS } from "@/components/ResearcherIntakeWizard.constants";

describe("ResearcherIntakeWizard step constants", () => {
  it("has 6 total steps", () => {
    expect(TOTAL_STEPS).toBe(6);
  });

  it("has 6 step labels", () => {
    expect(STEP_LABELS).toHaveLength(6);
  });

  it("has Proposal as the 4th step (index 3)", () => {
    expect(STEP_LABELS[3]).toBe("Proposal");
  });

  it("has CV Upload as the final step", () => {
    expect(STEP_LABELS[5]).toBe("CV Upload");
  });
});
