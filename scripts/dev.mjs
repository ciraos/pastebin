#!/usr/bin/env node
/**
 * Development entrypoint: make sure PostgreSQL is up, then start Next.js.
 *
 * Set SKIP_DB=1 to use an external database (DATABASE_URL) and skip the local
 * PostgreSQL bootstrap entirely.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = join(ROOT, "node_modules", "next", "dist", "bin", "next");

if (process.env.SKIP_DB !== "1") {
  const pg = spawnSync(process.execPath, [join(ROOT, "scripts", "pg.mjs"), "ensure"], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (pg.status !== 0) {
    console.error("[dev] 本地 PostgreSQL 启动失败；如果用的是外部数据库，请设置 SKIP_DB=1");
    process.exit(pg.status ?? 1);
  }
}

if (!existsSync(nextBin)) {
  console.error("[dev] 找不到 Next.js，请先运行 pnpm install");
  process.exit(1);
}

const web = spawn(process.execPath, [nextBin, "dev", "-p", "3128"], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!web.killed) web.kill();
  setTimeout(() => process.exit(code), 150);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
web.on("exit", (code) => shutdown(code ?? 0));
