import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { config, SESSION_COOKIE } from "./config";
import { one, query } from "./db";
import { clientIp, fail } from "./http";
import { hashToken, newSessionToken } from "./password";

export type Role = "admin" | "member";

export type SessionUser = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  disabled: boolean;
  created_at: Date;
  last_login_at: Date | null;
};

const DAY_SECONDS = 24 * 60 * 60;

const SESSION_USER_SQL = `
  SELECT u.id, u.email, u.display_name, u.role, u.disabled, u.created_at, u.last_login_at,
         s.expires_at AS session_expires_at
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = $1
`;

export function sessionTtl(remember: boolean): number {
  return remember ? config.sessionTtlDays * DAY_SECONDS : DAY_SECONDS;
}

export async function issueSession(userId: string, request: Request, remember: boolean): Promise<string> {
  const token = newSessionToken();
  const ttl = sessionTtl(remember);
  await query(
    `INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent, ip)
     VALUES ($1, $2, now(), now() + make_interval(secs => $3), $4, $5)`,
    [
      hashToken(token),
      userId,
      ttl,
      (request.headers.get("user-agent") ?? "").slice(0, 300),
      clientIp(request),
    ],
  );
  // Opportunistic cleanup; cheap thanks to the expires index.
  await query("DELETE FROM sessions WHERE expires_at <= now()");
  return token;
}

export function setSessionCookie(response: NextResponse, token: string, ttl: number, remember: boolean): void {
  response.cookies.set(SESSION_COOKIE, token, {
    path: "/",
    maxAge: remember ? ttl : undefined,
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
  });
}

async function userFromToken(token: string): Promise<SessionUser | null> {
  const row = await one<SessionUser & { session_expires_at: Date }>(SESSION_USER_SQL, [hashToken(token)]);
  if (!row) return null;
  if (row.session_expires_at.getTime() <= Date.now()) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
    return null;
  }
  if (row.disabled) {
    await query("DELETE FROM sessions WHERE user_id = $1", [row.id]);
    return null;
  }
  const user: SessionUser = {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    disabled: row.disabled,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
  };
  return user;
}

export async function sessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function optionalUser(): Promise<SessionUser | null> {
  const token = await sessionToken();
  return token ? userFromToken(token) : null;
}

export async function currentUser(): Promise<SessionUser> {
  const token = await sessionToken();
  if (!token) throw fail(401, "unauthorized", "请先登录");
  const user = await userFromToken(token);
  if (!user) throw fail(401, "unauthorized", "登录状态已失效，请重新登录");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (user.role !== "admin") throw fail(403, "forbidden", "需要管理员权限");
  return user;
}

export async function findUserByEmail(email: string) {
  return one<SessionUser & { password_hash: string }>(
    `SELECT id, email, display_name, role, disabled, created_at, last_login_at, password_hash
     FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
}
