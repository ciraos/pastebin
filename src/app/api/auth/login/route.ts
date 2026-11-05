import type { NextRequest } from "next/server";
import { one, query } from "@/server/db";
import { clientIp, fail, handler, json, rateLimited, readJson } from "@/server/http";
import { verifyPassword } from "@/server/password";
import { loginIpLimiter, loginLimiter } from "@/server/rate-limit";
import { serializeUser } from "@/server/serialize";
import { findUserByEmail, issueSession, sessionTtl, setSessionCookie, type SessionUser } from "@/server/session";
import { boolean, email as emailField, text } from "@/server/validate";

export const POST = handler(async (request: NextRequest) => {
  const payload = await readJson(request);
  const email = emailField(payload.email).toLowerCase();
  const password = text(payload.password, "password", { min: 1, max: 200, trim: false });
  const remember = boolean(payload.remember, "remember", true);

  const ip = clientIp(request);

  if (!loginIpLimiter.check(ip)) {
    throw rateLimited("登录尝试过于频繁，请稍后再试", loginIpLimiter.retryAfter(ip));
  }
  const loginKey = `login:${ip}:${email}`;
  if (!loginLimiter.check(loginKey)) {
    throw rateLimited("该账号尝试次数过多，请 5 分钟后再试", loginLimiter.retryAfter(loginKey));
  }

  const total = await one<{ count: number }>("SELECT COUNT(*)::int AS count FROM users");
  if ((total?.count ?? 0) === 0) {
    throw fail(409, "setup_required", "站点尚未初始化，请先创建管理员账号");
  }

  const row = await findUserByEmail(email);
  if (!row) {
    await verifyPassword(password, null);
    throw fail(401, "invalid_credentials", "邮箱或密码不正确");
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    throw fail(401, "invalid_credentials", "邮箱或密码不正确");
  }
  if (row.disabled) throw fail(403, "account_disabled", "该账号已被禁用，请联系管理员");

  const token = await issueSession(row.id, request, remember);
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [row.id]);
  const fresh = await one<SessionUser>(
    `SELECT id, email, display_name, role, disabled, created_at, last_login_at FROM users WHERE id = $1`,
    [row.id],
  );

  loginLimiter.reset(loginKey);
  const response = json({ user: serializeUser(fresh!) });
  setSessionCookie(response, token, sessionTtl(remember), remember);
  return response;
});
