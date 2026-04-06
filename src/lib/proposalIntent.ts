import { existsSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { ProposalIntent } from "./types";

export function writeProposalIntent(
  researcherDir: string,
  intent?: ProposalIntent
): void {
  if (!intent || Object.values(intent).every((v) => !v)) return;
  writeFileSync(
    resolve(researcherDir, "proposal-intent.json"),
    JSON.stringify(intent, null, 2)
  );
}

export function cleanupProposalIntent(researcherDir: string): void {
  const path = resolve(researcherDir, "proposal-intent.json");
  if (existsSync(path)) unlinkSync(path);
}
