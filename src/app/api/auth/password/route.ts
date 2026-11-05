import { one, query } from "@/server/db";
import { fail, handler, json, rateLimited, readJson } from "@/server/http";
import { hashPassword, hashToken, verifyPassword } from "@/server/password";
import { passwordLimiter } from "@/server/rate-limit";
import { SESSION_COOKIE } from "@/server/config";
import { currentUser } from "@/server/session";
import { passwordValue, text } from "@/server/validate";
import type { NextRequest } from "next/server";

export const POST = handler(async (request: NextRequest) => {
  const user = await currentUser();
  const key = `password:${user.id}`;
  if (!passwordLimiter.check(key)) {
    throw rateLimited("操作过于频繁，请稍后再试", passwordLimiter.retryAfter(key));
  }

  const payload = await readJson(request);
  const currentPassword = text(payload.current_password, "current_password", { min: 1, max: 200, trim: false });
  const newPassword = passwordValue(payload.new_password, "new_password");

  if (currentPassword === newPassword) throw fail(400, "same_password", "新密码不能与当前密码相同");

  const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
    throw fail(400, "wrong_password", "当前密码不正确");
  }

  const nextHash = await hashPassword(newPassword);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [nextHash, user.id]);

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [user.id, hashToken(token)]);
  } else {
    await query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
  }

  passwordLimiter.reset(key);
  return json({ ok: true });
});
