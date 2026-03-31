import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { MATCHER_PROMPT } from "../prompts/matcher.js";
import { streamToConsole } from "../stream.js";
export async function matchCommand(name = "will-rea") {
    const dataDir = resolve(process.cwd(), "data");
    console.log(`Matching funding opportunities for ${name}...`);
    await streamToConsole(query({
        prompt: `Score and rank all funding opportunities for researcher "${name}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Funding sources directory: ${dataDir}/funding-sources/ (read all *.md files that do NOT start with _)
Write output to: ${dataDir}/outputs/${name}/matches.md

Remember: make ZERO web calls. All matching is based solely on local files.`,
        options: {
            cwd: dataDir,
            systemPrompt: MATCHER_PROMPT,
            // NO WebFetch — this is a hard constraint
            allowedTools: ["Read", "Write", "Glob"],
            permissionMode: "acceptEdits",
            maxTurns: 30,
        },
    }));
}
//# sourceMappingURL=match.js.map