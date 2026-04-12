"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { PipelineBar } from "@/components/PipelineBar";
import type { StageState } from "@/lib/pipelineStages";
import { StageLog } from "@/components/StageLog";
import { MatchList } from "@/components/MatchList";
import { ProposalViewer } from "@/components/ProposalViewer";
import { ResearcherIntakeWizard } from "@/components/ResearcherIntakeWizard";
import type { SSEEvent } from "@/lib/sse";
import type { Match } from "@/lib/parseMatches";

const TIER_MAP: Record<string, 1 | 2 | 3> = { strong: 1, exploring: 2, longshot: 3, ineligible: 3 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMatch(r: any): Match | null {
  if (r.tier === "ineligible") return null;
  return {
    id: r.id as string | undefined,
    funder: (r.funder_slug ?? r.funder) as string,
    scheme: (r.scheme_slug ?? r.scheme) as string,
    score: (r.score_overall ?? r.score) as number,
    amount: (r.amount_raw ?? r.amount ?? "") as string,
    deadline: (r.deadline_raw ?? r.deadline ?? "") as string,
    tier: (TIER_MAP[r.tier] ?? 3) as 1 | 2 | 3,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsToMatches(rows: any[]): Match[] {
  return rows.flatMap((r) => { const m = rowToMatch(r); return m ? [m] : []; });
}
import { reducer, INITIAL_STATE } from "@/lib/sessionReducer";
import { formatProfileMarkdown } from "@/lib/formatProfileMarkdown";
import type { IntakeData, ResearcherProfile } from "@/lib/types";

export default function SessionPage({ params }: { params: { name: string } }) {
  const { name } = params;
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [scholarInput, setScholarInput] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const runningRef = useRef(false);

  // Edit-intake panel state
  const [editingIntake, setEditingIntake] = useState(false);
  const [currentIntake, setCurrentIntake] = useState<IntakeData | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const isRunning = Object.values(state.stages).some((s) => s === "running");

  // Load initial state on mount
  useEffect(() => {
    async function loadStatus() {
      try {
        const [statusRes, proposalRes] = await Promise.all([
          fetch(`/api/session/${name}/status`),
          fetch(`/api/session/${name}/proposal`),
        ]);
        if (!statusRes.ok || !proposalRes.ok) {
          setPageError("Failed to load session — try refreshing");
          return;
        }
        const status = await statusRes.json();
        const { proposals } = await proposalRes.json();

        let matches: Match[] = [];
        if (status.match) {
          const matchesRes = await fetch(`/api/session/${name}/matches`);
          const data = await matchesRes.json();
          matches = rowsToMatches(data.matches ?? []);
        }

        dispatch({ type: "INIT", ...status, proposals, matches });
      } catch {
        setPageError("Network error — is the server running?");
      } finally {
        setPageLoading(false);
      }
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

      if (!res.ok) {
        let msg = `Server error (${res.status})`;
        try {
          const body = await res.json();
          if (body.error) msg = body.error;
        } catch {}
        dispatch({ type: "LOG", event: { type: "error", message: msg } });
        dispatch({ type: "ERROR", stage });
        runningRef.current = false;
        return;
      }

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
            if (event.type === "match") {
              const m = rowToMatch(event.match);
              if (m) dispatch({ type: "APPEND_MATCH", match: m });
            } else {
              dispatch({ type: "LOG", event });
              if (event.type === "error") {
                dispatch({ type: "ERROR", stage });
                runningRef.current = false;
                return;
              }
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
        const data = await matchesRes.json();
        dispatch({ type: "SET_MATCHES", matches: rowsToMatches(data.matches ?? []) });
      }
      if (stage === "propose") {
        const proposalRes = await fetch(`/api/session/${name}/proposal`);
        const { proposals } = await proposalRes.json();
        dispatch({ type: "SET_PROPOSALS", proposals });
      }
      // After enrich completes, re-check status for a scholar candidate
      if (stage === "enrich") {
        const statusRes = await fetch(`/api/session/${name}/status`);
        const status = await statusRes.json();
        if (status.scholarCandidate) {
          dispatch({ type: "SET_SCHOLAR_CANDIDATE", candidate: status.scholarCandidate });
        }
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
      enrich: `/api/session/${name}/enrich`,
      scan: `/api/session/${name}/scan`,
      match: `/api/session/${name}/match`,
      propose: `/api/session/${name}/propose`,
    };
    runStage(stage, urls[stage]);
  }

  async function handleSkip(stage: keyof StageState) {
    if (stage === "scan") {
      await fetch(`/api/session/${name}/scan`, { method: "PATCH" });
      dispatch({ type: "COMPLETE", stage: "scan" });
    }
  }

  function handlePropose(funder: string, scheme: string, opportunityId?: string) {
    dispatch({ type: "SET_PROPOSING_SCHEME", scheme });
    runStage("propose", `/api/session/${name}/propose`, { funder, scheme, opportunityId });
  }

  async function handleScholarConfirm() {
    const url = scholarInput.trim() || state.scholarCandidate?.candidate_url;
    if (!url) return;
    await fetch(`/api/session/${name}/enrich`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true, scholar_url: url }),
    });
    dispatch({ type: "CLEAR_SCHOLAR_CANDIDATE" });
    // Re-run enrich with the confirmed URL
    runStage("enrich", `/api/session/${name}/enrich`);
  }

  async function handleScholarSkip() {
    await fetch(`/api/session/${name}/enrich`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: false }),
    });
    dispatch({ type: "CLEAR_SCHOLAR_CANDIDATE" });
    dispatch({ type: "COMPLETE", stage: "enrich" });
  }

  async function handleEditClick() {
    const res = await fetch(`/api/session/${name}/intake`);
    if (!res.ok) return;
    const { intake } = await res.json();
    setCurrentIntake(intake as IntakeData);
    setEditingIntake(true);
  }

  async function handleEditSubmit(formData: FormData) {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/session/${name}/intake`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) return;
      dispatch({ type: "RESET" });
      setEditingIntake(false);
      setCurrentIntake(null);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDownloadProfile() {
    const res = await fetch(`/api/session/${name}/profile`);
    if (!res.ok) return;
    const { profile } = await res.json() as { profile: ResearcherProfile };
    const markdown = formatProfileMarkdown(profile);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-profile.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const scholarBannerCandidate =
    state.stages.enrich !== "complete" && state.stages.enrich !== "running"
      ? state.scholarCandidate
      : null;

  const showMatches = state.stages.match === "complete" || state.matches.length > 0;
  const showProposals = state.proposals.length > 0;
  const showDownload = state.stages.profile === "complete";

  const header = (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm mb-3 inline-block transition-colors">
          ← All profiles
        </Link>
        <h1 className="text-xl font-bold text-slate-100">Grant Scout</h1>
        <p className="text-slate-500 text-sm mt-1">{name}</p>
      </div>
      <div className="flex items-center gap-3 mt-1">
        {showDownload && !editingIntake && (
          <button
            onClick={handleDownloadProfile}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            Download profile ↓
          </button>
        )}
        {!isRunning && (
          <button
            onClick={editingIntake ? () => setEditingIntake(false) : handleEditClick}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            {editingIntake ? "Cancel" : "Edit profile"}
          </button>
        )}
      </div>
    </div>
  );

  if (pageLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        {header}
        <div className="flex w-full animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 border border-slate-800 bg-slate-900 px-3 py-3 text-center
                ${i === 0 ? "rounded-l-lg" : ""} ${i === 4 ? "rounded-r-lg" : ""}`}
            >
              <div className="h-3 bg-slate-700 rounded w-3/4 mx-auto" />
            </div>
          ))}
        </div>
        <div className="mt-4 bg-slate-950 border border-slate-800 rounded-lg p-4 h-48 animate-pulse flex items-center justify-center">
          <p className="text-slate-700 text-sm">Loading session…</p>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        {header}
        <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-4">
          <p className="text-red-300 text-sm">{pageError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {header}

      {editingIntake ? (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <p className="text-slate-400 text-sm mb-5">
            Update your intake information. The pipeline will reset and you can re-run each stage.
          </p>
          <ResearcherIntakeWizard
            onSubmit={handleEditSubmit}
            loading={editLoading}
            initialIntake={currentIntake ?? undefined}
          />
        </div>
      ) : (
        <>
          <PipelineBar
            stages={state.stages}
            onRun={handleRun}
            onSkip={handleSkip}
            skippable={["scan"]}
            disabled={isRunning}
          />

          {scholarBannerCandidate && (
            <div className="mt-4 border border-blue-700 bg-blue-950 rounded-lg px-4 py-4">
              <p className="text-blue-300 text-sm font-semibold mb-1">
                Google Scholar profile found
                {scholarBannerCandidate.candidate_confidence === "medium" && (
                  <span className="ml-2 text-yellow-400 font-normal">(medium confidence)</span>
                )}
              </p>
              <a
                href={scholarBannerCandidate.candidate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline text-sm break-all"
              >
                {scholarBannerCandidate.candidate_url}
              </a>
              <p className="text-slate-400 text-xs mt-2 mb-3">Is this your Google Scholar profile?</p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleScholarConfirm}
                    disabled={isRunning}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Yes, confirm
                  </button>
                  <button
                    onClick={handleScholarSkip}
                    disabled={isRunning}
                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-sm px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Skip
                  </button>
                </div>
                <div className="flex gap-2 items-center mt-1">
                  <input
                    type="url"
                    placeholder="Or paste the correct URL…"
                    value={scholarInput}
                    onChange={(e) => setScholarInput(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={handleScholarConfirm}
                    disabled={!scholarInput.trim() || isRunning}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Use this
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <StageLog entries={state.log} />
          </div>

          {showMatches && (
            <MatchList
              matches={state.matches}
              onPropose={handlePropose}
              proposing={state.stages.propose === "running"}
              proposingScheme={state.proposingScheme}
              disabled={isRunning}
            />
          )}

          {showProposals && (
            <ProposalViewer proposals={state.proposals} />
          )}
        </>
      )}
    </main>
  );
}
