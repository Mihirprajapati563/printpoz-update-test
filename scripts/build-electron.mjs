// Bundles the Electron main + preload TypeScript into dist-electron/ with esbuild.
// Usage: node scripts/build-electron.mjs [--watch]
import { build, context } from "esbuild";
import { rmSync } from "fs";

const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  external: ["electron"], // provided by the Electron runtime
  logLevel: "info",
};

const entries = [
  { entryPoints: ["electron/main/index.ts"], outfile: "dist-electron/main.js" },
  { entryPoints: ["electron/preload/index.ts"], outfile: "dist-electron/preload.js" },
];

try {
  rmSync("dist-electron", { recursive: true, force: true });
} catch {
  /* ignore */
}

if (watch) {
  for (const e of entries) {
    const ctx = await context({ ...common, ...e });
    await ctx.watch();
  }
} else {
  await Promise.all(entries.map((e) => build({ ...common, ...e })));
}
