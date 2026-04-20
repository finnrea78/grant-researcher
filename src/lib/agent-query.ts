import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";

/**
 * Wraps the Claude Agent SDK `query()` to work around macOS Gatekeeper
 * blocking the npm-bundled native binary (com.apple.provenance).
 *
 * Points the SDK at cli.js (the Node.js entrypoint) so it spawns via
 * `node cli.js` instead of the native binary. Uses process.cwd() because
 * Next.js RSC bundler rewrites require.resolve() to virtual paths.
 *
 * Requires SDK <=0.2.87 which ships cli.js. Later versions removed it
 * in favour of native-only binaries that macOS Gatekeeper blocks.
 */
export function agentQuery(opts: Parameters<typeof query>[0]) {
  const cliPath = resolve(
    process.cwd(),
    "node_modules/@anthropic-ai/claude-agent-sdk/cli.js"
  );

  opts = {
    ...opts,
    options: {
      ...opts.options,
      pathToClaudeCodeExecutable: cliPath,
    },
  };
  return query(opts);
}
