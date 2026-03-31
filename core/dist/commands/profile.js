import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { PROFILE_BUILDER_PROMPT } from "../prompts/profile-builder.js";
import { streamToConsole } from "../stream.js";
export async function profileCommand(name = "will-rea") {
    const dataDir = resolve(process.cwd(), "data");
    console.log(`Building profile for ${name}...`);
    await streamToConsole(query({
        prompt: `Build a researcher profile for "${name}".

Read the CV at: ${dataDir}/researchers/${name}/raw/cv.md

Write outputs to:
- ${dataDir}/researchers/${name}/profile.json
- ${dataDir}/researchers/${name}/publications.md`,
        options: {
            cwd: dataDir,
            systemPrompt: PROFILE_BUILDER_PROMPT,
            allowedTools: ["Read", "Write", "Glob"],
            permissionMode: "acceptEdits",
            maxTurns: 20,
        },
    }));
}
//# sourceMappingURL=profile.js.map