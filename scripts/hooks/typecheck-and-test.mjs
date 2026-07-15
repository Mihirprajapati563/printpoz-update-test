// Stop hook (advisory, non-blocking): type-checks the Electron TypeScript layer when the
// agent finishes a turn, so type regressions surface immediately. Never blocks the turn.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("node_modules")) {
  process.stdout.write("[hook] Skipping type-check — run `npm install` first.\n");
  process.exit(0);
}

try {
  execSync("npx tsc -p electron/tsconfig.json", { stdio: "pipe" });
  process.stdout.write("[hook] ✓ Electron type-check passed.\n");
} catch (e) {
  const out = (e && (e.stdout?.toString() || e.message)) || "unknown error";
  process.stdout.write("[hook] ✗ Electron type-check failed:\n" + out + "\n");
}

process.exit(0);
