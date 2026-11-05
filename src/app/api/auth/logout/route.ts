import type { NextRequest } from "next/server";
import { query } from "@/server/db";
import { handler, json } from "@/server/http";
import { hashToken } from "@/server/password";
import { SESSION_COOKIE } from "@/server/config";
import { clearSessionCookie } from "@/server/session";

export const POST = handler(async (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }
  const response = json({ ok: true });
  clearSessionCookie(response);
  return response;
});
