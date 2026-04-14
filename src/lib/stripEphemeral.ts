import type { IntakeData } from "./types";

// proposal_intent is now persisted in researchers.proposal_intent — no ephemeral fields remain.
export function stripEphemeralFields(intake: IntakeData): IntakeData {
  return intake;
}
