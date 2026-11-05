import { cacheLife, cacheTag } from "next/cache";
import { config } from "./config";
import { query } from "./db";

export type SiteSettings = {
  /** Site name shown in the header, footer and page titles. */
  siteName: string;
  /** ICP 备案号, e.g. "京ICP备12345678号-1". Empty means "not shown". */
  icpNumber: string;
  /** 公安备案号, e.g. "京公网安备 11010502030123号". Empty means "not shown". */
  policeNumber: string;
  /** Versioned URL of the uploaded site avatar, null when none is set. */
  avatarUrl: string | null;
};

const SETTINGS_TAG = "site-settings";
const KEYS = {
  siteName: "site_name",
  icpNumber: "icp_number",
  policeNumber: "police_number",
  avatar: "avatar",
  avatarVersion: "avatar_version",
} as const;

/** Avatars are stored as a `data:` URL in `settings`, capped at 512 KB. */
export const MAX_AVATAR_BYTES = 512 * 1024;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

const AVATAR_DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/;

/** Fallback when nothing is configured in the database. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: config.appName,
  icpNumber: "",
  policeNumber: "",
  avatarUrl: null,
};

export function isAvatarMimeType(value: string): value is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(value);
}

function toSettings(rows: Array<{ key: string; value: string }>): SiteSettings {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const pick = (key: string) => (stored.get(key) ?? "").trim();
  const avatar = pick(KEYS.avatar);
  const version = pick(KEYS.avatarVersion) || "0";
  return {
    siteName: pick(KEYS.siteName) || DEFAULT_SITE_SETTINGS.siteName,
    icpNumber: pick(KEYS.icpNumber),
    policeNumber: pick(KEYS.policeNumber),
    // The version in the query string lets the image be cached forever: a new
    // upload writes a new version, so the URL changes with it.
    avatarUrl: AVATAR_DATA_URL.test(avatar) ? `/api/site/avatar?v=${encodeURIComponent(version)}` : null,
  };
}

const SELECT_SETTINGS = "SELECT key, value FROM settings WHERE key = ANY($1)";

/**
 * Uncached read, used by the admin API so the editor always shows what is stored.
 * Per-request dedupe keeps a single render from querying twice.
 */
export async function readSiteSettings(): Promise<SiteSettings> {
  const rows = await query<{ key: string; value: string }>(SELECT_SETTINGS, [Object.values(KEYS)]);
  return toSettings(rows);
}

/**
 * Cached, tag-invalidated read for rendering. Falls back to defaults when the
 * database is unreachable (e.g. during a build on a machine without Postgres).
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("minutes");
  try {
    const rows = await query<{ key: string; value: string }>(SELECT_SETTINGS, [Object.values(KEYS)]);
    return toSettings(rows);
  } catch (error) {
    console.error("[settings] 读取站点设置失败，使用默认值", error);
    return DEFAULT_SITE_SETTINGS;
  }
}

async function upsert(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  );
}

export async function saveSiteSettings(
  input: Pick<SiteSettings, "siteName" | "icpNumber" | "policeNumber">,
): Promise<SiteSettings> {
  await upsert(KEYS.siteName, input.siteName.trim());
  await upsert(KEYS.icpNumber, input.icpNumber.trim());
  await upsert(KEYS.policeNumber, input.policeNumber.trim());
  return readSiteSettings();
}

/** Stores the avatar of an already-validated upload and bumps its cache version. */
export async function saveAvatar(bytes: Buffer, mime: AvatarMimeType): Promise<SiteSettings> {
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  await upsert(KEYS.avatar, dataUrl);
  await upsert(KEYS.avatarVersion, Date.now().toString(36));
  return readSiteSettings();
}

export async function clearAvatar(): Promise<SiteSettings> {
  await upsert(KEYS.avatar, "");
  await upsert(KEYS.avatarVersion, Date.now().toString(36));
  return readSiteSettings();
}

/** Raw avatar bytes for the public image route; null when nothing is stored. */
export async function readAvatar(): Promise<{ bytes: Buffer; mime: AvatarMimeType } | null> {
  const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = $1", [KEYS.avatar]);
  const raw = (rows[0]?.value ?? "").trim();
  const match = AVATAR_DATA_URL.exec(raw);
  if (!match) return null;
  const mime = match[1] as AvatarMimeType;
  return { bytes: Buffer.from(match[2]!.replace(/\s+/g, ""), "base64"), mime };
}

export { SETTINGS_TAG };
