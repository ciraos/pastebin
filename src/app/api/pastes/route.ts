import type { NextRequest } from "next/server";
import { query, one } from "@/server/db";
import { config } from "@/server/config";
import { clientIp, fail, handler, json, rateLimited, readJson } from "@/server/http";
import { hashPassword } from "@/server/password";
import { escapeLike, fetchPaste, newPasteId, SUMMARY_SELECT } from "@/server/pastes";
import { publishLimiter } from "@/server/rate-limit";
import { serializePaste, type PasteRow } from "@/server/serialize";
import { currentUser, optionalUser, type SessionUser } from "@/server/session";
import {
  boolean,
  content as contentField,
  integer,
  language as languageField,
  oneOf,
  optionalInteger,
  passwordHashSource,
  text,
} from "@/server/validate";

const SCOPES = ["public", "mine", "all"] as const;
const VISIBILITIES = ["public", "unlisted", "private"] as const;
const SORTS = ["newest", "oldest", "views"] as const;

export const GET = handler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const scope = oneOf(params.get("scope"), "scope", SCOPES, "public");
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const language = (params.get("language") ?? "").trim().toLowerCase();
  const kind = (params.get("kind") ?? "").trim().toLowerCase();
  const visibilityRaw = params.get("visibility");
  const visibility = visibilityRaw ? oneOf(visibilityRaw, "visibility", VISIBILITIES) : null;
  const sort = oneOf(params.get("sort"), "sort", SORTS, "newest");
  const page = integer(params.get("page") ?? 1, "page", { min: 1, max: 10_000 });
  const limit = integer(params.get("limit") ?? 12, "limit", { min: 1, max: 50 });

  let viewer: SessionUser | null = null;
  if (scope !== "public") viewer = await currentUser();
  else viewer = await optionalUser();
  if (scope === "all" && viewer?.role !== "admin") throw fail(403, "forbidden", "需要管理员权限");

  const conditions: string[] = [];
  const values: unknown[] = [];
  const param = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (scope === "public") {
    conditions.push("p.visibility = 'public'");
    conditions.push("(p.expires_at IS NULL OR p.expires_at > now())");
  } else if (scope === "mine") {
    conditions.push(`p.owner_id = ${param(viewer!.id)}`);
  }

  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    if (scope === "public") {
      conditions.push(`p.title ILIKE ${param(pattern)} ESCAPE '\\'`);
    } else {
      const slot = param(pattern);
      conditions.push(`(p.title ILIKE ${slot} ESCAPE '\\' OR p.content ILIKE ${slot} ESCAPE '\\')`);
    }
  }
  if (language) conditions.push(`p.language = ${param(language)}`);
  if (kind) conditions.push(`p.kind = ${param(kind)}`);
  if (visibility) conditions.push(`p.visibility = ${param(visibility)}`);

  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = {
    newest: "p.created_at DESC",
    oldest: "p.created_at ASC",
    views: "p.views DESC, p.created_at DESC",
  }[sort];

  const totalRow = await one<{ total: number }>(`SELECT COUNT(*)::int AS total FROM pastes p${where}`, values);
  const offset = (page - 1) * limit;
  const rows = await query<PasteRow>(
    `${SUMMARY_SELECT}${where} ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );
  const total = totalRow?.total ?? 0;

  return json({
    items: rows.map((row) => serializePaste(row, viewer)),
    total,
    page,
    limit,
    has_more: page * limit < total,
  });
});

export const POST = handler(async (request: Request) => {
  // Publishing is open to anonymous visitors; a signed-in author is recorded.
  const viewer = await optionalUser();

  const payload = await readJson(request);

  const title = text(payload.title ?? "", "title", { max: 160 });
  const content = contentField(payload.content);
  const language = languageField(payload.language, "language", "text");
  const kind = oneOf(payload.kind, "kind", ["code", "error", "log", "text"] as const, "code");
  const visibility = oneOf(payload.visibility, "visibility", VISIBILITIES, "unlisted");
  const expiresIn = optionalInteger(payload.expires_in, "expires_in", { min: 60, max: 365 * 24 * 3600 });
  const burnAfterRead = boolean(payload.burn_after_read, "burn_after_read", false);
  const password = passwordHashSource(payload.password);

  if (!viewer && visibility === "private") {
    throw fail(400, "private_requires_login", "未登录时无法发布私密粘贴，请先登录");
  }

  // Throttle only requests that passed validation, so a rejected payload does
  // not burn the caller's quota. Counted per account when signed in, by client
  // IP otherwise.
  if (config.publishLimit > 0) {
    const key = viewer ? `user:${viewer.id}` : `ip:${clientIp(request)}`;
    if (!publishLimiter.check(key)) {
      const wait = publishLimiter.retryAfter(key);
      throw rateLimited(
        `发布太频繁：每 ${config.publishWindowSeconds} 秒最多 ${config.publishLimit} 条，请 ${wait} 秒后再试`,
        wait,
      );
    }
  }

  const passwordHash = password ? await hashPassword(password) : null;

  const pasteId = await newPasteId();
  await query(
    `INSERT INTO pastes (
        id, title, content, language, kind, visibility, password_hash,
        expires_at, burn_after_read, views, owner_id, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7,
        CASE WHEN $8::int IS NULL THEN NULL ELSE now() + make_interval(secs => $8::int) END,
        $9, 0, $10, now(), now())`,
    [pasteId, title, content, language, kind, visibility, passwordHash, expiresIn, burnAfterRead, viewer?.id ?? null],
  );

  const row = await fetchPaste(pasteId);
  return json({ paste: serializePaste(row!, viewer, { includeContent: true }) }, { status: 201 });
});
