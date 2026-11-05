#!/usr/bin/env node
/**
 * Cross-platform launcher for the standalone production build.
 *
 * `pnpm deploy` used to run `export PORT=3010 && node .next/standalone/server.js`,
 * which only works in a POSIX shell. This script sets the port for every
 * platform and keeps the working directory at the project root, which is where
 * `.next/standalone/server.js` expects to be started from.
 *
 * Usage: node scripts/start-standalone.mjs   (PORT defaults to 3010)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(ROOT, ".next", "standalone", "server.js");

if (!existsSync(server)) {
  console.error("[start] 找不到 .next/standalone/server.js，请先运行 pnpm build && pnpm copy");
  process.exit(1);
}

const port = (process.env.PORT ?? "").trim() || "3010";
console.log(`[start] standalone 服务启动：http://localhost:${port}`);

const child = spawn(process.execPath, [server], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, PORT: port },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill();
  });
}

child.on("exit", (code) => process.exit(code ?? 0));
