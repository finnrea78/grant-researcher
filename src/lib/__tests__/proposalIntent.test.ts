import type { ProposalIntent, IntakeData } from "@/lib/types";
import { stripEphemeralFields } from "@/lib/stripEphemeral";
import { writeProposalIntent, cleanupProposalIntent } from "@/lib/proposalIntent";
import { PROFILE_BUILDER_PROMPT } from "@/lib/prompts/profile-builder";
import { MATCHER_PROMPT } from "@/lib/prompts/matcher";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── Phase 1: Type shapes (compile-time + runtime shape checks) ───────────────

describe("ProposalIntent type", () => {
  it("accepts an object with all fields", () => {
    const intent: ProposalIntent = {
      project_title: "AI-assisted protein folding",
      description: "A novel approach to structure prediction.",
      target_discipline: "Biochemistry",
      methodology: "Transformer-based deep learning",
    };
    expect(Object.keys(intent)).toEqual(
      expect.arrayContaining([
        "project_title",
        "description",
        "target_discipline",
        "methodology",
      ])
    );
  });

  it("accepts an empty object (all fields optional)", () => {
    const intent: ProposalIntent = {};
    expect(intent).toEqual({});
  });

  it("accepts a partial object", () => {
    const intent: ProposalIntent = { project_title: "Urban air quality sensors" };
    expect(intent.description).toBeUndefined();
  });
});

describe("IntakeData with proposal_intent", () => {
  it("accepts proposal_intent field on IntakeData", () => {
    const intake: IntakeData = {
      name: "Dr. Ada Lovelace",
      proposal_intent: {
        project_title: "Computational methods in history of science",
        description: "Applying ML to historical text analysis.",
      },
    };
    expect(intake.proposal_intent?.project_title).toBe(
      "Computational methods in history of science"
    );
  });

  it("is valid without proposal_intent (backward compat)", () => {
    const intake: IntakeData = { name: "Dr. Alan Turing" };
    expect(intake.proposal_intent).toBeUndefined();
  });
});

// ─── Phase 2: stripEphemeralFields ───────────────────────────────────────────

describe("stripEphemeralFields", () => {
  it("removes proposal_intent from IntakeData", () => {
    const intake: IntakeData = {
      name: "Dr. Alan Turing",
      institution: "Cambridge",
      proposal_intent: {
        project_title: "Morphogenesis and computation",
        description: "Exploring biological pattern formation.",
      },
    };
    const stripped = stripEphemeralFields(intake);
    expect(stripped).not.toHaveProperty("proposal_intent");
  });

  it("preserves all other fields after stripping", () => {
    const intake: IntakeData = {
      name: "Dr. Rosalind Franklin",
      institution: "King's College London",
      career_stage: "mid_career",
      research_themes: ["crystallography", "DNA structure"],
      proposal_intent: { project_title: "X-ray diffraction advances" },
    };
    const stripped = stripEphemeralFields(intake);
    expect(stripped.name).toBe("Dr. Rosalind Franklin");
    expect(stripped.institution).toBe("King's College London");
    expect(stripped.career_stage).toBe("mid_career");
    expect(stripped.research_themes).toEqual(["crystallography", "DNA structure"]);
  });

  it("handles intake with no proposal_intent gracefully", () => {
    const intake: IntakeData = { name: "Dr. Hedy Lamarr" };
    const stripped = stripEphemeralFields(intake);
    expect(stripped).not.toHaveProperty("proposal_intent");
    expect(stripped.name).toBe("Dr. Hedy Lamarr");
  });
});

// ─── Phase 3: Ephemeral file lifecycle ───────────────────────────────────────

describe("writeProposalIntent", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "grant-researcher-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes proposal-intent.json when intent has content", () => {
    const intent: ProposalIntent = {
      project_title: "Quantum biology in photosynthesis",
      description: "Investigating quantum coherence effects.",
      target_discipline: "Biophysics",
      methodology: "Ultrafast spectroscopy",
    };
    writeProposalIntent(tmpDir, intent);
    const filePath = join(tmpDir, "proposal-intent.json");
    expect(existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(parsed.project_title).toBe("Quantum biology in photosynthesis");
    expect(parsed.target_discipline).toBe("Biophysics");
  });

  it("writes when only some fields are present", () => {
    writeProposalIntent(tmpDir, { project_title: "Epigenetics in aging" });
    expect(existsSync(join(tmpDir, "proposal-intent.json"))).toBe(true);
  });

  it("does not write when intent is undefined", () => {
    writeProposalIntent(tmpDir, undefined);
    expect(existsSync(join(tmpDir, "proposal-intent.json"))).toBe(false);
  });

  it("does not write when all fields are empty strings", () => {
    writeProposalIntent(tmpDir, {
      project_title: "",
      description: "",
      target_discipline: "",
      methodology: "",
    });
    expect(existsSync(join(tmpDir, "proposal-intent.json"))).toBe(false);
  });
});

describe("cleanupProposalIntent", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "grant-researcher-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("deletes proposal-intent.json if it exists", () => {
    const filePath = join(tmpDir, "proposal-intent.json");
    writeProposalIntent(tmpDir, { project_title: "Test proposal" });
    expect(existsSync(filePath)).toBe(true);
    cleanupProposalIntent(tmpDir);
    expect(existsSync(filePath)).toBe(false);
  });

  it("is a no-op when proposal-intent.json does not exist", () => {
    expect(() => cleanupProposalIntent(tmpDir)).not.toThrow();
  });
});

// ─── Phase 5: Agent prompts reference proposal-intent.json ───────────────────

describe("Agent prompts include proposal-intent.json", () => {
  it("PROFILE_BUILDER_PROMPT handles proposal intent via user message", () => {
    // Profile stage is no longer agentic — the route reads proposal-intent.json
    // directly and embeds the data in the user message. The prompt describes the
    // "Proposal Intent" section rather than a file path.
    expect(PROFILE_BUILDER_PROMPT).toContain("Proposal intent");
  });

  it("MATCHER_PROMPT references the proposal-intent block", () => {
    // Matcher now receives proposal intent pre-injected as a <proposal-intent> XML block
    // in the user prompt — no file reads needed. The prompt references the block name.
    expect(MATCHER_PROMPT).toContain("proposal-intent");
  });
});
