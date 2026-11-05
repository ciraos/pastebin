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
};

const SETTINGS_TAG = "site-settings";
const KEYS = {
  siteName: "site_name",
  icpNumber: "icp_number",
  policeNumber: "police_number",
} as const;

/** Fallback when nothing is configured in the database. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: config.appName,
  icpNumber: "",
  policeNumber: "",
};

function toSettings(rows: Array<{ key: string; value: string }>): SiteSettings {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const pick = (key: string) => (stored.get(key) ?? "").trim();
  return {
    siteName: pick(KEYS.siteName) || DEFAULT_SITE_SETTINGS.siteName,
    icpNumber: pick(KEYS.icpNumber),
    policeNumber: pick(KEYS.policeNumber),
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

export async function saveSiteSettings(input: SiteSettings): Promise<SiteSettings> {
  const entries: Array<[string, string]> = [
    [KEYS.siteName, input.siteName.trim()],
    [KEYS.icpNumber, input.icpNumber.trim()],
    [KEYS.policeNumber, input.policeNumber.trim()],
  ];
  for (const [key, value] of entries) {
    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value],
    );
  }
  // Reflect what was just written without an extra round trip.
  return {
    siteName: entries[0]![1] || DEFAULT_SITE_SETTINGS.siteName,
    icpNumber: entries[1]![1],
    policeNumber: entries[2]![1],
  };
}

export { SETTINGS_TAG };
