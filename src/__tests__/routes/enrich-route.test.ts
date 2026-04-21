/**
 * Phase 5: Tests for enrich POST/PATCH route DB-first rewrite.
 * POST: injects researcher context from DB, agent outputs JSON findings (no file writes)
 * PATCH confirm: clears scholar_candidate, updates researcher identifier in DB
 * PATCH skip: clears scholar_candidate, sets pipeline_state.scholar_skip
 *
 * callHaiku tries the claude-agent-sdk first (local dev via Claude Code subscription),
 * falling back to @anthropic-ai/sdk when the CLI executable isn't available (e.g. Railway).
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: jest.fn(),
  upsertResearcher: jest.fn().mockResolvedValue("uuid-123"),
  updateResearcherProfile: jest.fn().mockResolvedValue(undefined),
  updateProfileEmbedding: jest.fn().mockResolvedValue(undefined),
  updateScholarCandidate: jest.fn().mockResolvedValue(undefined),
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/concurrency", () => ({
  agentQueue: { acquire: jest.fn().mockResolvedValue(undefined), release: jest.fn() },
}));

// Agent returns enriched fields + optional scholar candidate as JSON text.
// retrieval_summary is NOT in enriched_fields — Haiku generates it separately.
const enrichedOutput = {
  enriched_fields: {
    google_scholar_url: null,
    scholar_h_index: null,
  },
  scholar_candidate: {
    candidate_url: "https://scholar.google.com/citations?user=abc123",
    candidate_confidence: "high",
  },
  researcher_context_md: "# Researcher Context: Jane Smith\n\nActive researcher at UCL.",
};

const DEFAULT_HAIKU_SUMMARY = "Dr Jane Smith is a climate adaptation researcher at UCL.";

function sonnetIterator() {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield { type: "assistant", message: { content: [{ type: "text", text: JSON.stringify(enrichedOutput) }] } };
      yield { type: "result", is_error: false, total_cost_usd: 0.002, num_turns: 5 };
    },
  };
}

function haikuIterator(text = DEFAULT_HAIKU_SUMMARY) {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield { type: "assistant", message: { content: [{ type: "text", text }] } };
    },
  };
}

function failingIterator(msg = "service unavailable") {
  return {
    // eslint-disable-next-line require-yield
    [Symbol.asyncIterator]: async function* (): AsyncGenerator<never> {
      throw new Error(msg);
    },
  };
}

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: jest.fn() }));

// Mock the direct Anthropic SDK — used by the fallback path when the CLI isn't available
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import { POST, PATCH } from "@/app/api/session/[name]/enrich/route";
import {
  getResearcherFull,
  updateScholarCandidate,
  updatePipelineState,
  updateResearcherProfile,
  updateProfileEmbedding,
} from "@/lib/researcher-store";
import { query } from "@anthropic-ai/claude-agent-sdk";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const mockQuery = query as jest.Mock;
const MockedAnthropicCtor = Anthropic as unknown as jest.Mock;

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockUpdateScholarCandidate = updateScholarCandidate as jest.Mock;
const mockUpdatePipelineState = updatePipelineState as jest.Mock;
const mockUpdateResearcherProfile = updateResearcherProfile as jest.Mock;
const mockUpdateProfileEmbedding = updateProfileEmbedding as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;
const mockUnlinkSync = fs.unlinkSync as jest.Mock;

const RESEARCHER = {
  id: "uuid-123",
  slug: "jane-smith",
  name: "Jane Smith",
  cv_text: "Professor of Climate Science...",
  enriched_profile: {
    name: "Jane Smith",
    institution: "UCL",
    research_themes: ["climate"],
  },
  pipeline_state: { intake: true, profile: true },
  publications_md: "## Publications...",
  match_results_md: null,
  scholar_candidate: null,
  proposal_intent: null,
};

function makePostRequest(): Request {
  return new Request("http://localhost/api/session/jane-smith/enrich", { method: "POST" });
}

function makePatchRequest(body: object): Request {
  return new Request("http://localhost/api/session/jane-smith/enrich", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function drainStream(stream: Response): Promise<string> {
  const reader = stream.body!.getReader();
  let text = "";
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      if (typeof result.value === "string") {
        text += result.value;
      } else {
        text += new TextDecoder().decode(result.value as Uint8Array);
      }
    }
  }
  return text;
}

describe("POST /api/session/[name]/enrich (DB-first)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // First query() call = Sonnet enrichment; subsequent = Haiku retrieval_summary via agent SDK
    mockQuery.mockReturnValueOnce(sonnetIterator()).mockReturnValue(haikuIterator());
  });

  it("stores scholar_candidate from agent output in DB", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    await drainStream(stream);

    expect(mockUpdateScholarCandidate).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ candidate_url: expect.any(String) })
    );
  });

  it("sets pipeline_state.enrich = true after completion", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    await drainStream(stream);

    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ enrich: true })
    );
  });

  it("does not write to filesystem", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    await drainStream(stream);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("generates retrieval_summary via Haiku and persists it with the profile", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    await drainStream(stream);

    expect(mockUpdateResearcherProfile).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({
        retrieval_summary: "Dr Jane Smith is a climate adaptation researcher at UCL.",
      })
    );
  });

  it("calls updateProfileEmbedding with the Haiku-generated retrieval_summary", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    await drainStream(stream);

    expect(mockUpdateProfileEmbedding).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      "Dr Jane Smith is a climate adaptation researcher at UCL."
    );
  });

  it("emits generating-retrieval-summary tool event before Haiku call", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const sseText = await drainStream(stream);

    expect(sseText).toContain('"name":"generating-retrieval-summary"');
  });

  it("retries Haiku once on first failure then succeeds", async () => {
    jest.useFakeTimers();
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    // Reset to clear beforeEach's queued mockReturnValueOnce, then set full chain
    mockQuery.mockReset();
    mockQuery
      .mockReturnValueOnce(sonnetIterator())
      .mockReturnValueOnce(failingIterator("Haiku timeout"))
      .mockReturnValueOnce(haikuIterator());

    const streamPromise = POST(makePostRequest(), { params: { name: "jane-smith" } }).then(drainStream);
    await jest.runAllTimersAsync();
    await streamPromise;

    // query called 3 times: Sonnet + 2 Haiku attempts (non-CLI errors retry via agent SDK)
    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(mockUpdateResearcherProfile).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ retrieval_summary: DEFAULT_HAIKU_SUMMARY })
    );
    jest.useRealTimers();
  });

  it("emits SSE error and skips profile write if Haiku fails after retry", async () => {
    jest.useFakeTimers();
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    mockQuery.mockReset();
    mockQuery
      .mockReturnValueOnce(sonnetIterator())
      .mockReturnValueOnce(failingIterator())
      .mockReturnValueOnce(failingIterator());

    const streamPromise = POST(makePostRequest(), { params: { name: "jane-smith" } }).then(drainStream);
    await jest.runAllTimersAsync();
    const sseText = await streamPromise;

    expect(sseText).toContain('"type":"error"');
    expect(mockUpdateResearcherProfile).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("falls back to direct Anthropic SDK when Claude Code CLI is not available", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    const cliError = new Error("Claude Code executable not found at /app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js. Is options.pathToClaudeCodeExecutable set?");
    mockQuery.mockReset();
    mockQuery
      .mockReturnValueOnce(sonnetIterator())
      .mockReturnValueOnce({ [Symbol.asyncIterator]: async function* () { throw cliError; } });

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: DEFAULT_HAIKU_SUMMARY }],
    });
    MockedAnthropicCtor.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    await drainStream(stream);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockUpdateResearcherProfile).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ retrieval_summary: DEFAULT_HAIKU_SUMMARY })
    );
  });

  it("uses maxTurns: 4 for the Sonnet enrichment query", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    await drainStream(stream);

    const firstQueryCall = mockQuery.mock.calls[0][0];
    expect(firstQueryCall.options.maxTurns).toBe(4);
  });
});

describe("PATCH /api/session/[name]/enrich (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("confirm: clears scholar_candidate in DB", async () => {
    mockGetResearcherFull.mockResolvedValue({
      ...RESEARCHER,
      enriched_profile: {
        ...RESEARCHER.enriched_profile,
        identifiers: {},
      },
    });

    const res = await PATCH(
      makePatchRequest({ confirm: true, scholar_url: "https://scholar.google.com/citations?user=abc123" }),
      { params: { name: "jane-smith" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe("confirmed");
    expect(mockUpdateScholarCandidate).toHaveBeenCalledWith("jane-smith", "user-123", null);
  });

  it("skip: clears scholar_candidate and sets scholar_skip in pipeline_state", async () => {
    const res = await PATCH(
      makePatchRequest({ confirm: false }),
      { params: { name: "jane-smith" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe("skipped");
    expect(mockUpdateScholarCandidate).toHaveBeenCalledWith("jane-smith", "user-123", null);
    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ scholar_skip: true })
    );
  });

  it("does not use filesystem for confirm or skip", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    await PATCH(makePatchRequest({ confirm: false }), { params: { name: "jane-smith" } });

    expect(mockExistsSync).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
