#!/usr/bin/env node
import { Command } from "commander";
import { profileCommand } from "./commands/profile.js";
import { scanCommand } from "./commands/scan.js";
import { matchCommand } from "./commands/match.js";
import { proposeCommand } from "./commands/propose.js";
import { dashboardCommand } from "./commands/dashboard.js";
const program = new Command();
program
    .name("grant-scout")
    .description("AI-powered grant discovery for UK researchers")
    .version("0.1.0");
program
    .command("profile [name]")
    .description("Build or rebuild a researcher profile from their CV")
    .action(async (name = "will-rea") => {
    await profileCommand(name);
});
program
    .command("scan [name]")
    .description("Harvest or refresh the funding database from known URLs")
    .option("--check", "Only re-fetch sources older than 7 days")
    .option("--force", "Re-harvest everything, ignore timestamps")
    .action(async (name, options) => {
    await scanCommand(options, name);
});
program
    .command("match [name]")
    .description("Score and rank all funding opportunities against a researcher profile")
    .action(async (name = "will-rea") => {
    await matchCommand(name);
});
// propose accepts 2 or 3 positional args:
//   grant-scout propose <funder> <scheme>
//   grant-scout propose <name> <funder> <scheme>
program
    .command("propose <args...>")
    .description("Draft a strategic alignment document for a specific grant\n" +
    "  Usage: grant-scout propose <funder> <scheme>\n" +
    "         grant-scout propose <name> <funder> <scheme>")
    .action(async (args) => {
    if (args.length === 2) {
        await proposeCommand("will-rea", args[0], args[1]);
    }
    else if (args.length === 3) {
        await proposeCommand(args[0], args[1], args[2]);
    }
    else {
        console.error("Usage: grant-scout propose [name] <funder> <scheme>");
        process.exit(1);
    }
});
program
    .command("dashboard [days]")
    .description("Show a dev progress dashboard (commits, file changes, streak)")
    .action((days) => {
    dashboardCommand(days ? parseInt(days, 10) : 7);
});
program.parseAsync(process.argv).catch((err) => {
    console.error(err.message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map