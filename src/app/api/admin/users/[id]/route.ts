import { one, query } from "@/server/db";
import { fail, handler, json, readJson } from "@/server/http";
import { hashPassword } from "@/server/password";
import { serializeUser } from "@/server/serialize";
import { requireAdmin, type SessionUser } from "@/server/session";
import { oneOf, optionalBoolean, optionalText, passwordValue } from "@/server/validate";

const USER_SELECT = `
  SELECT u.id, u.email, u.display_name, u.role, u.disabled,
         u.created_at, u.last_login_at,
         (SELECT COUNT(*)::int FROM pastes p WHERE p.owner_id = u.id) AS paste_count
  FROM users u
`;

type Ctx = { params: Promise<{ id: string }> };

async function otherEnabledAdmins(excludeId: string): Promise<number> {
  const row = await one<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND disabled = FALSE AND id <> $1",
    [excludeId],
  );
  return row?.count ?? 0;
}

export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const admin = await requireAdmin();

  const payload = await readJson(request);
  const target = await one<SessionUser & { password_hash: string }>("SELECT * FROM users WHERE id = $1", [id]);
  if (!target) throw fail(404, "not_found", "用户不存在");

  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
  const displayName = has("display_name") ? optionalText(payload.display_name, "display_name", { min: 1, max: 40 }) : null;
  const role = has("role") && payload.role !== null ? oneOf(payload.role, "role", ["admin", "member"] as const) : null;
  const disabled = has("disabled") ? optionalBoolean(payload.disabled, "disabled") : null;
  const password = has("password") && payload.password !== null ? passwordValue(payload.password) : null;

  const isSelf = target.id === admin.id;
  if (isSelf && role !== null && role !== target.role) {
    throw fail(400, "cannot_change_own_role", "不能修改自己的角色");
  }
  if (isSelf && disabled) throw fail(400, "cannot_disable_self", "不能禁用自己的账号");

  const demoting =
    target.role === "admin" && !target.disabled && ((role !== null && role !== "admin") || disabled === true);
  if (demoting && (await otherEnabledAdmins(target.id)) === 0) {
    throw fail(400, "last_admin", "至少需要保留一位可用的管理员");
  }

  const assignments: string[] = [];
  const values: unknown[] = [];
  const set = (fragment: string, value: unknown) => {
    values.push(value);
    assignments.push(fragment.replace("?", `$${values.length}`));
  };

  if (displayName !== null) {
    if (!displayName) throw fail(400, "invalid_name", "昵称不能为空");
    set("display_name = ?", displayName);
  }
  if (role !== null) set("role = ?", role);
  if (disabled !== null) set("disabled = ?", disabled);
  if (password !== null) set("password_hash = ?", await hashPassword(password));

  if (assignments.length === 0) throw fail(400, "empty_update", "没有需要保存的修改");

  values.push(target.id);
  await query(`UPDATE users SET ${assignments.join(", ")} WHERE id = $${values.length}`, values);

  if (disabled === true || password !== null) {
    await query("DELETE FROM sessions WHERE user_id = $1", [target.id]);
  }

  const row = await one<SessionUser & { paste_count: number }>(`${USER_SELECT} WHERE u.id = $1`, [target.id]);
  return json({ user: serializeUser(row!, true) });
});

export const DELETE = handler(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const admin = await requireAdmin();
  if (id === admin.id) throw fail(400, "cannot_delete_self", "不能删除自己的账号");

  const target = await one<SessionUser>("SELECT * FROM users WHERE id = $1", [id]);
  if (!target) throw fail(404, "not_found", "用户不存在");
  if (target.role === "admin" && (await otherEnabledAdmins(target.id)) === 0) {
    throw fail(400, "last_admin", "至少需要保留一位可用的管理员");
  }

  await query("DELETE FROM users WHERE id = $1", [id]);
  return json({ ok: true });
});
