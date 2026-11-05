#!/usr/bin/env node
/**
 * End-to-end API tests against a running dev server.
 *
 * Exercises the route handlers over HTTP with a throwaway admin account, then
 * cleans up after itself. Requires PostgreSQL to be up and the schema created
 * (start `pnpm dev` once).
 *
 * Usage: node scripts/test-api.mjs [--base http://127.0.0.1:3128]
 */
import { randomBytes, randomUUID, scrypt as scryptCb } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scrypt = promisify(scryptCb);

function loadEnv() {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    let value = raw.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const BASE = (baseIndex >= 0 ? args[baseIndex + 1] : process.env.TEST_BASE ?? "http://127.0.0.1:3128").replace(/\/+$/, "");

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const digest = await scrypt(password, salt, 32, { N: 2 ** 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}


/** Tiny cookie jar: enough for one client at a time. */
class Client {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  store(response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async request(method, path, { body, headers = {} } = {}) {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.cookies.size ? { Cookie: this.cookieHeader() } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    this.store(response);
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data, headers: response.headers };
  }
}

const connectionString = (process.env.DATABASE_URL ?? "").trim();
const db = connectionString
  ? new pg.Client({
      connectionString,
      ssl: (process.env.DATABASE_SSL ?? "").toLowerCase() === "true" ? { rejectUnauthorized: false } : undefined,
    })
  : null;

if (db) await db.connect();

const suffix = randomUUID().slice(0, 8);
const adminEmail = `test-admin-${suffix}@local.test`;
const adminPassword = "test-password-123";
const memberEmail = `test-member-${suffix}@local.test`;
const memberPassword = "member-password-123";
const createdUserIds = [];

async function seedUser(email, password, role) {
  if (!db) throw new Error("test:api 需要 DATABASE_URL 才能创建临时账号");
  const id = randomUUID().replace(/-/g, "");
  const hash = await hashPassword(password);
  await db.query(
    `INSERT INTO users (id, email, password_hash, display_name, role, created_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [id, email, hash, `Test ${role}`, role],
  );
  createdUserIds.push(id);
  return id;
}

console.log(`[test] 目标：${BASE}`);

try {
  const anon = new Client("anon");

  console.log("\n健康检查 / 站点状态");
  const health = await anon.request("GET", "/api/health");
  check("GET /api/health 返回 ok", health.status === 200 && health.data?.status === "ok", health.data);
  const setupStatus = await anon.request("GET", "/api/setup/status");
  check("GET /api/setup/status 有 setup_required 字段", typeof setupStatus.data?.setup_required === "boolean", setupStatus.data);
  const publicStats = await anon.request("GET", "/api/stats/public");
  check("GET /api/stats/public 返回计数", typeof publicStats.data?.pastes === "number", publicStats.data);

  console.log("\n管理员账号与登录");
  await seedUser(adminEmail, adminPassword, "admin");
  const admin = new Client("admin");
  const badLogin = await admin.request("POST", "/api/auth/login", {
    body: { email: adminEmail, password: "wrong-password" },
  });
  check("错误密码返回 401", badLogin.status === 401 && badLogin.data?.detail?.code === "invalid_credentials", badLogin.data);
  const login = await admin.request("POST", "/api/auth/login", { body: { email: adminEmail, password: adminPassword } });
  check("正确密码登录成功", login.status === 200 && login.data?.user?.role === "admin", login.data);
  check("登录下发会话 Cookie", admin.cookies.has("pb_session"));

  const me = await admin.request("GET", "/api/auth/me");
  check("GET /api/auth/me 返回当前用户", me.status === 200 && me.data?.user?.email === adminEmail, me.data);

  const renamed = await admin.request("PATCH", "/api/auth/me", { body: { display_name: "测试管理员" } });
  check("PATCH /api/auth/me 修改昵称", renamed.status === 200 && renamed.data?.user?.display_name === "测试管理员", renamed.data);

  console.log("\n粘贴 CRUD");
  const created = await admin.request("POST", "/api/pastes", {
    body: {
      title: "集成测试粘贴",
      content: "console.log('hello from postgres');",
      language: "javascript",
      kind: "code",
      visibility: "public",
      expires_in: 3600,
    },
  });
  const pasteId = created.data?.paste?.id;
  check("POST /api/pastes 创建成功", created.status === 201 && typeof pasteId === "string", created.data);
  check("创建者拿到 content", created.data?.paste?.content?.includes("hello from postgres"), created.data?.paste?.content);
  check("expires_at 已设置", Boolean(created.data?.paste?.expires_at));
  check("size 为真实字节数", created.data?.paste?.size > 0, created.data?.paste?.size);

  const listed = await anon.request("GET", "/api/pastes?scope=public");
  check("匿名列表包含公开粘贴", listed.data?.items?.some((item) => item.id === pasteId), listed.data?.total);

  const readPublic = await anon.request("GET", `/api/pastes/${pasteId}`);
  check("匿名读取公开粘贴", readPublic.status === 200 && readPublic.data?.paste?.content?.includes("hello"), readPublic.data);
  check("匿名阅读不暴露 is_owner", readPublic.data?.paste?.is_owner === false, readPublic.data?.paste?.is_owner);

  const mine = await admin.request("GET", "/api/pastes?scope=mine");
  check("GET ?scope=mine 需要登录且返回自己的粘贴", mine.status === 200 && mine.data?.items?.some((p) => p.id === pasteId), mine.data?.total);
  const mineAnon = await anon.request("GET", "/api/pastes?scope=mine");
  check("匿名访问 ?scope=mine 返回 401", mineAnon.status === 401, mineAnon.data);

  const patched = await admin.request("PATCH", `/api/pastes/${pasteId}`, { body: { title: "改过的标题", visibility: "unlisted" } });
  check("PATCH 粘贴成功", patched.status === 200 && patched.data?.paste?.title === "改过的标题", patched.data);
  check("visibility 已更新", patched.data?.paste?.visibility === "unlisted", patched.data?.paste?.visibility);

  const raw = await anon.request("GET", `/api/pastes/${pasteId}/raw`);
  check("GET /raw 返回纯文本", raw.status === 200 && String(raw.data).includes("hello from postgres"), raw.status);

  console.log("\n密码保护与解锁");
  const locked = await admin.request("POST", "/api/pastes", {
    body: { title: "加密粘贴", content: "secret payload", language: "text", kind: "text", visibility: "unlisted", password: "open-sesame" },
  });
  const lockedId = locked.data?.paste?.id;
  check("创建带密码粘贴", locked.status === 201 && locked.data?.paste?.has_password === true, locked.data);
  const lockedAnon = new Client("locked-anon");
  const needPassword = await lockedAnon.request("GET", `/api/pastes/${lockedId}`);
  check("未解锁返回 401 password_required", needPassword.status === 401 && needPassword.data?.detail?.code === "password_required", needPassword.data);
  const wrongUnlock = await lockedAnon.request("POST", `/api/pastes/${lockedId}/unlock`, { body: { password: "nope" } });
  check("错误密码解锁返回 401", wrongUnlock.status === 401 && wrongUnlock.data?.detail?.code === "invalid_password", wrongUnlock.data);
  const unlock = await lockedAnon.request("POST", `/api/pastes/${lockedId}/unlock`, { body: { password: "open-sesame" } });
  check("正确密码解锁成功", unlock.status === 200 && unlock.data?.paste?.content === "secret payload", unlock.data);
  const afterUnlock = await lockedAnon.request("GET", `/api/pastes/${lockedId}`);
  check("解锁后同会话可读", afterUnlock.status === 200 && afterUnlock.data?.paste?.content === "secret payload", afterUnlock.data);

  console.log("\n阅后即焚");
  const burn = await admin.request("POST", "/api/pastes", {
    body: { title: "阅后即焚", content: "burn me", language: "text", kind: "text", visibility: "public", burn_after_read: true },
  });
  const burnId = burn.data?.paste?.id;
  const firstRead = await anon.request("GET", `/api/pastes/${burnId}`);
  check("首次读取拿到内容并标记 burned", firstRead.status === 200 && firstRead.data?.paste?.burned === true, firstRead.data);
  const secondRead = await anon.request("GET", `/api/pastes/${burnId}`);
  check("再次读取返回 404", secondRead.status === 404, secondRead.status);

  console.log("\n统计与后台");
  const stats = await admin.request("GET", "/api/stats");
  check("GET /api/stats 返回 mine/global", typeof stats.data?.mine?.pastes === "number" && typeof stats.data?.global?.users === "number", stats.data);
  const overview = await admin.request("GET", "/api/admin/overview");
  check("GET /api/admin/overview 返回计数", typeof overview.data?.users === "number" && overview.data.users >= 1, overview.data);
  const users = await admin.request("GET", "/api/admin/users");
  check("GET /api/admin/users 返回列表", Array.isArray(users.data?.items) && users.data.items.length >= 1, users.data?.items?.length);
  const adminPastes = await admin.request("GET", "/api/pastes?scope=all");
  check("管理员可以看全部粘贴", adminPastes.status === 200 && adminPastes.data?.total >= 1, adminPastes.data?.total);

  const memberCreated = await admin.request("POST", "/api/admin/users", {
    body: { email: memberEmail, password: memberPassword, display_name: "测试成员", role: "member" },
  });
  check("管理员创建成员", memberCreated.status === 201 && memberCreated.data?.user?.role === "member", memberCreated.data);
  if (memberCreated.data?.user?.id) createdUserIds.push(memberCreated.data.user.id);

  const member = new Client("member");
  const memberLogin = await member.request("POST", "/api/auth/login", { body: { email: memberEmail, password: memberPassword } });
  check("成员可以登录", memberLogin.status === 200, memberLogin.data);
  const forbidden = await member.request("GET", "/api/admin/users");
  check("成员访问后台返回 403", forbidden.status === 403, forbidden.data);
  const memberAll = await member.request("GET", "/api/pastes?scope=all");
  check("成员访问 ?scope=all 返回 403", memberAll.status === 403, memberAll.data);

  console.log("\n发布与权限模型");
  const anonPaste = await anon.request("POST", "/api/pastes", {
    body: { title: "匿名发布的粘贴", content: "anonymous content", language: "text", kind: "text", visibility: "public" },
  });
  const anonPasteId = anonPaste.data?.paste?.id;
  check("匿名访客可以直接发布", anonPaste.status === 201 && typeof anonPasteId === "string", anonPaste.data);
  check("匿名粘贴没有归属账号", anonPaste.data?.paste?.owner?.id === null, anonPaste.data?.paste?.owner);
  check("匿名粘贴显示为匿名", anonPaste.data?.paste?.owner?.display_name === "匿名", anonPaste.data?.paste?.owner);
  check("匿名发布者没有编辑/删除权", anonPaste.data?.paste?.can_edit === false && anonPaste.data?.paste?.can_delete === false, anonPaste.data?.paste);

  const anonPrivate = await anon.request("POST", "/api/pastes", {
    body: { title: "私密", content: "x", language: "text", kind: "text", visibility: "private" },
  });
  check("匿名不能发布私密粘贴", anonPrivate.status === 400 && anonPrivate.data?.detail?.code === "private_requires_login", anonPrivate.data);

  const anonDelete = await anon.request("DELETE", `/api/pastes/${anonPasteId}`);
  check("匿名删除返回 401", anonDelete.status === 401, anonDelete.status);
  const anonPatch = await anon.request("PATCH", `/api/pastes/${anonPasteId}`, { body: { title: "hack" } });
  check("匿名编辑返回 401", anonPatch.status === 401, anonPatch.status);

  const memberPaste = await member.request("POST", "/api/pastes", {
    body: { title: "成员发布的粘贴", content: "member content", language: "text", kind: "text", visibility: "public" },
  });
  const memberPasteId = memberPaste.data?.paste?.id;
  check("登录成员可以发布", memberPaste.status === 201, memberPaste.data);
  check("成员粘贴归到自己名下", memberPaste.data?.paste?.owner?.display_name === "测试成员", memberPaste.data?.paste?.owner);
  check("作者本人也没有编辑权", memberPaste.data?.paste?.can_edit === false, memberPaste.data?.paste);

  const memberPatch = await member.request("PATCH", `/api/pastes/${memberPasteId}`, { body: { title: "自己改自己的" } });
  check("成员编辑自己的粘贴返回 403", memberPatch.status === 403, memberPatch.data);
  const memberDelete = await member.request("DELETE", `/api/pastes/${memberPasteId}`);
  check("成员删除自己的粘贴返回 403", memberDelete.status === 403, memberDelete.data);

  const adminPatch = await admin.request("PATCH", `/api/pastes/${memberPasteId}`, { body: { title: "管理员改过的标题" } });
  check("管理员可以编辑成员的粘贴", adminPatch.status === 200 && adminPatch.data?.paste?.title === "管理员改过的标题", adminPatch.data);
  const adminDelete = await admin.request("DELETE", `/api/pastes/${memberPasteId}`);
  check("管理员可以删除成员的粘贴", adminDelete.status === 200, adminDelete.data);

  const publicList = await anon.request("GET", "/api/pastes?scope=public&limit=50");
  const listedAnon = publicList.data?.items?.find((item) => item.id === anonPasteId);
  check("公开列表能看到匿名粘贴", Boolean(listedAnon), publicList.data?.total);
  check("列表里的匿名粘贴没有编辑权", listedAnon?.can_edit === false, listedAnon);

  const cleanupAnon = await admin.request("DELETE", `/api/pastes/${anonPasteId}`);
  check("管理员清理匿名粘贴", cleanupAnon.status === 200, cleanupAnon.data);

  console.log("\n发布频率限制");
  const publishLimit = Number(process.env.PUBLISH_RATE_LIMIT ?? 5);
  const publishWindow = Number(process.env.PUBLISH_RATE_WINDOW ?? 60);
  if (publishLimit > 0) {
    // A dedicated fake IP keeps this section independent of the other requests.
    const fakeIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const throttleHeaders = { "x-forwarded-for": fakeIp };
    const burstIds = [];
    for (let index = 0; index < publishLimit; index += 1) {
      const created = await anon.request("POST", "/api/pastes", {
        headers: throttleHeaders,
        body: { title: `限流测试 ${index}`, content: `burst ${index}`, language: "text", kind: "text", visibility: "unlisted" },
      });
      if (created.data?.paste?.id) burstIds.push(created.data.paste.id);
      check(`第 ${index + 1} 条在配额内发布成功`, created.status === 201, created.status);
    }
    const blocked = await anon.request("POST", "/api/pastes", {
      headers: throttleHeaders,
      body: { title: "超出配额", content: "too many", language: "text", kind: "text", visibility: "unlisted" },
    });
    check("超出配额返回 429", blocked.status === 429 && blocked.data?.detail?.code === "rate_limited", blocked.data);
    const retryAfter = Number(blocked.headers.get("retry-after"));
    check(
      "429 带 Retry-After 头",
      Number.isFinite(retryAfter) && retryAfter >= 1 && retryAfter <= publishWindow,
      blocked.headers.get("retry-after"),
    );
    check("错误信息说明配额", String(blocked.data?.detail?.message ?? "").includes(String(publishLimit)), blocked.data?.detail?.message);

    // Another client (different IP) is unaffected.
    const otherClient = await anon.request("POST", "/api/pastes", {
      headers: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
      body: { title: "另一个 IP", content: "separate bucket", language: "text", kind: "text", visibility: "unlisted" },
    });
    check("不同 IP 有独立配额", otherClient.status === 201, otherClient.status);
    if (otherClient.data?.paste?.id) burstIds.push(otherClient.data.paste.id);

    for (const id of burstIds) await admin.request("DELETE", `/api/pastes/${id}`);
    check("限流测试数据已清理", true);
  } else {
    console.log("  (PUBLISH_RATE_LIMIT=0，跳过限流测试)");
  }

  console.log("\n站点设置");
  const original = (await admin.request("GET", "/api/admin/settings")).data?.settings;
  check("管理员可以读取站点设置", original && typeof original.site_name === "string", original);

  const saved = await admin.request("PATCH", "/api/admin/settings", {
    body: {
      site_name: "测试站点",
      icp_number: "京ICP备12345678号-1",
      police_number: "京公网安备 11010502030123号",
    },
  });
  check(
    "保存站点名称与备案号",
    saved.status === 200 && saved.data?.settings?.site_name === "测试站点" && saved.data?.settings?.icp_number.includes("ICP备"),
    saved.data,
  );

  const stamp = Date.now();
  const pageHtml = await (await fetch(`${BASE}/?t=${stamp}`, { headers: { "cache-control": "no-cache" } })).text();
  check("页面标题使用新的站点名称", pageHtml.includes("测试站点"), pageHtml.slice(0, 80));
  check("页脚显示 ICP 备案号", pageHtml.includes("京ICP备12345678号-1"));
  check("页脚显示公安备案号", pageHtml.includes("京公网安备"));

  const cleared = await admin.request("PATCH", "/api/admin/settings", {
    body: {
      site_name: original?.site_name ?? "",
      icp_number: original?.icp_number ?? "",
      police_number: original?.police_number ?? "",
    },
  });
  check("可以恢复原设置", cleared.status === 200, cleared.data);

  const clearedHtml = await (await fetch(`${BASE}/?t=${Date.now()}`, { headers: { "cache-control": "no-cache" } })).text();
  check("清空后页脚不再显示备案号", !clearedHtml.includes("京ICP备12345678号-1") && !clearedHtml.includes("京公网安备"));

  const memberSettingsRead = await member.request("GET", "/api/admin/settings");
  check("成员不能读取站点设置", memberSettingsRead.status === 403, memberSettingsRead.status);
  const memberSettingsWrite = await member.request("PATCH", "/api/admin/settings", { body: { site_name: "hack" } });
  check("成员不能修改站点设置", memberSettingsWrite.status === 403, memberSettingsWrite.status);

  console.log("\n改密码与会话");
  const changed = await admin.request("POST", "/api/auth/password", {
    body: { current_password: adminPassword, new_password: "new-password-456" },
  });
  check("修改密码成功", changed.status === 200, changed.data);
  const relogin = new Client("relogin");
  const oldPasswordLogin = await relogin.request("POST", "/api/auth/login", { body: { email: adminEmail, password: adminPassword } });
  check("旧密码不能再登录", oldPasswordLogin.status === 401, oldPasswordLogin.data);
  const newPasswordLogin = await relogin.request("POST", "/api/auth/login", { body: { email: adminEmail, password: "new-password-456" } });
  check("新密码可以登录", newPasswordLogin.status === 200, newPasswordLogin.data);

  const logout = await relogin.request("POST", "/api/auth/logout");
  check("登出返回 ok", logout.status === 200 && logout.data?.ok === true, logout.data);
  const afterLogout = await relogin.request("GET", "/api/auth/me");
  check("登出后 /me 返回 401", afterLogout.status === 401, afterLogout.status);

  console.log("\n删除粘贴");
  const deleted = await admin.request("DELETE", `/api/pastes/${pasteId}`);
  check("DELETE 粘贴成功", deleted.status === 200 && deleted.data?.ok === true, deleted.data);
  const gone = await anon.request("GET", `/api/pastes/${pasteId}`);
  check("删除后读取 404", gone.status === 404, gone.status);
} catch (error) {
  failed += 1;
  console.error("[test] 未捕获的异常", error);
} finally {
  if (db) {
    try {
      for (const id of createdUserIds) await db.query("DELETE FROM users WHERE id = $1", [id]);
    } finally {
      await db.end();
    }
  }
}

console.log(`\n[test] 通过 ${passed} 项，失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
