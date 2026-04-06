import { TOTAL_STEPS, STEP_LABELS } from "@/components/ResearcherIntakeWizard.constants";

describe("ResearcherIntakeWizard step constants", () => {
  it("has 8 total steps", () => {
    expect(TOTAL_STEPS).toBe(8);
  });

  it("has 8 step labels", () => {
    expect(STEP_LABELS).toHaveLength(8);
  });

  it("has Proposal as the 4th step (index 3)", () => {
    expect(STEP_LABELS[3]).toBe("Proposal");
  });

  it("has CV Upload as the final step", () => {
    expect(STEP_LABELS[7]).toBe("CV Upload");
  });
});
