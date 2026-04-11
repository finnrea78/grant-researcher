// src/lib/embedder.ts
// Server-only — only import in Next.js API routes, not client components.
import OpenAI from "openai";
import { withRetry } from "@/lib/retry";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI(); // reads OPENAI_API_KEY from env
  }
  return client;
}

export async function embedText(text: string): Promise<number[]> {
  const response = await withRetry(
    () => getClient().embeddings.create({ model: "text-embedding-3-small", input: text }),
    { maxRetries: 3 }
  );
  return response.data[0].embedding;
}
