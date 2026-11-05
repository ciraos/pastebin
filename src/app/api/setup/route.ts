import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { withTransaction } from "@/server/db";
import { clientIp, fail, handler, json, rateLimited, readJson } from "@/server/http";
import { hashPassword } from "@/server/password";
import { setupLimiter } from "@/server/rate-limit";
import { serializeUser } from "@/server/serialize";
import { issueSession, sessionTtl, setSessionCookie } from "@/server/session";
import { email as emailField, passwordValue, text } from "@/server/validate";
import type { SessionUser } from "@/server/session";

export const POST = handler(async (request: NextRequest) => {
  const payload = await readJson(request);
  const email = emailField(payload.email);
  const password = passwordValue(payload.password);
  const displayName = text(payload.display_name ?? "", "display_name", { max: 40 });

  const ip = clientIp(request);
  if (!setupLimiter.check(ip)) {
    throw rateLimited("尝试过于频繁，请稍后再试", setupLimiter.retryAfter(ip));
  }

  const userId = randomUUID().replace(/-/g, "");
  const passwordHash = await hashPassword(password);
  const name = displayName || email.split("@")[0]!.slice(0, 40) || "管理员";

  const created = await withTransaction(async (client) => {
    // Serialise concurrent setup attempts: only the first one may create the admin.
    await client.query("SELECT pg_advisory_xact_lock(726413)");
    const { rows } = await client.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM users");
    if ((rows[0]?.count ?? 0) > 0) {
      throw fail(409, "already_initialized", "站点已经完成初始化，请直接登录");
    }
    const inserted = await client.query<SessionUser>(
      `INSERT INTO users (id, email, password_hash, display_name, role, created_at)
       VALUES ($1, $2, $3, $4, 'admin', now())
       RETURNING id, email, display_name, role, disabled, created_at, last_login_at`,
      [userId, email, passwordHash, name],
    );
    return inserted.rows[0]!;
  });

  const token = await issueSession(created.id, request, true);
  const response = json({ user: serializeUser(created) }, { status: 201 });
  setSessionCookie(response, token, sessionTtl(true), true);
  return response;
});
