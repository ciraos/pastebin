# Pastebin

把代码和报错，变成一条干净的链接。面向开发团队的代码粘贴板：自动语法高亮、密码保护、有效期、阅后即焚，数据保存在自己的 PostgreSQL 里。

## 技术栈

| 层 | 选择 |
| --- | --- |
| 框架 | Next.js 16（App Router）+ React 19，**全栈单体**，没有独立后端进程 |
| 接口 | `src/app/api/**/route.ts`（Route Handlers，Node 运行时） |
| 数据库 | PostgreSQL（`pg` 连接池），连接串来自 `.env` 的 `DATABASE_URL` |
| 样式 | Tailwind CSS v4 |
| 安全 | scrypt 加盐哈希（`scrypt$N$r$p$salt$hash`）、HttpOnly 会话 Cookie、HMAC 解锁令牌、内存限流 |

## 主题与适配

- **深浅色自动切换**：右上角主题按钮提供「跟随时间 / 浅色 / 深色」三档，默认跟随时间——**07:00–19:00 用浅色，其余时间用深色**（按设备本地时间）。页面打开期间每分钟检查一次，跨过时间点会自己切换；选择记录在 `localStorage`，首次绘制前由内联脚本应用，不会闪一下再变色。
- **移动端**：390px / 360px 宽度下全站无横向滚动；后台成员列表在窄屏改成卡片、宽屏仍是表格；编辑器、发布设置、粘贴详情都按单列重排。

服务端逻辑集中在 `src/server/`：

- `db.ts` — 连接池、幂等建表（首个请求自动执行）、事务封装
- `session.ts` — 会话签发 / 校验、当前用户、管理员校验
- `password.ts` — scrypt 密码哈希、会话令牌、解锁令牌
- `validate.ts` — 请求参数校验（统一返回 `{detail:{code,message}}`）
- `rate-limit.ts` — 登录 / 初始化 / 解锁 / 改密的滑动窗口限流

## 快速开始

需要 Node.js ≥ 20 与一个可用的 PostgreSQL 数据库。

```bash
pnpm install
cp .env.example .env        # 填入 DATABASE_URL 和 SESSION_SECRET
pnpm dev                    # http://localhost:3128
```

首次打开会进入 `/setup`，用邮箱 + 密码创建管理员账号，之后由管理员在后台为成员开号。

## 权限模型

- **发布**：对所有人开放，无需登录。登录用户发布的粘贴会记录作者，匿名发布的粘贴显示为「匿名」。
- **查看**：公开 / 仅链接的粘贴任何人都能打开；私密粘贴只有作者本人和管理员可见（匿名发布不能选私密）。
- **编辑 / 删除**：只有**管理员**可以操作，作者本人也不可以；管理员可以查看和修改任意粘贴（含私密与带密码的）。
- **发布频率**：默认每个账号（未登录按 IP）在 60 秒内最多发 5 条，超限返回 `429` 并带 `Retry-After`；改 `.env` 的 `PUBLISH_RATE_LIMIT` / `PUBLISH_RATE_WINDOW` 即可，设 `0` 关闭。只对通过校验的请求计数，写错的请求不占配额；计数在进程内存里，单实例有效。IP 依次取自 `X-Forwarded-For` / `X-Real-IP` / `CF-Connecting-IP`——如果前面没有反向代理注入这些头，所有访客会共用同一个计数桶。
- **账号管理**：管理员在 `/admin` 创建成员、调整角色、禁用或删除账号。

## 站点设置（后台）

管理员在 `/admin` 的「站点设置」里可以改这三项，保存在 PostgreSQL 的 `settings` 表：

| 项 | 说明 |
| --- | --- |
| 站点名称 | 显示在浏览器标题、页眉、页脚；留空则回退 `.env` 的 `APP_NAME` |
| ICP 备案号 | 例如 `粤ICP备2024012345号-1`；填了才在页脚展示，链接到工信部备案系统 |
| 公安备案号 | 例如 `粤公网安备 44030002001234号`；填了才在页脚展示，链接到公安部备案系统 |

