import { randomUUID } from "node:crypto";
import { one, query } from "@/server/db";
import { fail, handler, json, readJson } from "@/server/http";
import { hashPassword } from "@/server/password";
import { serializeUser } from "@/server/serialize";
import { requireAdmin, type SessionUser } from "@/server/session";
import { email as emailField, oneOf, passwordValue, text } from "@/server/validate";

const USER_SELECT = `
  SELECT u.id, u.email, u.display_name, u.role, u.disabled,
         u.created_at, u.last_login_at,
         (SELECT COUNT(*)::int FROM pastes p WHERE p.owner_id = u.id) AS paste_count
  FROM users u
`;

export const GET = handler(async () => {
  await requireAdmin();
  const rows = await query<SessionUser & { paste_count: number }>(`${USER_SELECT} ORDER BY u.created_at ASC`);
  return json({ items: rows.map((row) => serializeUser(row, true)) });
});

export const POST = handler(async (request: Request) => {
  await requireAdmin();
  const payload = await readJson(request);
  const email = emailField(payload.email);
  const password = passwordValue(payload.password);
  const displayName = text(payload.display_name ?? "", "display_name", { max: 40 });
  const role = oneOf(payload.role, "role", ["admin", "member"] as const, "member");

  const exists = await one("SELECT 1 FROM users WHERE lower(email) = lower($1)", [email]);
  if (exists) throw fail(409, "email_taken", "该邮箱已被使用");

  const userId = randomUUID().replace(/-/g, "");
  const name = displayName || email.split("@")[0]!.slice(0, 40) || "成员";
  const passwordHash = await hashPassword(password);

  await query(
    `INSERT INTO users (id, email, password_hash, display_name, role, created_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [userId, email, passwordHash, name, role],
  );

  const row = await one<SessionUser & { paste_count: number }>(`${USER_SELECT} WHERE u.id = $1`, [userId]);
  return json({ user: serializeUser(row!, true) }, { status: 201 });
});
