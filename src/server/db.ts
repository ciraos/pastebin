import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { config } from "./config";

/**
 * One pool per process. Next.js hot-reloads modules in dev, so the pool is kept
 * on `globalThis` to avoid leaking connections between reloads.
 */
const globalForDb = globalThis as unknown as {
  __pastebinPool?: Pool;
  __pastebinSchema?: Promise<void>;
};

function createPool(): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: false,
  });
  // Idle clients can error out (e.g. postgres restarted); never crash the server.
  pool.on("error", (error) => {
    console.error("[db] idle client error", error);
  });
  return pool;
}

/** Warn loudly when credentials and paste bodies would travel in the clear. */
function warnIfInsecure(): void {
  if (config.databaseSsl) return;
  let host = "";
  try {
    host = new URL(config.databaseUrl).hostname;
  } catch {
    return;
  }
  if (["127.0.0.1", "localhost", "::1", "0.0.0.0", ""].includes(host)) return;
  console.warn(
    `[db] DATABASE_SSL=false，正在以明文连接 ${host}：数据库密码与全部粘贴内容在网络上不加密。` +
      "请为该实例启用 TLS（DATABASE_SSL=true），或改走 SSH 隧道 / 内网访问。",
  );
}

export function pool(): Pool {
  if (!globalForDb.__pastebinPool) {
    warnIfInsecure();
    globalForDb.__pastebinPool = createPool();
  }
  return globalForDb.__pastebinPool;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    disabled      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    user_agent TEXT,
    ip         TEXT
);

CREATE TABLE IF NOT EXISTS pastes (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL,
    language        TEXT NOT NULL DEFAULT 'text',
    kind            TEXT NOT NULL DEFAULT 'code' CHECK (kind IN ('code', 'error', 'log', 'text')),
    visibility      TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('public', 'unlisted', 'private')),
    password_hash   TEXT,
    expires_at      TIMESTAMPTZ,
    burn_after_read BOOLEAN NOT NULL DEFAULT FALSE,
    views           BIGINT NOT NULL DEFAULT 0,
    -- NULL means the paste was published anonymously (no account owns it).
    owner_id        TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_pastes_owner ON pastes(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pastes_public ON pastes(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pastes_expires ON pastes(expires_at);

-- Small key/value store for site-wide settings edited in the admin backend.
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/** Upgrades for databases created by earlier versions. Each statement is idempotent. */
const MIGRATIONS_SQL = `
-- Anyone may publish, so a paste no longer needs an owning account.
ALTER TABLE pastes ALTER COLUMN owner_id DROP NOT NULL;
`;

async function migrate(client: PoolClient): Promise<void> {
  await client.query(SCHEMA_SQL);
  await client.query(MIGRATIONS_SQL);
}

/** Create the schema once per process; every query awaits it. */
export function ensureSchema(): Promise<void> {
  if (!globalForDb.__pastebinSchema) {
    globalForDb.__pastebinSchema = (async () => {
      const client = await pool().connect();
      try {
        await migrate(client);
      } finally {
        client.end();
      }
    })().catch((error) => {
      // Let the next request retry instead of caching a permanent failure.
      globalForDb.__pastebinSchema = undefined;
      throw error;
    });
  }
  return globalForDb.__pastebinSchema;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const result = await pool().query<T>(text, values as unknown[]);
  return result.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}

/** Run a set of statements in a transaction, rolling back on throw. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[db] rollback failed", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (globalForDb.__pastebinPool) {
    const active = globalForDb.__pastebinPool;
    globalForDb.__pastebinPool = undefined;
    globalForDb.__pastebinSchema = undefined;
    await active.end();
  }
}
