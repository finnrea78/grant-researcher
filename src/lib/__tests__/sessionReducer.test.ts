import { reducer, INITIAL_STATE, type PageState } from "@/lib/sessionReducer";

const idle: PageState = INITIAL_STATE;

describe("sessionReducer", () => {
  describe("INIT", () => {
    it("sets stages to complete when flags are true", () => {
      const state = reducer(idle, {
        type: "INIT",
        profile: true,
        enrich: true,
        scan: true,
        match: true,
        proposals: [{ filename: "a.md", content: "x" }],
        matches: [],
        scholarCandidate: null,
      });
      expect(state.stages.profile).toBe("complete");
      expect(state.stages.enrich).toBe("complete");
      expect(state.stages.scan).toBe("complete");
      expect(state.stages.match).toBe("complete");
      expect(state.stages.propose).toBe("complete");
    });

    it("sets stages to idle when flags are false and no proposals", () => {
      const state = reducer(idle, {
        type: "INIT",
        profile: false,
        enrich: false,
        scan: false,
        match: false,
        proposals: [],
        matches: [],
        scholarCandidate: null,
      });
      expect(state.stages.profile).toBe("idle");
      expect(state.stages.propose).toBe("idle");
    });

    it("sets propose to idle when proposals array is empty", () => {
      const state = reducer(idle, {
        type: "INIT",
        profile: true,
        enrich: true,
        scan: true,
        match: true,
        proposals: [],
        matches: [],
        scholarCandidate: null,
      });
      expect(state.stages.propose).toBe("idle");
    });

    it("populates matches and proposals", () => {
      const matches = [{ scheme: "Fellowship", funder: "Wellcome", score: 8, tier: 1, amount: "£50k", deadline: "2026-01-01", status: "open" }];
      const proposals = [{ filename: "proposal.md", content: "# Proposal" }];
      const state = reducer(idle, {
        type: "INIT",
        profile: true,
        enrich: false,
        scan: false,
        match: true,
        proposals,
        matches,
        scholarCandidate: null,
      });
      expect(state.matches).toEqual(matches);
      expect(state.proposals).toEqual(proposals);
    });

    it("sets scholarCandidate from INIT", () => {
      const candidate = { candidate_url: "https://scholar.google.com/x", candidate_confidence: "high" as const };
      const state = reducer(idle, {
        type: "INIT",
        profile: false,
        enrich: false,
        scan: false,
        match: false,
        proposals: [],
        matches: [],
        scholarCandidate: candidate,
      });
      expect(state.scholarCandidate).toEqual(candidate);
    });
  });

  describe("START / COMPLETE / ERROR", () => {
    it("sets stage to running on START", () => {
      const state = reducer(idle, { type: "START", stage: "profile" });
      expect(state.stages.profile).toBe("running");
    });

    it("sets stage to complete on COMPLETE", () => {
      const state = reducer(idle, { type: "COMPLETE", stage: "scan" });
      expect(state.stages.scan).toBe("complete");
    });

    it("sets stage to error on ERROR", () => {
      const state = reducer(idle, { type: "ERROR", stage: "match" });
      expect(state.stages.match).toBe("error");
    });

    it("does not mutate other stages when transitioning one", () => {
      const state = reducer(idle, { type: "COMPLETE", stage: "profile" });
      expect(state.stages.enrich).toBe("idle");
      expect(state.stages.scan).toBe("idle");
    });
  });

  describe("LOG", () => {
    it("appends log entries with incrementing ids", () => {
      const event1 = { type: "text" as const, text: "hello" };
      const event2 = { type: "tool" as const, name: "read_file" };
      const s1 = reducer(idle, { type: "LOG", event: event1 });
      const s2 = reducer(s1, { type: "LOG", event: event2 });
      expect(s2.log).toHaveLength(2);
      expect(s2.log[0].id).toBe(0);
      expect(s2.log[1].id).toBe(1);
      expect(s2.log[0].event).toEqual(event1);
      expect(s2.log[1].event).toEqual(event2);
    });

    it("increments logCounter on each LOG", () => {
      const s1 = reducer(idle, { type: "LOG", event: { type: "text", text: "a" } });
      const s2 = reducer(s1, { type: "LOG", event: { type: "text", text: "b" } });
      expect(s2.logCounter).toBe(2);
    });
  });

  describe("SET_MATCHES / SET_PROPOSALS", () => {
    it("replaces matches on SET_MATCHES", () => {
      const matches = [{ scheme: "X", funder: "Y", score: 5, tier: 2, amount: "£10k", deadline: "2026-06-01", status: "open" }];
      const state = reducer(idle, { type: "SET_MATCHES", matches });
      expect(state.matches).toEqual(matches);
    });

    it("replaces proposals on SET_PROPOSALS", () => {
      const proposals = [{ filename: "p.md", content: "content" }];
      const state = reducer(idle, { type: "SET_PROPOSALS", proposals });
      expect(state.proposals).toEqual(proposals);
    });
  });

  describe("scholar candidate", () => {
    it("sets candidate on SET_SCHOLAR_CANDIDATE", () => {
      const candidate = { candidate_url: "https://scholar.google.com/y", candidate_confidence: "medium" as const };
      const state = reducer(idle, { type: "SET_SCHOLAR_CANDIDATE", candidate });
      expect(state.scholarCandidate).toEqual(candidate);
    });

    it("clears candidate on CLEAR_SCHOLAR_CANDIDATE", () => {
      const candidate = { candidate_url: "https://scholar.google.com/y", candidate_confidence: "high" as const };
      const s1 = reducer(idle, { type: "SET_SCHOLAR_CANDIDATE", candidate });
      const s2 = reducer(s1, { type: "CLEAR_SCHOLAR_CANDIDATE" });
      expect(s2.scholarCandidate).toBeNull();
    });
  });

  it("returns same state for unknown action", () => {
    // @ts-expect-error testing unknown action
    const state = reducer(idle, { type: "UNKNOWN" });
    expect(state).toEqual(idle);
  });
});
