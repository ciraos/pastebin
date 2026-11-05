import { randomInt, randomBytes } from "node:crypto";
import { config } from "./config";
import { one, query } from "./db";
import { fail } from "./http";
import { verifyUnlockToken } from "./password";
import type { SessionUser } from "./session";
import { isExpired, serializePaste, type PasteRow } from "./serialize";

export const EXTENSIONS: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  tsx: "tsx",
  jsx: "jsx",
  python: "py",
  bash: "sh",
  shell: "sh",
  json: "json",
  yaml: "yml",
  yml: "yml",
  html: "html",
  xml: "xml",
  css: "css",
  sql: "sql",
  java: "java",
  kotlin: "kt",
  go: "go",
  rust: "rs",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  php: "php",
  ruby: "rb",
  swift: "swift",
  dockerfile: "dockerfile",
  diff: "diff",
  markdown: "md",
  text: "txt",
  log: "log",
  plaintext: "txt",
};

export const PASTE_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const SUMMARY_SELECT = `
  SELECT p.id, p.title, p.language, p.kind, p.visibility, p.password_hash,
         p.expires_at, p.burn_after_read, p.views, p.owner_id,
         p.created_at, p.updated_at,
         octet_length(p.content)::int AS size,
         substr(p.content, 1, 320) AS preview_raw,
         u.display_name AS owner_name
  FROM pastes p
  LEFT JOIN users u ON u.id = p.owner_id
`;

export const DETAIL_SELECT = SUMMARY_SELECT.replace("substr(p.content, 1, 320) AS preview_raw", "p.content");

export function unlockCookieName(pasteId: string): string {
  return `pb_unlock_${pasteId}`;
}

export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function newPasteId(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let candidate = "";
    for (let index = 0; index < 8; index += 1) {
      candidate += PASTE_ID_ALPHABET[randomInt(PASTE_ID_ALPHABET.length)];
    }
    const taken = await one("SELECT 1 FROM pastes WHERE id = $1", [candidate]);
    if (!taken) return candidate;
  }
  return randomBytes(9).toString("base64url").replace(/[-_]/g, "").slice(0, 12);
}

export async function fetchPaste(pasteId: string, { detail = true } = {}): Promise<PasteRow | null> {
  const sql = `${detail ? DETAIL_SELECT : SUMMARY_SELECT} WHERE p.id = $1`;
  return one<PasteRow>(sql, [pasteId]);
}

export function isOwnerOf(row: PasteRow, viewer: SessionUser | null): boolean {
  return viewer !== null && row.owner_id !== null && viewer.id === row.owner_id;
}

export function isAdmin(viewer: SessionUser | null): boolean {
  return viewer?.role === "admin";
}

/**
 * Throws the same 404 / 410 / 401 the previous backend returned.
 * Administrators moderate every paste, so they bypass the private/password gates.
 */
export function checkAccess(
  row: PasteRow,
  viewer: SessionUser | null,
  unlockToken: string | null | undefined,
  { passwordOk = false } = {},
): void {
  const owner = isOwnerOf(row, viewer);
  const admin = isAdmin(viewer);
  if (row.visibility === "private" && !owner && !admin) {
    throw fail(404, "not_found", "粘贴不存在或无权查看");
  }
  if (isExpired(row.expires_at) && !owner && !admin) {
    throw fail(410, "expired", "该粘贴已过期");
  }
  if (row.password_hash && !owner && !admin && !passwordOk) {
    if (!verifyUnlockToken(row.id, unlockToken, config.sessionSecret)) {
      throw fail(401, "password_required", "该粘贴受密码保护");
    }
  }
}

/** Counts a view (and honours burn-after-read) for everyone but the owner and moderators. */
export async function readPaste(row: PasteRow, viewer: SessionUser | null, { burn = true } = {}) {
  const counts = !isOwnerOf(row, viewer) && !isAdmin(viewer);
  let burned = false;
  let views = Number(row.views);

  if (counts) {
    views += 1;
    await query("UPDATE pastes SET views = views + 1 WHERE id = $1", [row.id]);
    if (burn && row.burn_after_read) {
      await query("DELETE FROM pastes WHERE id = $1", [row.id]);
      burned = true;
    }
  }

  return serializePaste({ ...row, views }, viewer, { includeContent: true, burned });
}
