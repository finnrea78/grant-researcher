import type { IntakeData } from "./types";

export function stripEphemeralFields(
  intake: IntakeData
): Omit<IntakeData, "proposal_intent"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { proposal_intent, ...rest } = intake;
  return rest;
}
