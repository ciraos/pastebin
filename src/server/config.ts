import { randomBytes } from "node:crypto";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

const DEFAULT_DATABASE_URL = "postgres://pastebin:pastebin@127.0.0.1:5432/pastebin";

let sessionSecret = (process.env.SESSION_SECRET ?? "").trim();
if (!sessionSecret || sessionSecret === "change-me-to-a-long-random-string") {
  sessionSecret = randomBytes(48).toString("base64url");
  console.warn(
    "[config] SESSION_SECRET 未配置，已生成临时密钥：重启后登录状态会失效。请在 .env 中设置 SESSION_SECRET。",
  );
}

export const config = {
  appName: (process.env.APP_NAME ?? "Pastebin").trim() || "Pastebin",
  databaseUrl: (process.env.DATABASE_URL ?? "").trim() || DEFAULT_DATABASE_URL,
  databaseSsl: envBool("DATABASE_SSL", false),
  sessionSecret,
  sessionTtlDays: Math.max(1, envInt("SESSION_TTL_DAYS", 30)),
  cookieSecure: envBool("COOKIE_SECURE", false),
  maxPasteBytes: Math.max(1024, envInt("MAX_PASTE_BYTES", 1024 * 1024)),
  /** Publishing throttle; 0 disables it. */
  publishLimit: Math.max(0, envInt("PUBLISH_RATE_LIMIT", 5)),
  publishWindowSeconds: Math.max(1, envInt("PUBLISH_RATE_WINDOW", 60)),
} as const;

export const SESSION_COOKIE = "pb_session";
export const UNLOCK_COOKIE_TTL = 60 * 60;
