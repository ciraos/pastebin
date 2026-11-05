import type { NextRequest } from "next/server";
import { config, UNLOCK_COOKIE_TTL } from "@/server/config";
import { clientIp, fail, handler, json, rateLimited, readJson } from "@/server/http";
import { createUnlockToken, verifyPassword } from "@/server/password";
import { checkAccess, fetchPaste, isAdmin, isOwnerOf, readPaste, unlockCookieName } from "@/server/pastes";
import { unlockLimiter } from "@/server/rate-limit";
import { optionalUser } from "@/server/session";
import { text } from "@/server/validate";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const payload = await readJson(request);
  const password = text(payload.password, "password", { min: 1, max: 128, trim: false });

  const key = `unlock:${clientIp(request)}:${id}`;
  if (!unlockLimiter.check(key)) {
    throw rateLimited("尝试过于频繁，请稍后再试", unlockLimiter.retryAfter(key));
  }

  const viewer = await optionalUser();
  const row = await fetchPaste(id);
  if (!row) throw fail(404, "not_found", "粘贴不存在");
  checkAccess(row, viewer, request.cookies.get(unlockCookieName(id))?.value, { passwordOk: true });

  if (!row.password_hash || isOwnerOf(row, viewer) || isAdmin(viewer)) {
    return json({ paste: await readPaste(row, viewer) });
  }

  if (!(await verifyPassword(password, row.password_hash))) {
    throw fail(401, "invalid_password", "密码不正确");
  }

  unlockLimiter.reset(key);
  const token = createUnlockToken(id, config.sessionSecret, UNLOCK_COOKIE_TTL);
  const response = json({ paste: await readPaste(row, viewer) });
  response.cookies.set(unlockCookieName(id), token, {
    path: `/api/pastes/${id}`,
    maxAge: UNLOCK_COOKIE_TTL,
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
  });
  return response;
});
