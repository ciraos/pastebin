<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 技术栈

- 单一 Next.js（App Router）全栈应用：页面 + `src/app/api/**/route.ts` 提供 HTTP 接口，**没有独立的 Python/FastAPI 后端**。
- 数据库 PostgreSQL，连接串来自 `.env` 的 `DATABASE_URL`；服务端代码在 `src/server/`（`db.ts` 连接池与建表、`session.ts` 会话、`password.ts` scrypt、`validate.ts` 校验）。
- 表结构由 `src/server/db.ts` 的 `ensureSchema()` 在首个请求时幂等创建，无需手动迁移。
- 本地开发用便携 PostgreSQL：`pnpm dev` 会先跑 `scripts/pg.mjs ensure`（集群在 `data/pg`，二进制在 `.pg/pgsql`），再启动 `next dev -p 3128`。连外部数据库时设 `SKIP_DB=1`。

## 权限模型（不要回退）

- **发布**：任何人（含未登录访客）都能发；`pastes.owner_id` 允许为 NULL，序列化为 `owner.display_name = "匿名"`。
- **发布限流**：`PUBLISH_RATE_LIMIT`（默认 5）/ `PUBLISH_RATE_WINDOW`（默认 60s），按账号或 IP 计数，超限 429 + `Retry-After`，`0` 表示关闭（`src/server/rate-limit.ts` 的 `publishLimiter`）。
- **编辑 / 删除**：只有管理员（`can_edit` / `can_delete` 仅对 admin 为 true）。作者本人没有编辑删除权，`PATCH`/`DELETE /api/pastes/[id]` 用 `requireAdmin()`。
- **查看**：私密与带密码的粘贴，管理员可绕过限制（审核需要）；匿名发布不允许选 `private`。
- 前端：`/new` 不在受保护路由里（`src/lib/routes.ts`、`src/proxy.ts`），编辑页用 `can_edit` 判断而不是 `is_owner`。
- **主题**：`src/lib/theme.ts` 定义三种模式（`auto` / `light` / `dark`），`auto` = 07:00–19:00 浅色（`DAY_START_HOUR` / `DAY_END_HOUR`）。防闪屏的内联脚本由 `themeBootstrapScript()` 生成，必须放在 `<body>` 开头（放在 `<head>` 里 React 19 不会输出）。`ThemeToggle` 记住 `pb-theme`，并每分钟按时间重算 auto。
- **移动端**：窄屏（<768px）后台成员列表走卡片（`md:hidden` 的 `<ul>`），表格只在 `md:block` 出现；新增区块时同时检查 390/360 宽度无横向溢出。
- **站点设置**：`settings` 表（key/value）存 `site_name` / `icp_number` / `police_number`；管理员在 `/admin` 改，接口是 `GET|PATCH /api/admin/settings`。渲染走 `getSiteSettings()`（`use cache` + `cacheTag("site-settings")` + `cacheLife("minutes")`），保存后必须 `revalidateTag("site-settings", { expire: 0 })`，否则页眉页脚 60 秒内仍旧值。站点名称留空回退 `APP_NAME`，备案号留空则不渲染。

## Dev 启停约定

用户说「启动 dev」时，直接按以下步骤执行，**不需要再询问确认**：

1. 先检查 3128 是否已在监听、`http://localhost:3128/api/health` 是否返回 ok；已在跑就跳过启动，只打开页面。
2. 未启动（或要重启）时，**先清空 `.next` 缓存**（`Remove-Item .next -Recurse -Force`），再运行 `pnpm dev`（自动确保 PostgreSQL 在 5432 运行 + `next dev -p 3128`），以后台任务方式运行并保留 job id。
3. 等 `http://localhost:3128/api/health` 返回 `{"status":"ok"}` 后，用浏览器打开 `http://localhost:3128`。
4. 汇报时给出页面地址、健康检查结果、数据库状态和后台任务 id。

用户说「停 dev」时，按以下顺序执行，**同样不需要再询问确认**：

1. 用 `job_kill` 停掉 dev 后台任务，并确认 3128 端口已不再监听（还有残留的 `next dev` / `dev.mjs` 进程时按 PID 结束）。
2. 停掉本次会话启动的所有子代理与后台任务（`list_agents` / `job_list` 确认为空）。
3. **停完之后**再清空 `.next` 缓存（`Remove-Item .next -Recurse -Force`），保证下一次启动或 `pnpm build` 从干净状态开始。
4. 紧接着要跑 `pnpm build` 时，清缓存放在 build **之前**，build 产物保留在 `.next` 里，不要构建完再删。
5. PostgreSQL 是独立进程，不会随 dev 退出，需要时用 `pnpm db:stop`。

## 改动后的验收顺序

改完代码、准备提交时，按这个顺序走：

1. 起 dev，按「PC 端 + 移动端（390 / 360）+ 浅色 / 深色」检查改到的页面，确认没有横向溢出、主题切换正常。
2. `pnpm lint`（必要时连同 `pnpm typecheck`、`pnpm test:api`）。
3. 停 dev（含清 `.next`），再 `pnpm build`，构建必须通过。
4. `git commit`：说明写清「改了什么、为什么、怎么验证的」，不要只写“修复”。
5. 配置了远端就 `git push`；没有远端就说明「已在本地提交，仓库尚未配置 remote」。

约定：这是一个可公开分享代码与报错的仓库，`.env` 是本机配置，不要提交真实密钥；`data/` 与 `.pg/` 已在 `.gitignore` 中。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 确保 PostgreSQL 起来 + 启动 Next dev（3128） |
| `pnpm db:start` / `pnpm db:stop` / `pnpm db:status` | 本地 PostgreSQL 启停与状态 |
| `pnpm test:api` | 端到端 API 测试（会创建临时账号并自行清理） |
| `pnpm typecheck` / `pnpm lint` | 类型检查 / ESLint |
| `pnpm db:import-sqlite` | 把旧的 `data/pastebin.db` 数据导入 PostgreSQL（一次性） |


