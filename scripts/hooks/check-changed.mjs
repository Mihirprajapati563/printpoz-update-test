// PostToolUse hook (advisory, non-blocking): notes the changed file and reminds the
// agent to keep the IPC contract + type-check in sync. The full type-check runs on Stop.
import { readFileSync } from "node:fs";

let evt = {};
try {
  evt = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}

const ti = evt.tool_input || evt.toolInput || {};
const file = ti.file_path || ti.path || "";

if (/electron[\\/].*\.ts$/.test(file)) {
  process.stdout.write(
    `[hook] Edited Electron TS: ${file}\n` +
      `       If this touched IPC, ensure electron/shared/ipc.ts (channel+type), the handler in\n` +
      `       electron/main/ipc/, and electron/preload/index.ts all stay in sync. Run: npm run typecheck:electron\n`
  );
}

process.exit(0);