保存后通过 `revalidateTag("site-settings")` 立即生效（站点设置是 60 秒的 `use cache` 缓存，只在保存时失效）。

### 没有现成的 PostgreSQL？

仓库自带便携 PostgreSQL 兜底：把 `.env` 的 `DATABASE_URL` 指向 `127.0.0.1`，把 Windows 便携版（`postgresql-*-windows-x64-binaries.zip`）解压到 `.pg/pgsql/`，然后：

```bash
pnpm db:start     # 初始化集群（data/pg）+ 创建角色与数据库
pnpm dev          # 或直接 pnpm dev，它会先跑 db:ensure
pnpm db:stop      # 停止本地实例
```

`DATABASE_URL` 指向外部数据库时，`pnpm dev` 会自动跳过本地 PostgreSQL。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串，如 `postgres://user:pass@host:5432/pastebin` |
| `DATABASE_SSL` | 托管数据库要求 TLS 时设为 `true`。指向非本机地址却保留 `false` 时，服务端启动会打印明文连接告警 |
| `SESSION_SECRET` | 会话与解锁令牌的签名密钥，**务必改成随机长字符串** |
| `SESSION_TTL_DAYS` | 勾选「保持登录」时的会话有效期（天），默认 30 |
| `COOKIE_SECURE` | HTTPS 部署时设为 `true` |
| `MAX_PASTE_BYTES` | 单条粘贴大小上限，默认 1 MiB |
| `PUBLISH_RATE_LIMIT` | 每个窗口内最多发布几条，默认 5；设 `0` 关闭发布限流 |
| `PUBLISH_RATE_WINDOW` | 发布限流的窗口长度（秒），默认 60 |
| `APP_NAME` / `NEXT_PUBLIC_APP_NAME` | 站点名称 |
| `PG_*` | 仅本地便携 PostgreSQL 脚本使用 |

## 脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 确保数据库可用 + 启动 Next dev（3128） |
| `pnpm dev:web` | 只启动 Next dev（不管数据库） |
| `pnpm db:start` / `db:stop` / `db:status` / `db:ensure` | 本地 PostgreSQL 管理 |
| `pnpm db:import-sqlite` | 把旧的 `data/pastebin.db`（SQLite 版本）数据导入 PostgreSQL |
| `pnpm test:api` | 端到端接口测试（自动建临时账号，跑完清理） |
| `pnpm typecheck` / `pnpm lint` | 类型检查 / ESLint |
| `pnpm build` / `pnpm start` | 生产构建 / 启动 |
| `pnpm start:standalone` | 启动 `.next/standalone` 产物（`PORT` 默认 3010，跨平台） |

## 接口

所有接口都在 `/api` 下，未登录也能读取公开与仅链接的粘贴：

- `GET /api/health`、`GET /api/setup/status`、`POST /api/setup`
- `POST /api/auth/login`、`POST /api/auth/logout`、`GET|PATCH /api/auth/me`、`POST /api/auth/password`
- `GET|POST /api/pastes`、`GET|PATCH|DELETE /api/pastes/{id}`、`POST /api/pastes/{id}/unlock`、`GET /api/pastes/{id}/raw`
- `GET /api/stats`、`GET /api/stats/public`
- `GET|POST /api/admin/users`、`PATCH|DELETE /api/admin/users/{id}`、`GET /api/admin/overview`

错误统一为 `{ "detail": { "code": "…", "message": "…" } }`；被限流时额外带 `Retry-After` 头（秒）。

## 部署

```bash
pnpm build
pnpm copy            # 把 public/ 与 .next/static 复制进 standalone
pnpm start:standalone   # 跨平台启动，端口来自 PORT（默认 3010）
```

Windows / PowerShell 下不用再手写 `PORT=3010 node ...`，`pnpm start:standalone` 已经处理了端口与环境变量。

表结构在首个请求时自动创建，不需要单独跑迁移。生产环境记得设置 `SESSION_SECRET`、`COOKIE_SECURE=true`，并让 `DATABASE_URL` 指向你的 PostgreSQL。
