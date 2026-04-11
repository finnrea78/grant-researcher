"use client";

import { useEffect, useState } from "react";
import { isReady, STAGE_ORDER } from "@/lib/pipelineStages";
export type { StageStatus, StageState } from "@/lib/pipelineStages";
export { isReady } from "@/lib/pipelineStages";

import type { StageState } from "@/lib/pipelineStages";
import { formatElapsed } from "@/lib/formatElapsed";

interface PipelineBarProps {
  stages: StageState;
  onRun: (stage: keyof StageState) => void;
  onSkip?: (stage: keyof StageState) => void;
  skippable?: ReadonlyArray<keyof StageState>;
  disabled?: boolean;
}

const STAGE_LABELS: Record<keyof StageState, string> = {
  profile: "Profile",
  enrich: "Enrich",
  scan: "Scan",
  match: "Match",
  propose: "Propose",
};

const STAGE_DESCRIPTIONS: Record<keyof StageState, string> = {
  profile: "Parse CV & build profile",
  enrich: "Research & enhance with web data",
  scan: "Harvest funding opportunities",
  match: "Score & rank opportunities",
  propose: "Draft proposal alignment",
};

function ElapsedTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return <span>{formatElapsed(seconds)}</span>;
}

export function PipelineBar({ stages, onRun, onSkip, skippable = [], disabled = false }: PipelineBarProps) {
  return (
    <div className="flex w-full">
      {STAGE_ORDER.map((stage, idx) => {
        const status = stages[stage];
        const ready = isReady(stage, stages);
        const canSkip = ready && skippable.includes(stage) && !!onSkip;

        const borderColor =
          status === "complete" ? "border-green-500" :
          status === "running" ? "border-blue-500" :
          status === "error" ? "border-red-500" :
          "border-slate-700";

        const bgColor =
          status === "complete" ? "bg-green-950" :
          status === "running" ? "bg-blue-950" :
          status === "error" ? "bg-red-950" :
          "bg-slate-900";

        const textColor =
          status === "complete" ? "text-green-400" :
          status === "running" ? "text-blue-400" :
          status === "error" ? "text-red-400" :
          "text-slate-500";

        const label =
          status === "complete" ? `✓ ${STAGE_LABELS[stage].toUpperCase()}` :
          status === "running" ? `● ${STAGE_LABELS[stage].toUpperCase()}` :
          status === "error" ? `✗ ${STAGE_LABELS[stage].toUpperCase()}` :
          `○ ${STAGE_LABELS[stage].toUpperCase()}`;

        const showDescription = ready || status === "running" || status === "complete";

        const roundedLeft = idx === 0 ? "rounded-l-lg" : "";
        const roundedRight = idx === STAGE_ORDER.length - 1 ? "rounded-r-lg" : "";

        return (
          <div
            key={stage}
            className={`flex-1 border ${borderColor} ${bgColor} ${roundedLeft} ${roundedRight} px-3 py-3 text-center`}
          >
            <div className={`text-xs font-bold ${textColor}`}>{label}</div>
            {showDescription && (
              <div className="mt-0.5 text-slate-600 text-[10px] leading-tight hidden lg:block">
                {STAGE_DESCRIPTIONS[stage]}
              </div>
            )}
            {ready && stage !== "propose" && (
              <div className="mt-1 flex items-center justify-center gap-2">
                <button
                  onClick={() => onRun(stage)}
                  disabled={disabled}
                  className="text-xs text-blue-400 hover:text-blue-300 underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Run
                </button>
                {canSkip && (
                  <button
                    onClick={() => onSkip(stage)}
                    disabled={disabled}
                    className="text-xs text-slate-500 hover:text-slate-400 underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Skip
                  </button>
                )}
              </div>
            )}
            {status === "complete" && stage === "scan" && (
              <div className="mt-1">
                <button
                  onClick={() => onRun(stage)}
                  disabled={disabled}
                  className="text-xs text-slate-500 hover:text-slate-400 underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Rescan
                </button>
              </div>
            )}
            {status === "complete" && stage === "match" && (
              <div className="mt-1">
                <button
                  onClick={() => onRun(stage)}
                  disabled={disabled}
                  className="text-xs text-slate-500 hover:text-slate-400 underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Rematch
                </button>
              </div>
            )}
            {status === "running" && (
              <div className="mt-1 text-xs text-blue-500 animate-pulse">
                <ElapsedTimer />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
