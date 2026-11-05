#!/usr/bin/env node
/**
 * One-off import of the old SQLite database (data/pastebin.db) into PostgreSQL.
 *
 * Run AFTER the PostgreSQL schema exists (start `pnpm dev` once, or hit
 * /api/health). Existing rows with the same id are left untouched.
 *
 * Usage: node scripts/import-sqlite.mjs [--db data/pastebin.db] [--dry-run]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    let value = raw.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const sqlitePath = (() => {
  const value = option("--db", process.env.DATABASE_BACKUP ?? "data/pastebin.db");
  return isAbsolute(value) ? value : resolve(ROOT, value);
})();
const dryRun = flag("--dry-run");

if (!existsSync(sqlitePath)) {
  console.error(`[import] 找不到 SQLite 文件：${sqlitePath}`);
  process.exit(1);
}

const connectionString = (process.env.DATABASE_URL ?? "").trim();
if (!connectionString) {
  console.error("[import] .env 里没有 DATABASE_URL");
  process.exit(1);
}

const useSsl = (process.env.DATABASE_SSL ?? "").toLowerCase() === "true";
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

const users = sqlite.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
const pastes = sqlite.prepare("SELECT * FROM pastes ORDER BY created_at ASC").all();
console.log(`[import] SQLite: ${users.length} 个用户 / ${pastes.length} 条粘贴`);

if (dryRun) {
  for (const user of users) console.log("  user", user.email, user.role);
  for (const paste of pastes) console.log("  paste", paste.id, paste.title);
  process.exit(0);
}

const client = new pg.Client({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : undefined });
await client.connect();

let importedUsers = 0;
let importedPastes = 0;

try {
  for (const user of users) {
    const result = await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, role, disabled, created_at, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        user.id,
        user.email,
        user.password_hash,
        user.display_name,
        user.role,
        Boolean(user.disabled),
        user.created_at,
        user.last_login_at,
      ],
    );
    importedUsers += result.rowCount ?? 0;
  }

  for (const paste of pastes) {
    const result = await client.query(
      `INSERT INTO pastes (id, title, content, language, kind, visibility, password_hash,
                           expires_at, burn_after_read, views, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        paste.id,
        paste.title,
        paste.content,
        paste.language,
        paste.kind,
        paste.visibility,
        paste.password_hash,
        paste.expires_at,
        Boolean(paste.burn_after_read),
        paste.views,
        paste.owner_id,
        paste.created_at,
        paste.updated_at,
      ],
    );
    importedPastes += result.rowCount ?? 0;
  }
} finally {
  await client.end();
}

console.log(`[import] 完成：新增 ${importedUsers} 个用户 / ${importedPastes} 条粘贴（已存在的跳过）`);
