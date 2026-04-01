import { spawnSync } from "child_process";
import { resolve } from "path";

export function dashboardCommand(days: number = 7): void {
  const scriptPath = resolve(process.cwd(), "scripts/dev-dashboard.sh");

  const result = spawnSync("bash", [scriptPath, String(days)], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
