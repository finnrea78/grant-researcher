export type StageStatus = "idle" | "running" | "complete" | "error";

export interface StageState {
  profile: StageStatus;
  enrich: StageStatus;
  scan: StageStatus;
  match: StageStatus;
  propose: StageStatus;
}

export const STAGE_ORDER: Array<keyof StageState> = ["profile", "enrich", "scan", "match", "propose"];

export function isReady(stage: keyof StageState, stages: StageState): boolean {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === 0) return stages[stage] === "idle" || stages[stage] === "error";
  const prev = STAGE_ORDER[idx - 1];
  return stages[prev] === "complete" && (stages[stage] === "idle" || stages[stage] === "error");
}
