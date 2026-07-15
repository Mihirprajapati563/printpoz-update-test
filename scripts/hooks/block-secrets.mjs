// PreToolUse hook: blocks writing secret-like values into any file.
// Enforces the "no secrets in the client" rule from .claude/rules/security.md.
// Reads the hook event JSON from stdin; on a match, denies the tool call (exit 2).
import { readFileSync } from "node:fs";

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let evt = {};
try {
  evt = JSON.parse(raw || "{}");
} catch {
  process.exit(0);
}

const ti = evt.tool_input || evt.toolInput || {};
const haystack = [ti.content, ti.new_string, ti.newString, ti.replace, JSON.stringify(ti)]
  .filter(Boolean)
  .join("\n");

const PATTERNS = [
  { name: "OpenAI key", re: /sk-[A-Za-z0-9_\-]{20,}/ },
  { name: "Google client secret", re: /GOCSPX-[A-Za-z0-9_\-]{10,}/ },
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: "Slack token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
];

const hit = PATTERNS.find((p) => p.re.test(haystack));
if (hit) {
  const reason =
    `Blocked: a ${hit.name} was about to be written to a client file. ` +
    `Secrets must never be bundled — route via the backend or use safeStorage. ` +
    `See .claude/rules/security.md.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.stderr.write(reason + "\n");
  process.exit(2);
}

process.exit(0);
