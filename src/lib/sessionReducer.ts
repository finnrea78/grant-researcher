import type { StageState, StageStatus } from "@/lib/pipelineStages";
import type { SSEEvent } from "@/lib/sse";
import type { Match } from "@/lib/parseMatches";
import type { ScholarCandidate } from "@/lib/types";

export interface LogEntry { event: SSEEvent; id: number; }
export interface Proposal { filename: string; content: string; }

export interface PageState {
  stages: StageState;
  log: LogEntry[];
  matches: Match[];
  proposals: Proposal[];
  scholarCandidate: ScholarCandidate | null;
  proposingScheme: string | null;
  logCounter: number;
}

export type Action =
  | { type: "INIT"; profile: boolean; enrich: boolean; scan: boolean; match: boolean; proposals: Proposal[]; matches: Match[]; scholarCandidate: ScholarCandidate | null }
  | { type: "START"; stage: keyof StageState }
  | { type: "COMPLETE"; stage: keyof StageState }
  | { type: "ERROR"; stage: keyof StageState }
  | { type: "LOG"; event: SSEEvent }
  | { type: "SET_MATCHES"; matches: Match[] }
  | { type: "APPEND_MATCH"; match: Match }
  | { type: "SET_PROPOSALS"; proposals: Proposal[] }
  | { type: "CLEAR_SCHOLAR_CANDIDATE" }
  | { type: "SET_SCHOLAR_CANDIDATE"; candidate: ScholarCandidate }
  | { type: "SET_PROPOSING_SCHEME"; scheme: string }
  | { type: "CLEAR_PROPOSING_SCHEME" }
  | { type: "RESET" };

export function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        stages: {
          profile: action.profile ? "complete" : "idle",
          enrich: action.enrich ? "complete" : "idle",
          scan: action.scan ? "complete" : "idle",
          match: action.match ? "complete" : "idle",
          propose: action.proposals.length > 0 ? "complete" : "idle",
        },
        matches: action.matches,
        proposals: action.proposals,
        scholarCandidate: action.scholarCandidate,
      };
    case "START":
      return { ...state, stages: { ...state.stages, [action.stage]: "running" as StageStatus } };
    case "COMPLETE":
      return {
        ...state,
        stages: { ...state.stages, [action.stage]: "complete" as StageStatus },
        proposingScheme: action.stage === "propose" ? null : state.proposingScheme,
      };
    case "ERROR":
      return {
        ...state,
        stages: { ...state.stages, [action.stage]: "error" as StageStatus },
        proposingScheme: action.stage === "propose" ? null : state.proposingScheme,
      };
    case "LOG":
      return {
        ...state,
        log: [...state.log, { event: action.event, id: state.logCounter }],
        logCounter: state.logCounter + 1,
      };
    case "SET_MATCHES":
      return { ...state, matches: action.matches };
    case "APPEND_MATCH": {
      // Avoid duplicates — replace if same scheme+funder already streamed
      const existing = state.matches.findIndex(
        (m) => m.scheme === action.match.scheme && m.funder === action.match.funder
      );
      const matches = existing >= 0
        ? state.matches.map((m, i) => (i === existing ? action.match : m))
        : [...state.matches, action.match];
      return { ...state, matches };
    }
    case "SET_PROPOSALS":
      return { ...state, proposals: action.proposals };
    case "CLEAR_SCHOLAR_CANDIDATE":
      return { ...state, scholarCandidate: null };
    case "SET_SCHOLAR_CANDIDATE":
      return { ...state, scholarCandidate: action.candidate };
    case "SET_PROPOSING_SCHEME":
      return { ...state, proposingScheme: action.scheme };
    case "CLEAR_PROPOSING_SCHEME":
      return { ...state, proposingScheme: null };
    case "RESET":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

export const INITIAL_STATE: PageState = {
  stages: { profile: "idle", enrich: "idle", scan: "idle", match: "idle", propose: "idle" },
  log: [],
  matches: [],
  proposals: [],
  scholarCandidate: null,
  proposingScheme: null,
  logCounter: 0,
};
