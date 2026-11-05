"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileCode2,
  Link2,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { PasteCard } from "@/components/paste-card";
import { Badge, Button, EmptyState, Input, LinkButton, Select, Spinner } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import type { PasteListResponse, PasteSummary, PublicStats } from "@/lib/types";
import { LANGUAGES } from "@/lib/utils";

const PAGE_SIZE = 9;

export default function HomePage() {
  const [pastes, setPastes] = useState<PasteSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          scope: "public",
          page: String(page),
          limit: String(PAGE_SIZE),
          sort: "newest",
        });
        if (query.trim()) params.set("q", query.trim());
        if (language) params.set("language", language);
        api<PasteListResponse>(`/pastes?${params.toString()}`, { signal: controller.signal })
          .then((response) => {
            if (!active) return;
            setPastes(response.items);
            setTotal(response.total);
            setHasMore(response.has_more);
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
      query.trim() ? 280 : 0,
    );

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, query, language, reloadKey]);

  useEffect(() => {
    api<PublicStats>("/stats/public")
      .then(setStats)
      .catch(() => undefined);
  }, []);

  function refresh() {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }

  // Publishing no longer requires an account: everyone can open the editor.
  const newHref = "/new";

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b border-line/70">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:gap-12 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0">
            <Badge tone="accent" className="h-7 gap-2 px-2.5">
              <Sparkles className="size-3.5" />
              为开发团队准备的代码粘贴板
            </Badge>

            <h1 className="mt-5 text-[2.05rem] font-semibold leading-[1.12] tracking-tight text-ink sm:mt-6 sm:text-6xl">
              把代码和报错，
              <br />
              <span className="text-gradient">变成一条干净的链接。</span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-7 text-muted">
              不用再往聊天窗口里贴一大段日志。把堆栈、配置或代码片段放进来，自动语法高亮，
              支持密码、有效期和阅后即焚，然后把链接发给同事。
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <LinkButton href={newHref} size="lg" className="group">
                新建一条粘贴
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </LinkButton>
              <LinkButton href="#recent" variant="secondary" size="lg">
                看看最近分享
              </LinkButton>
            </div>

            <p className="mt-3 text-[11px] text-muted/70">
              无需登录即可发布 · 编辑与删除由管理员统一管理
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line/60 pt-6">
              <HeroStat value={stats?.pastes} label="条公开分享" />
              <HeroStat value={stats?.views} label="次查看" />
              <HeroStat value={stats?.users} label="位成员" />
              <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted/70 sm:flex">
                <LockKeyhole className="size-3" />
                数据自托管，不经第三方
              </span>
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>

      <section id="recent" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-ink">最近公开</h2>
              <Badge tone="neutral">{total}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">公开粘贴会出现在这里，私密内容只有自己可见。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-56">
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="搜索标题…"
                leading={<Search className="size-3.5" />}
                aria-label="搜索公开粘贴"
              />
            </div>
            <div className="w-40">
              <Select
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value);
                  setPage(1);
                }}
                aria-label="按语言筛选"
              >
                <option value="">全部语言</option>
                {LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" size="icon" onClick={refresh} aria-label="刷新列表" title="刷新">
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" size="sm" onClick={refresh}>
              重试
            </Button>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && pastes.length === 0
            ? Array.from({ length: 6 }).map((_, index) => <PasteSkeleton key={index} />)
            : pastes.map((paste) => <PasteCard key={paste.id} paste={paste} />)}
        </div>

        {!loading && !error && pastes.length === 0 ? (
          <EmptyState
            className="mt-6"
            icon={<FileCode2 className="size-5" />}
            title={query || language ? "没有找到匹配的粘贴" : "这里还没有公开粘贴"}
            description={
              query || language
                ? "换个关键词或语言试试，也可以直接创建一条新的。"
                : "成为第一个分享的人，把一段报错或代码变成链接。"
            }
            action={
              <LinkButton href={newHref} size="sm">
                新建粘贴
                <ArrowRight className="size-3.5" />
              </LinkButton>
            }
          />
        ) : null}

        {loading && pastes.length > 0 ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
            <Spinner className="size-4" />
            正在刷新…
          </div>
        ) : null}

        <Pagination
          page={page}
          hasMore={hasMore}
          total={total}
          pageSize={PAGE_SIZE}
          onChange={(nextPage) => {
            setPage(nextPage);
            document.getElementById("recent")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </section>

      <section className="border-t border-line/70 bg-surface/35">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">为分享而设计</h2>
              <p className="mt-1 text-sm text-muted">开发团队每天都在用的几件小事，我们做顺手了。</p>
            </div>
            <Link
              href="/login"
              className="group inline-flex items-center gap-1 text-xs text-muted transition hover:text-accent"
            >
              登录管理
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <FeatureCard
              icon={<Zap className="size-4" />}
              title="自动高亮，读起来不费劲"
              description="Python、TypeScript、Go、SQL 等常用语言自动着色，带行号与一键复制。"
            />
            <FeatureCard
              icon={<ShieldCheck className="size-4" />}
              title="密码、私密、到期与阅后即焚"
              description="按需选择可见性；敏感内容可加密码，或设置阅读一次后自动销毁。"
            />
            <FeatureCard
              icon={<Link2 className="size-4" />}
              title="一条链接，随处打开"
              description="未登录也能查看公开或仅链接的粘贴，原始文本随时下载。"
            />
          </div>
        </div>
      </section>

    </div>
  );
}

