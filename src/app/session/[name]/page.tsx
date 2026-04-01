"use client";

import { useEffect, useReducer, useRef } from "react";
import { PipelineBar, type StageState, type StageStatus } from "@/components/PipelineBar";
import { StageLog } from "@/components/StageLog";
import { MatchList } from "@/components/MatchList";
import { ProposalViewer } from "@/components/ProposalViewer";
import type { SSEEvent } from "@/lib/sse";
import type { Match } from "@/lib/parseMatches";

interface LogEntry { event: SSEEvent; id: number; }
interface Proposal { filename: string; content: string; }

interface PageState {
  stages: StageState;
  log: LogEntry[];
  matches: Match[];
  proposals: Proposal[];
  logCounter: number;
}

type Action =
  | { type: "INIT"; profile: boolean; scan: boolean; match: boolean; proposals: Proposal[]; matches: Match[] }
  | { type: "START"; stage: keyof StageState }
  | { type: "COMPLETE"; stage: keyof StageState }
  | { type: "ERROR"; stage: keyof StageState }
  | { type: "LOG"; event: SSEEvent }
  | { type: "SET_MATCHES"; matches: Match[] }
  | { type: "SET_PROPOSALS"; proposals: Proposal[] };

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        stages: {
          profile: action.profile ? "complete" : "idle",
          scan: action.scan ? "complete" : "idle",
          match: action.match ? "complete" : "idle",
          propose: action.proposals.length > 0 ? "complete" : "idle",
        },
        matches: action.matches,
        proposals: action.proposals,
      };
    case "START":
      return { ...state, stages: { ...state.stages, [action.stage]: "running" as StageStatus } };
    case "COMPLETE":
      return { ...state, stages: { ...state.stages, [action.stage]: "complete" as StageStatus } };
    case "ERROR":
      return { ...state, stages: { ...state.stages, [action.stage]: "error" as StageStatus } };
    case "LOG":
      return {
        ...state,
        log: [...state.log, { event: action.event, id: state.logCounter }],
        logCounter: state.logCounter + 1,
      };
    case "SET_MATCHES":
      return { ...state, matches: action.matches };
    case "SET_PROPOSALS":
      return { ...state, proposals: action.proposals };
    default:
      return state;
  }
}

const INITIAL_STATE: PageState = {
  stages: { profile: "idle", scan: "idle", match: "idle", propose: "idle" },
  log: [],
  matches: [],
  proposals: [],
  logCounter: 0,
};

export default function SessionPage({ params }: { params: { name: string } }) {
  const { name } = params;
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const runningRef = useRef(false);

  // Load initial state on mount
  useEffect(() => {
    async function loadStatus() {
      const [statusRes, proposalRes] = await Promise.all([
        fetch(`/api/session/${name}/status`),
        fetch(`/api/session/${name}/proposal`),
      ]);
      const status = await statusRes.json();
      const { proposals } = await proposalRes.json();

      let matches: Match[] = [];
      if (status.match) {
        const matchesRes = await fetch(`/api/session/${name}/matches`);
        const data = await matchesRes.json();
        matches = data.matches ?? [];
      }

      dispatch({ type: "INIT", ...status, proposals, matches });
    }
    loadStatus();
  }, [name]);

  async function runStage(stage: keyof StageState, url: string, body?: object) {
    if (runningRef.current) return;
    runningRef.current = true;
    dispatch({ type: "START", stage });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            dispatch({ type: "LOG", event });
            if (event.type === "error") {
              dispatch({ type: "ERROR", stage });
              runningRef.current = false;
              return;
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      dispatch({ type: "COMPLETE", stage });

      // After stage completes, load any new data
      if (stage === "match") {
        const matchesRes = await fetch(`/api/session/${name}/matches`);
        const { matches } = await matchesRes.json();
        dispatch({ type: "SET_MATCHES", matches });
      }
      if (stage === "propose") {
        const proposalRes = await fetch(`/api/session/${name}/proposal`);
        const { proposals } = await proposalRes.json();
        dispatch({ type: "SET_PROPOSALS", proposals });
      }
    } catch (err) {
      dispatch({ type: "LOG", event: { type: "error", message: String(err) } });
      dispatch({ type: "ERROR", stage });
    } finally {
      runningRef.current = false;
    }
  }

  function handleRun(stage: keyof StageState) {
    const urls: Record<keyof StageState, string> = {
      profile: `/api/session/${name}/profile`,
      scan: `/api/session/${name}/scan`,
      match: `/api/session/${name}/match`,
      propose: `/api/session/${name}/propose`,
    };
    runStage(stage, urls[stage]);
  }

  function handlePropose(funder: string, scheme: string) {
    runStage("propose", `/api/session/${name}/propose`, { funder, scheme });
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Grant Scout</h1>
        <p className="text-slate-500 text-sm mt-1">{name}</p>
      </div>

      <PipelineBar stages={state.stages} onRun={handleRun} />

      <div className="mt-4">
        <StageLog entries={state.log} />
      </div>

      {state.matches.length > 0 && (
        <MatchList
          matches={state.matches}
          onPropose={handlePropose}
          proposing={state.stages.propose === "running"}
        />
      )}

      {state.proposals.length > 0 && (
        <ProposalViewer proposals={state.proposals} />
      )}
    </main>
  );
}
