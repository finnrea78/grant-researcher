// data-pipeline/src/lib/embedder.ts
import OpenAI from "openai";
import { withRetry } from "../utils/retry.js";

const MAX_CHARS = 32000; // ~8000 tokens for text-embedding-3-small

export function buildOpportunityText(opp: {
  name: string;
  description: string | null;
  scope: string | null;
  eligibility: string | null;
}): string {
  return [opp.name, opp.description, opp.scope, opp.eligibility]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(". ")
    .slice(0, MAX_CHARS);
}

export async function embedText(text: string): Promise<number[]> {
  const client = new OpenAI(); // reads OPENAI_API_KEY from env
  const response = await withRetry(
    () => client.embeddings.create({ model: "text-embedding-3-small", input: text }),
    { maxRetries: 3 }
  );
  return response.data[0].embedding;
}
