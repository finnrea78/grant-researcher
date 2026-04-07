// src/lib/embedder.ts
// Server-only — only import in Next.js API routes, not client components.
import OpenAI from "openai";

export async function embedText(text: string): Promise<number[]> {
  const client = new OpenAI(); // reads OPENAI_API_KEY from env
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}