function HeroStat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div>
      <div className="text-xl font-semibold tabular-nums tracking-tight text-ink">
        {value === undefined ? "—" : new Intl.NumberFormat("zh-CN").format(value)}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full min-w-0 max-w-lg lg:mx-0">
      <div className="absolute -inset-4 rounded-[2rem] bg-accent/[0.06] blur-2xl" aria-hidden />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-[#0b0e13] shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
            <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
            <span className="size-2.5 rounded-full bg-[#28c840]/80" />
          </span>
          <span className="ml-2 font-mono text-[11px] text-white/40">worker.ts</span>
          <span className="ml-auto rounded border border-rose-400/20 bg-rose-400/10 px-1.5 py-0.5 font-mono text-[10px] text-rose-300">
            error
          </span>
        </div>

        <div className="overflow-x-auto px-4 py-4 font-mono text-[11.5px] leading-6">
          <CodeLine number={41}>
            <span className="text-[#c4a7f7]">const</span> <span className="text-[#82aaff]">worker</span>
            <span className="text-[#d7e2f0]"> = </span>
            <span className="text-[#c4a7f7]">async</span>
            <span className="text-[#d7e2f0]"> (job) =&gt; {"{"}</span>
          </CodeLine>
          <CodeLine number={42}>
            <span className="text-[#d7e2f0]">  </span>
            <span className="text-[#c4a7f7]">const</span>
            <span className="text-[#d7e2f0]"> user = </span>
            <span className="text-[#c4a7f7]">await</span>
            <span className="text-[#d7e2f0]"> db.user.</span>
            <span className="text-[#82aaff]">findUnique</span>
            <span className="text-[#d7e2f0]">({"{"} id: job.userId {"}"});</span>
          </CodeLine>
          <CodeLine number={43}>
            <span className="text-[#d7e2f0]">  </span>
            <span className="text-[#c4a7f7]">return</span>
            <span className="text-[#d7e2f0]"> user.profile.name; </span>
            <span className="text-[#63758c]">{"// ← here"}</span>
          </CodeLine>
          <CodeLine number={44}>
            <span className="text-[#d7e2f0]">{"}"};</span>
          </CodeLine>
          <div className="my-2 border-t border-dashed border-white/[0.07]" />
          <CodeLine number={45}>
            <span className="text-[#ff9cac]">TypeError</span>
            <span className="text-[#d7e2f0]">: Cannot read properties of </span>
            <span className="text-[#c4a7f7]">undefined</span>
          </CodeLine>
          <CodeLine number={46}>
            <span className="text-[#63758c]">    at </span>
            <span className="text-[#82aaff]">handleRequest</span>
            <span className="text-[#63758c]"> (/app/worker.ts:42:18)</span>
          </CodeLine>
          <CodeLine number={47}>
            <span className="text-[#63758c]">    at processTicksAndRejections (node:internal/task_queues:95:5)</span>
          </CodeLine>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <span className="font-mono text-[11px] text-white/45">paste.local/p/9fK2xQ</span>
          <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
            链接已复制
          </span>
        </div>
      </div>

      <div className="absolute -right-2 -top-4 hidden rotate-3 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] font-medium text-muted shadow-xl sm:flex">
        <Timer className="size-3 text-accent" />
        24 小时后过期
      </div>
      <div className="absolute -bottom-4 -left-3 hidden -rotate-2 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] font-medium text-muted shadow-xl sm:flex">
        <LockKeyhole className="size-3 text-accent" />
        阅后即焚
      </div>
    </div>
  );
}

function CodeLine({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex min-w-max gap-3 whitespace-pre">
      <span className="w-5 select-none text-right text-white/20">{number}</span>
      <span>{children}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-line bg-surface p-5 transition hover:border-line-strong hover:bg-surface-2/40">
      <div className="flex size-9 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-6 text-muted">{description}</p>
    </div>
  );
}

function PasteSkeleton() {
  return (
    <div className="flex h-48 flex-col rounded-xl border border-line bg-surface p-4">
      <div className="flex gap-2">
        <span className="h-5 w-12 animate-pulse rounded bg-surface-2" />
        <span className="h-5 w-16 animate-pulse rounded bg-surface-2" />
      </div>
      <span className="mt-4 h-4 w-2/3 animate-pulse rounded bg-surface-2" />
      <span className="mt-3 h-3 w-full animate-pulse rounded bg-surface-2" />
      <span className="mt-2 h-3 w-5/6 animate-pulse rounded bg-surface-2" />
      <div className="mt-auto flex items-center gap-2">
        <span className="size-6 animate-pulse rounded-full bg-surface-2" />
        <span className="h-3 w-20 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
