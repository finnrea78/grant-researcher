import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { PROPOSAL_OUTLINER_PROMPT } from "../prompts/proposal-outliner.js";
import { streamToConsole } from "../stream.js";

export async function proposeCommand(
  name: string = "will-rea",
  funder: string,
  scheme: string
): Promise<void> {
  const dataDir = resolve(process.cwd(), "data");

  // Build scheme slug for output filename (lowercase, hyphens)
  const schemeSlug = scheme
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  console.log(`Drafting proposal alignment for ${name} → ${funder} / ${scheme}...`);

  await streamToConsole(query({
    prompt: `Draft a strategic alignment document for researcher "${name}" applying to the "${scheme}" scheme from "${funder}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Funder file: ${dataDir}/funding-sources/${funder}.md
Target scheme: "${scheme}"
Write output to: ${dataDir}/outputs/${name}/proposals/${funder}-${schemeSlug}.md`,
    options: {
      cwd: dataDir,
      systemPrompt: PROPOSAL_OUTLINER_PROMPT,
      allowedTools: ["Read", "Write", "Glob"],
      permissionMode: "acceptEdits",
      maxTurns: 20,
    },
  }));
}
