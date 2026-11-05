#!/usr/bin/env node
/**
 * Local PostgreSQL helper for development.
 *
 * The project ships without a database server assumption: point DATABASE_URL at
 * any PostgreSQL instance (local, Docker, Neon, RDS...) and this script is not
 * needed. When no server is around, `db:ensure` boots a portable one from
 * `.pg/pgsql/bin` with its cluster in `data/pg`.
 *
 * Usage: node scripts/pg.mjs <init|start|stop|status|ensure>
 */
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const resolvePath = (value, fallback) => {
  const target = value && value.trim() ? value.trim() : fallback;
  return isAbsolute(target) ? target : resolve(ROOT, target);
};

const PG_BIN = resolvePath(process.env.PG_BIN, ".pg/pgsql/bin");
const PG_DATA = resolvePath(process.env.PG_DATA, "data/pg");
const PG_PORT = Number(process.env.PG_PORT || 5432);
const PG_USER = process.env.PG_USER || "pastebin";
const PG_PASSWORD = process.env.PG_PASSWORD || "pastebin";
const PG_DATABASE = process.env.PG_DATABASE || "pastebin";
const SUPERUSER = process.env.PG_SUPERUSER || "postgres";
const SUPERUSER_PASSWORD = process.env.PG_SUPERUSER_PASSWORD || "postgres";
const LOG_FILE = join(dirname(PG_DATA), "pg.log");

/** True when DATABASE_URL points at this machine (so bootstrapping is meaningful). */
function databaseIsLocal() {
  const raw = (process.env.DATABASE_URL ?? "").trim();
  if (!raw) return true;
  try {
    const host = new URL(raw).hostname;
    return ["127.0.0.1", "localhost", "::1", "0.0.0.0"].includes(host);
  } catch {
    return true;
  }
}

const bin = (name) => join(PG_BIN, process.platform === "win32" ? `${name}.exe` : name);

function run(command, args, extraEnv = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
}

/**
 * Readiness probe. A TCP connect is not enough: postmaster accepts sockets
 * while it is still recovering, so ask the server a real question.
 */
function canConnect() {
  const result = spawnSync(
    bin("psql"),
    ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", SUPERUSER, "-d", "postgres", "-tAc", "SELECT 1"],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, PGPASSWORD: SUPERUSER_PASSWORD } },
  );
  return result.status === 0 && result.stdout.trim() === "1";
}

function requireBinaries() {
  if (!existsSync(bin("postgres"))) {
    console.error(`[pg] 找不到 PostgreSQL 可执行文件：${bin("postgres")}`);
    console.error("[pg] 请下载 Windows 便携版解压到 .pg/pgsql（或设置 PG_BIN 指向已有安装）。");
    process.exit(1);
  }
}

function initCluster() {
  if (existsSync(join(PG_DATA, "PG_VERSION"))) {
    console.log(`[pg] 集群已存在：${PG_DATA}`);
    return;
  }
  requireBinaries();
  mkdirSync(dirname(PG_DATA), { recursive: true });
  const passwordFile = join(dirname(PG_DATA), ".pg-init-password");
  writeFileSync(passwordFile, `${SUPERUSER_PASSWORD}\n`, "utf8");
  console.log(`[pg] 初始化集群：${PG_DATA}`);
  const result = run(bin("initdb"), [
    "-D",
    PG_DATA,
    "-U",
    SUPERUSER,
    "--auth-local=trust",
    "--auth-host=scram-sha-256",
    `--pwfile=${passwordFile}`,
    "--encoding=UTF8",
    "--locale=C",
  ]);
  rmSync(passwordFile, { force: true });
  if (result.status !== 0) {
    console.error("[pg] initdb 失败");
    process.exit(result.status ?? 1);
  }
}

async function start() {
  if (!databaseIsLocal()) {
    const host = (() => {
      try {
        return new URL(process.env.DATABASE_URL).host;
      } catch {
        return "(自定义)";
      }
    })();
    console.log(`[pg] DATABASE_URL 指向外部数据库 ${host}，跳过本地 PostgreSQL 启动`);
    return;
  }
  requireBinaries();
  if (canConnect()) {
    console.log(`[pg] PostgreSQL 已在 127.0.0.1:${PG_PORT} 运行，跳过启动`);
    return;
  }
  initCluster();
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  console.log(`[pg] 启动 PostgreSQL（端口 ${PG_PORT}，日志 ${LOG_FILE}）`);

  // Detached + file-backed stdio: the server must survive the shell that
  // launched it (and must not keep that shell's pipes open).
  const logFd = openSync(LOG_FILE, "a");
  const server = spawn(
    bin("postgres"),
    ["-D", PG_DATA, "-p", String(PG_PORT), "-c", "listen_addresses=127.0.0.1"],
    { detached: true, stdio: ["ignore", logFd, logFd], windowsHide: true },
  );
  server.unref();
  closeSync(logFd);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (canConnect()) return;
    if (server.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error("[pg] 启动失败，查看日志：" + LOG_FILE);
  process.exit(1);
}

async function ensureRoleAndDatabase() {
  if (!databaseIsLocal()) return;
  const admin = { PGPASSWORD: SUPERUSER_PASSWORD };
  const role = run(
    bin("psql"),
    [
      "-h",
      "127.0.0.1",
      "-p",
      String(PG_PORT),
      "-U",
      SUPERUSER,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PG_USER}') THEN
           CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASSWORD}';
         END IF;
       END $$;`,
    ],
    admin,
  );
  if (role.status !== 0) {
    console.error("[pg] 创建角色失败");
    process.exit(role.status ?? 1);
  }

  const exists = spawnSync(
    bin("psql"),
    ["-h", "127.0.0.1", "-p", String(PG_PORT), "-U", SUPERUSER, "-d", "postgres", "-tAc",
      `SELECT 1 FROM pg_database WHERE datname = '${PG_DATABASE}'`],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...admin } },
  );
  if (exists.stdout.trim() === "1") {
    console.log(`[pg] 数据库 ${PG_DATABASE} 已存在`);
    return;
  }

  console.log(`[pg] 创建数据库 ${PG_DATABASE}（owner=${PG_USER}）`);
  const created = run(bin("createdb"), [
    "-h",
    "127.0.0.1",
    "-p",
    String(PG_PORT),
    "-U",
    SUPERUSER,
    "-O",
    PG_USER,
    PG_DATABASE,
  ], admin);
  if (created.status !== 0) process.exit(created.status ?? 1);
}

async function stop() {
  requireBinaries();
  if (!existsSync(join(PG_DATA, "PG_VERSION"))) {
    console.log("[pg] 没有本地集群，无需停止");
    return;
  }
  if (!canConnect()) {
    console.log("[pg] PostgreSQL 未运行，跳过停止");
    return;
  }
  run(bin("pg_ctl"), ["-D", PG_DATA, "-m", "fast", "-w", "stop"]);
}

async function status() {
  const up = canConnect();
  console.log(`[pg] 127.0.0.1:${PG_PORT} ${up ? "运行中" : "未运行"}`);
  if (!up) process.exitCode = 1;
}

const command = process.argv[2] || "ensure";

switch (command) {
  case "init":
    initCluster();
    break;
  case "start":
    await start();
    break;
  case "ensure":
    await start();
    await ensureRoleAndDatabase();
    break;
  case "stop":
    await stop();
    break;
  case "status":
    await status();
    break;
  default:
    console.error(`未知命令：${command}（可用：init / start / ensure / stop / status）`);
    process.exit(2);
}
