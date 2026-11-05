import type { SessionUser } from "./session";

export type PasteRow = {
  id: string;
  title: string;
  language: string;
  kind: "code" | "error" | "log" | "text";
  visibility: "public" | "unlisted" | "private";
  password_hash: string | null;
  expires_at: Date | null;
  burn_after_read: boolean;
  views: number | string;
  /** NULL for pastes published without an account (anonymous). */
  owner_id: string | null;
  /** NULL when the owner account was deleted or the paste is anonymous. */
  owner_name: string | null;
  created_at: Date;
  updated_at: Date;
  size: number | string | null;
  preview_raw?: string | null;
  content?: string;
};

/** ISO-8601 with a `Z` suffix, matching what the API previously returned. */
export function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function isExpired(value: Date | string | null | undefined): boolean {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

export function serializeUser(user: SessionUser, adminView = false) {
  const data: Record<string, unknown> = {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    created_at: iso(user.created_at),
    last_login_at: iso(user.last_login_at),
  };
  if (adminView) {
    data.disabled = Boolean(user.disabled);
    const withCount = user as SessionUser & { paste_count?: number | string };
    if (withCount.paste_count !== undefined) data.paste_count = Number(withCount.paste_count);
  }
  return data;
}

export function serializePaste(
  row: PasteRow,
  viewer: SessionUser | null,
  options: { includeContent?: boolean; burned?: boolean } = {},
) {
  const viewerId = viewer?.id ?? null;
  const isOwner = viewerId !== null && row.owner_id !== null && viewerId === row.owner_id;
  const isAdmin = viewer?.role === "admin";
  const hasPassword = Boolean(row.password_hash);

  let preview: string | null = null;
  if (row.preview_raw != null && (!hasPassword || isOwner || isAdmin)) {
    preview = row.preview_raw.replace(/\s+/g, " ").trim().slice(0, 180) || null;
  }

  const data: Record<string, unknown> = {
    id: row.id,
    title: row.title,
    language: row.language,
    kind: row.kind,
    visibility: row.visibility,
    views: Number(row.views),
    burn_after_read: Boolean(row.burn_after_read),
    has_password: hasPassword,
    expires_at: iso(row.expires_at),
    expired: isExpired(row.expires_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    size: row.size == null ? null : Number(row.size),
    owner: { id: row.owner_id, display_name: row.owner_name ?? "匿名" },
    is_owner: isOwner,
    // Publishing is open to everyone; editing and deleting belong to admins.
    can_edit: isAdmin,
    can_delete: isAdmin,
    preview,
  };
  if (options.includeContent) {
    data.content = row.content ?? "";
    data.burned = options.burned ?? false;
  }
  return data;
}
