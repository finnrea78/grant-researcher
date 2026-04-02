export type StageStatus = "idle" | "running" | "complete" | "error";

export interface StageState {
  profile: StageStatus;
  enrich: StageStatus;
  scan: StageStatus;
  match: StageStatus;
  propose: StageStatus;
}

interface PipelineBarProps {
  stages: StageState;
  onRun: (stage: keyof StageState) => void;
}

const STAGE_LABELS: Record<keyof StageState, string> = {
  profile: "Profile",
  enrich: "Enrich",
  scan: "Scan",
  match: "Match",
  propose: "Propose",
};

const STAGE_ORDER: Array<keyof StageState> = ["profile", "enrich", "scan", "match", "propose"];

function isReady(stage: keyof StageState, stages: StageState): boolean {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === 0) return stages[stage] === "idle" || stages[stage] === "error";
  const prev = STAGE_ORDER[idx - 1];
  return stages[prev] === "complete" && (stages[stage] === "idle" || stages[stage] === "error");
}

export function PipelineBar({ stages, onRun }: PipelineBarProps) {
  return (
    <div className="flex w-full">
      {STAGE_ORDER.map((stage, idx) => {
        const status = stages[stage];
        const ready = isReady(stage, stages);

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

        const roundedLeft = idx === 0 ? "rounded-l-lg" : "";
        const roundedRight = idx === STAGE_ORDER.length - 1 ? "rounded-r-lg" : "";

        return (
          <div
            key={stage}
            className={`flex-1 border ${borderColor} ${bgColor} ${roundedLeft} ${roundedRight} px-3 py-3 text-center`}
          >
            <div className={`text-xs font-bold ${textColor}`}>{label}</div>
            {ready && stage !== "propose" && (
              <button
                onClick={() => onRun(stage)}
                className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Run
              </button>
            )}
            {status === "running" && (
              <div className="mt-1 text-xs text-blue-500 animate-pulse">running…</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
