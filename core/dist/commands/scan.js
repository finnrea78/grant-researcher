import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { GRANT_SCANNER_PROMPT } from "../prompts/grant-scanner.js";
import { streamToConsole } from "../stream.js";
export async function scanCommand(options = {}, name) {
    const dataDir = resolve(process.cwd(), "data");
    const modeFlag = options.force ? "--force" : options.check ? "--check" : "";
    const modeDescription = options.force
        ? "FORCE mode: re-harvest all sources regardless of timestamps"
        : options.check
            ? "CHECK mode: only re-fetch sources older than 7 days"
            : "HARVEST mode: full harvest of all sources";
    // Build profile context for smart scan
    let profileContext = "";
    const allowedTools = ["Read", "Write", "Glob", "WebFetch"];
    if (name) {
        const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
        if (existsSync(profilePath)) {
            const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
            profileContext = `

Researcher profile provided for smart scan:
- Disciplinary fields: ${profile.disciplinary_fields?.join(", ") ?? "unknown"}
- Research themes: ${profile.research_themes?.join(", ") ?? "unknown"}
- Geographic focus: ${profile.geographic_focus?.join(", ") ?? "unknown"}

Use WebSearch to discover additional grant URLs relevant to these fields.`;
            allowedTools.push("WebSearch");
        }
    }
    console.log(`Scanning funding sources (${modeDescription})${name ? ` for ${name}` : ""}...`);
    await streamToConsole(query({
        prompt: `Harvest the funding database. ${modeFlag ? `Flag: ${modeFlag}` : "No flags passed."}

Mode: ${modeDescription}

URL list: ${dataDir}/funding-sources/_urls.md
Template: ${dataDir}/funding-sources/_template.md
Timestamps: ${dataDir}/funding-sources/_last-harvested.json
Funder files directory: ${dataDir}/funding-sources/${profileContext}`,
        options: {
            cwd: dataDir,
            systemPrompt: GRANT_SCANNER_PROMPT,
            allowedTools,
            permissionMode: "acceptEdits",
            maxTurns: 50,
        },
    }));
}
//# sourceMappingURL=scan.js.map