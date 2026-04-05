import { isReady } from "@/lib/pipelineStages";
import type { StageState } from "@/lib/pipelineStages";

const allIdle: StageState = {
  profile: "idle",
  enrich: "idle",
  scan: "idle",
  match: "idle",
  propose: "idle",
};

function stages(overrides: Partial<StageState>): StageState {
  return { ...allIdle, ...overrides };
}

describe("isReady (pipeline stage readiness)", () => {
  describe("profile (first stage)", () => {
    it("is ready when idle", () => {
      expect(isReady("profile", allIdle)).toBe(true);
    });

    it("is ready when error (can re-run)", () => {
      expect(isReady("profile", stages({ profile: "error" }))).toBe(true);
    });

    it("is not ready when running", () => {
      expect(isReady("profile", stages({ profile: "running" }))).toBe(false);
    });

    it("is not ready when complete", () => {
      expect(isReady("profile", stages({ profile: "complete" }))).toBe(false);
    });
  });

  describe("enrich (second stage)", () => {
    it("is ready when profile complete and enrich idle", () => {
      expect(isReady("enrich", stages({ profile: "complete" }))).toBe(true);
    });

    it("is ready when profile complete and enrich error", () => {
      expect(isReady("enrich", stages({ profile: "complete", enrich: "error" }))).toBe(true);
    });

    it("is not ready when profile is not complete", () => {
      expect(isReady("enrich", allIdle)).toBe(false);
      expect(isReady("enrich", stages({ profile: "running" }))).toBe(false);
      expect(isReady("enrich", stages({ profile: "error" }))).toBe(false);
    });

    it("is not ready when enrich is already running", () => {
      expect(isReady("enrich", stages({ profile: "complete", enrich: "running" }))).toBe(false);
    });

    it("is not ready when enrich is already complete", () => {
      expect(isReady("enrich", stages({ profile: "complete", enrich: "complete" }))).toBe(false);
    });
  });

  describe("scan (third stage)", () => {
    it("is ready when enrich complete and scan idle", () => {
      expect(isReady("scan", stages({ profile: "complete", enrich: "complete" }))).toBe(true);
    });

    it("is not ready when enrich is not complete", () => {
      expect(isReady("scan", stages({ profile: "complete" }))).toBe(false);
    });
  });

  describe("match (fourth stage)", () => {
    it("is ready when scan complete and match idle", () => {
      expect(isReady("match", stages({ profile: "complete", enrich: "complete", scan: "complete" }))).toBe(true);
    });

    it("is not ready when scan is not complete", () => {
      expect(isReady("match", stages({ profile: "complete", enrich: "complete" }))).toBe(false);
    });
  });

  describe("propose (fifth stage)", () => {
    it("is ready when match complete and propose idle", () => {
      expect(isReady("propose", stages({ profile: "complete", enrich: "complete", scan: "complete", match: "complete" }))).toBe(true);
    });

    it("is not ready when match is not complete", () => {
      expect(isReady("propose", stages({ profile: "complete", enrich: "complete", scan: "complete" }))).toBe(false);
    });
  });
});
