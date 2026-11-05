"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  Copy,
  Eye,
  FileCode2,
  Flame,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { RequireAuth } from "@/components/require-auth";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { Pagination } from "@/components/pagination";
import { StatCard } from "@/components/stat-card";
import { TimeAgo } from "@/components/time-ago";
import { Badge, Button, EmptyState, Input, LinkButton, Select } from "@/components/ui";
import type { DashboardStats, PasteListResponse, PasteSummary } from "@/lib/types";
import { expiryLabel, KIND_META, languageLabel, LANGUAGES, VISIBILITY_META } from "@/lib/utils";

const PAGE_SIZE = 10;

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PasteSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("");
  const [language, setLanguage] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [target, setTarget] = useState<PasteSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          scope: "mine",
          page: String(page),
          limit: String(PAGE_SIZE),
          sort,
        });
        if (query.trim()) params.set("q", query.trim());
        if (visibility) params.set("visibility", visibility);
        if (language) params.set("language", language);
        api<PasteListResponse>(`/pastes?${params.toString()}`, { signal: controller.signal })
          .then((data) => {
            if (!active) return;
            setItems(data.items);
            setTotal(data.total);
            setHasMore(data.has_more);
          })
          .catch((loadError: unknown) => {
            if (!active) return;
            if (loadError instanceof DOMException && loadError.name === "AbortError") return;
            setError(errorMessage(loadError));
          })
          .finally(() => {
            if (!active) return;
            setLoading(false);
            setRefreshing(false);
          });
      },
      query.trim() ? 260 : 0,
    );
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, query, visibility, language, sort, reloadKey]);

  useEffect(() => {
    api<DashboardStats>("/stats")
      .then(setStats)
      .catch(() => undefined);
  }, [reloadKey]);

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      await api(`/pastes/${target.id}`, { method: "DELETE" });
      toast("粘贴已删除");
      setTarget(null);
      if (items.length === 1 && page > 1) setPage((current) => current - 1);
      setReloadKey((key) => key + 1);
    } catch (deleteError) {
      toast(errorMessage(deleteError), "error");
    } finally {
      setDeleting(false);
    }
  }

  function refresh() {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">我的粘贴</h1>
          <p className="mt-1 text-sm text-muted">
            共 {total} 条 · 管理分享链接、可见性和有效期。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "admin" ? (
            <Link href="/admin">
              <Button variant="secondary" size="sm">
                <Shield className="size-3.5" />
                用户管理
              </Button>
            </Link>
          ) : null}
          <LinkButton href="/new" size="sm">
            <Plus className="size-3.5" />
            新建粘贴
          </LinkButton>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="全部粘贴"
          value={stats?.mine.pastes ?? "—"}
          hint={stats ? `其中 ${stats.mine.public} 条公开` : undefined}
          icon={<FileCode2 className="size-4" />}
        />
        <StatCard
          label="累计查看"
          value={stats?.mine.views ?? "—"}
          hint="不含自己的浏览"
          icon={<Eye className="size-4" />}
        />
        <StatCard
          label="带有效期"
          value={stats?.mine.expiring ?? "—"}
          hint={stats ? `${stats.mine.expired} 条已过期` : undefined}
          icon={<CalendarClock className="size-4" />}
          tone="warn"
        />
        <StatCard
          label="受保护"
          value={stats?.mine.protected ?? "—"}
          hint="设置了访问密码"
          icon={<Lock className="size-4" />}
          tone="accent"
        />
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="搜索标题或内容…"
              leading={<Search className="size-3.5" />}
              aria-label="搜索我的粘贴"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select
              value={visibility}
              onChange={(event) => {
                setVisibility(event.target.value);
                setPage(1);
              }}
              aria-label="可见性"
              className="sm:w-28"
            >
              <option value="">可见性</option>
              <option value="public">公开</option>
              <option value="unlisted">仅链接</option>
              <option value="private">私密</option>
            </Select>
            <Select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value);
                setPage(1);
              }}
              aria-label="语言"
              className="sm:w-32"
            >
              <option value="">语言</option>
              {LANGUAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              aria-label="排序"
              className="sm:w-28"
            >
              <option value="newest">最新</option>
              <option value="oldest">最早</option>
              <option value="views">最多查看</option>
            </Select>
            <Button variant="secondary" size="icon" onClick={refresh} aria-label="刷新列表" title="刷新">
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-3 border-b border-danger/20 bg-danger/5 px-4 py-3 text-xs text-danger">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={refresh}>
              重试
            </Button>
          </div>
        ) : null}

        {loading && items.length === 0 ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                <span className="size-9 animate-pulse rounded-lg bg-surface-2" />
                <div className="flex-1 space-y-2">
                  <span className="block h-3.5 w-1/2 animate-pulse rounded bg-surface-2" />
                  <span className="block h-3 w-2/3 animate-pulse rounded bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && items.length === 0 && !error ? (
          <div className="p-4">
            <EmptyState
              icon={<FileCode2 className="size-5" />}
              title={query || visibility || language ? "没有找到匹配的粘贴" : "你还没有创建粘贴"}
              description={
                query || visibility || language
                  ? "试试调整搜索词或筛选条件。"
                  : "把一段报错、日志或代码放进来，生成一条可以分享的链接。"
              }
              action={
                <LinkButton href="/new" size="sm">
                  <Plus className="size-3.5" />
                  新建粘贴
                </LinkButton>
              }
            />
          </div>
        ) : null}

        <div className="divide-y divide-line">
          {items.map((paste) => {
            const kind = KIND_META[paste.kind];
            const visibilityMeta = VISIBILITY_META[paste.visibility];
            return (
              <div key={paste.id} className="group flex flex-col gap-3 p-4 transition hover:bg-surface-2/25 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/p/${paste.id}`}
                      className="max-w-full truncate text-sm font-medium text-ink transition hover:text-accent"
                    >
                      {paste.title || "未命名粘贴"}
                    </Link>
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                    <Badge tone={visibilityMeta.tone}>{visibilityMeta.label}</Badge>
                    {paste.has_password ? <Lock className="size-3 text-muted" aria-label="密码保护" /> : null}
                    {paste.burn_after_read ? <Flame className="size-3 text-danger" aria-label="阅后即焚" /> : null}
                    {paste.expired ? <Badge tone="warn">已过期</Badge> : null}
                  </div>
                  <p className="mt-1 line-clamp-1 font-mono text-[11px] text-muted/65">
                    {paste.preview ?? "内容已隐藏"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted/60">
                    <span>{languageLabel(paste.language)}</span>
                    <span>{paste.views} 次查看</span>
                    <span>{expiryLabel(paste.expires_at)}</span>
                    <span className="flex items-center gap-1">
                      <TimeAgo value={paste.created_at} />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:opacity-70 sm:transition sm:group-hover:opacity-100">
                  {origin ? (
                    <CopyButton
                      value={`${origin}/p/${paste.id}`}
                      label="复制链接"
                      copiedLabel="已复制"
                      variant="ghost"
                      size="icon"
                      showLabel={false}
                    />
                  ) : null}
                  <Link href={`/p/${paste.id}`} aria-label="查看">
                    <Button variant="ghost" size="icon" title="查看">
                      <Eye className="size-4" />
                    </Button>
                  </Link>
                  {paste.can_edit ? (
                    <Link href={`/p/${paste.id}/edit`} aria-label="编辑">
                      <Button variant="ghost" size="icon" title="编辑">
                        <Pencil className="size-4" />
                      </Button>
                    </Link>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="删除"
                    onClick={() => setTarget(paste)}
                    className="hover:text-danger"
                    aria-label="删除"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {loading && items.length > 0 ? (
          <div className="border-t border-line py-3 text-center text-[11px] text-muted">正在刷新…</div>
        ) : null}

        {items.length > 0 ? (
          <div className="border-t border-line px-4 py-3">
            <Pagination
              page={page}
              hasMore={hasMore}
              total={total}
              pageSize={PAGE_SIZE}
              onChange={(nextPage) => {
                setPage(nextPage);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] text-muted/60">
        <Copy className="size-3" />
        <span>小提示：在「仅链接」模式下，只有拿到链接的人可以查看，不会出现在首页。</span>
      </div>

      <ConfirmDialog
        open={Boolean(target)}
        title="删除这条粘贴？"
        description={target ? `「${target.title || "未命名粘贴"}」的链接会立即失效，且无法恢复。` : undefined}
        loading={deleting}
        onCancel={() => setTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
