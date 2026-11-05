import type { NextRequest } from "next/server";
import { query } from "@/server/db";
import { fail, handler, json, readJson } from "@/server/http";
import { hashPassword } from "@/server/password";
import { checkAccess, fetchPaste, unlockCookieName, readPaste } from "@/server/pastes";
import { serializePaste } from "@/server/serialize";
import { optionalUser, requireAdmin } from "@/server/session";
import {
  boolean,
  content as contentField,
  language as languageField,
  oneOf,
  optionalInteger,
  passwordHashSource,
  text,
} from "@/server/validate";

const VISIBILITIES = ["public", "unlisted", "private"] as const;

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const viewer = await optionalUser();
  const row = await fetchPaste(id);
  if (!row) throw fail(404, "not_found", "粘贴不存在");
  checkAccess(row, viewer, request.cookies.get(unlockCookieName(id))?.value);
  const paste = await readPaste(row, viewer);
  return json({ paste });
});

export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  // Editing is a moderator action: the author (even a signed-in one) cannot change it.
  const viewer = await requireAdmin();
  const payload = await readJson(request);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);

  const row = await fetchPaste(id);
  if (!row) throw fail(404, "not_found", "粘贴不存在");

  const assignments: string[] = [];
  const values: unknown[] = [];
  const set = (fragment: string, value: unknown) => {
    values.push(value);
    assignments.push(fragment.replace("?", `$${values.length}`));
  };

  if (has("title") && payload.title !== null) {
    set("title = ?", text(payload.title, "title", { max: 160 }));
  }
  if (has("content") && payload.content !== null) {
    set("content = ?", contentField(payload.content));
  }
  if (has("language") && payload.language !== null) {
    set("language = ?", languageField(payload.language));
  }
  if (has("kind") && payload.kind !== null) {
    set("kind = ?", oneOf(payload.kind, "kind", ["code", "error", "log", "text"] as const));
  }
  if (has("visibility") && payload.visibility !== null) {
    set("visibility = ?", oneOf(payload.visibility, "visibility", VISIBILITIES));
  }
  if (has("burn_after_read") && payload.burn_after_read !== null) {
    set("burn_after_read = ?", boolean(payload.burn_after_read, "burn_after_read"));
  }
  if (has("expires_in")) {
    const expiresIn = optionalInteger(payload.expires_in, "expires_in", { min: 60, max: 365 * 24 * 3600 });
    if (expiresIn === null) {
      assignments.push("expires_at = NULL");
    } else {
      values.push(expiresIn);
      assignments.push(`expires_at = now() + make_interval(secs => $${values.length}::int)`);
    }
  }
  if (has("password")) {
    const password = passwordHashSource(payload.password);
    set("password_hash = ?", password ? await hashPassword(password) : null);
  }

  if (assignments.length === 0) throw fail(400, "empty_update", "没有需要保存的修改");

  values.push(id);
  await query(`UPDATE pastes SET ${assignments.join(", ")}, updated_at = now() WHERE id = $${values.length}`, values);

  const updated = await fetchPaste(id);
  return json({ paste: serializePaste(updated!, viewer, { includeContent: true }) });
});

export const DELETE = handler(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  // Deleting is a moderator action as well.
  await requireAdmin();
  const row = await fetchPaste(id, { detail: false });
  if (!row) throw fail(404, "not_found", "粘贴不存在");
  await query("DELETE FROM pastes WHERE id = $1", [id]);
  return json({ ok: true });
});
