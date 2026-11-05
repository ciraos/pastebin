"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Download,
  ExternalLink,
  FileX2,
  Fingerprint,
  Flame,
  Link2,
  Lock,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { CodeBlock } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TimeAgo } from "@/components/time-ago";
import { Avatar, Badge, Button, Input, LinkButton } from "@/components/ui";
import { useSiteConfig } from "@/components/site-config-provider";
import type { PasteDetail } from "@/lib/types";
import {
  cn,
  extensionFor,
  expiryLabel,
  formatBytes,
  formatDate,
  KIND_META,
  languageLabel,
  VISIBILITY_META,
} from "@/lib/utils";

type ViewState = "loading" | "ready" | "locked" | "expired" | "notfound" | "error";

export function PasteView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { siteName } = useSiteConfig();
  const { toast } = useToast();
  const [state, setState] = useState<ViewState>("loading");
  const [paste, setPaste] = useState<PasteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const pasteId = params.id;

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  useEffect(() => {
    let active = true;
    setState("loading");
    setError(null);
    api<{ paste: PasteDetail }>(`/pastes/${pasteId}`)
      .then((data) => {
        if (!active) return;
        setPaste(data.paste);
        setState("ready");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        if (loadError instanceof ApiError) {
          if (loadError.code === "password_required") {
            setState("locked");
            return;
          }
          if (loadError.status === 410 || loadError.code === "expired") {
            setState("expired");
            return;
          }
          if (loadError.status === 404) {
            setState("notfound");
            return;
          }
        }
        setError(errorMessage(loadError));
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [pasteId, retryKey]);

  useEffect(() => {
    if (paste?.title) {
      document.title = `${paste.title} · ${siteName}`;
    }
  }, [paste, siteName]);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (!password || unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const data = await api<{ paste: PasteDetail }>(`/pastes/${pasteId}/unlock`, {
        method: "POST",
        body: { password },
      });
      setPaste(data.paste);
      setState("ready");
      setPassword("");
      toast("已解锁");
    } catch (unlockFailure) {
      setUnlockError(errorMessage(unlockFailure));
    } finally {
      setUnlocking(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api(`/pastes/${pasteId}`, { method: "DELETE" });
      toast("粘贴已删除");
      router.push("/dashboard");
      router.refresh();
    } catch (deleteError) {
      toast(errorMessage(deleteError), "error");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function download() {
    if (!paste) return;
    const blob = new Blob([paste.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${paste.id}.${extensionFor(paste.language)}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  if (state === "loading") return <ViewSkeleton />;

  if (state === "locked") {
    return (
      <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col justify-center px-4 py-16">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative rounded-2xl border border-line bg-surface p-7 shadow-2xl shadow-black/20">
          <div className="flex size-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
            <Lock className="size-5" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">这段内容受密码保护</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            请输入分享者设置的访问密码。解锁后一小时内可以直接查看。
          </p>
          <form onSubmit={unlock} className="mt-5 space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="访问密码"
              autoFocus
              autoComplete="off"
              error={unlockError}
            />
            <Button type="submit" className="w-full" loading={unlocking} disabled={!password}>
              <Fingerprint className="size-4" />
              解锁查看
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-[11px] text-muted/60">
            <span className="font-mono">{pasteId}</span>
            <Link href="/" className="transition hover:text-accent">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <StatusScreen
        icon={<CalendarClock className="size-5" />}
        title="这条粘贴已经过期"
        description="分享者设置了有效期，内容已被自动隐藏。可以联系对方重新生成一条。"
        action={
          <div className="flex gap-2">
            <LinkButton href="/" variant="secondary" size="sm">
              返回首页
            </LinkButton>
            {user ? (
              <LinkButton href="/new" size="sm">
                新建粘贴
              </LinkButton>
            ) : null}
          </div>
        }
      />
    );
  }

  if (state === "notfound") {
    return (
      <StatusScreen
        icon={<FileX2 className="size-5" />}
        title="找不到这条粘贴"
        description="链接可能不正确，或者内容已被删除、阅后即焚。"
        action={
          <LinkButton href="/" variant="secondary" size="sm">
            <ArrowLeft className="size-3.5" />
            返回首页
          </LinkButton>
        }
      />
    );
  }

  if (state === "error" || !paste) {
    return (
      <StatusScreen
        icon={<AlertTriangle className="size-5" />}
        title="加载失败"
        description={error ?? "暂时无法读取这条粘贴，请稍后重试。"}
        action={
          <Button variant="secondary" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
            <RefreshCw className="size-3.5" />
            重新加载
          </Button>
        }
      />
    );
  }

  const kind = KIND_META[paste.kind];
  const visibility = VISIBILITY_META[paste.visibility];
  const title = paste.title || "未命名粘贴";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={user ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-accent"
        >
          <ArrowLeft className="size-3.5" />
          {user ? "我的粘贴" : "返回首页"}
        </Link>
        <div className="flex items-center gap-1.5">
          {shareUrl ? <CopyButton value={shareUrl} label="复制链接" variant="secondary" size="sm" /> : null}
          <a href={`/api/pastes/${paste.id}/raw`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="sm">
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">原始文本</span>
            </Button>
          </a>
          <Button variant="ghost" size="sm" onClick={download}>
            <Download className="size-3.5" />
            <span className="hidden sm:inline">下载</span>
          </Button>
          {paste.can_edit ? (
            <Link href={`/p/${paste.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil className="size-3.5" />
                编辑
              </Button>
            </Link>
          ) : null}
          {paste.can_delete ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-muted hover:text-danger">
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <header className="mt-5 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={kind.tone}>{kind.label}</Badge>
          <Badge tone="neutral">{languageLabel(paste.language)}</Badge>
          <Badge tone={visibility.tone}>{visibility.label}</Badge>
          {paste.has_password ? (
            <Badge tone="neutral">
              <Lock className="size-3" />
              密码保护
            </Badge>
          ) : null}
          {paste.burn_after_read ? (
            <Badge tone="danger">
              <Flame className="size-3" />
              阅后即焚
            </Badge>
          ) : null}
          {paste.expired ? <Badge tone="warn">已过期</Badge> : null}
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
              {title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <Avatar name={paste.owner.display_name} size="sm" />
                <span className="text-ink/90">{paste.owner.display_name}</span>
                {paste.is_owner ? <span className="text-muted/60">（你）</span> : null}
              </span>
              <span title={formatDate(paste.created_at, true)}>
                创建于 <TimeAgo value={paste.created_at} />
              </span>
              <span>{paste.views} 次查看</span>
              <span>{formatBytes(paste.size)}</span>
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3" />
                {expiryLabel(paste.expires_at)}
              </span>
            </div>
          </div>
        </div>

        {paste.burned ? (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-danger/25 bg-danger/[0.06] px-3.5 py-2.5">
            <Flame className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="text-xs font-medium text-danger">这是阅后即焚的粘贴</p>
              <p className="mt-0.5 text-[11px] leading-5 text-muted">
                内容已经销毁，仅保留当前的页面。刷新或关闭后将无法再次打开。
              </p>
            </div>
          </div>
        ) : null}

        {paste.expired && (paste.can_edit || paste.is_owner) ? (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-warn/25 bg-warn/[0.06] px-3.5 py-2.5">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" />
            <p className="text-[11px] leading-5 text-muted">
              {paste.can_edit
                ? "这条粘贴已经过期，只有管理员能看到内容。可以编辑有效期，或删除它。"
                : "这条粘贴已经过期，只有你和管理员能看到内容。需要修改或删除请联系管理员。"}
            </p>
          </div>
        ) : null}
      </header>

      <div className="mt-6">
        <CodeBlock
          code={paste.content}
          language={paste.language}
          maxHeightClass="max-h-[72vh]"
          filename={paste.title ? undefined : `${paste.id}.${extensionFor(paste.language)}`}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Link2 className="size-3.5 shrink-0 text-accent" />
          <span className="truncate font-mono text-[11px] text-muted/80">{shareUrl || `/p/${paste.id}`}</span>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {shareUrl ? <CopyButton value={shareUrl} label="复制链接" variant="primary" size="sm" /> : null}
          <span className="hidden items-center gap-1 text-[11px] text-muted/60 sm:flex">
            <UserRound className="size-3" />
            {paste.visibility === "public" ? "任何人可查看" : paste.visibility === "unlisted" ? "拿到链接即可查看" : "仅自己可见"}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted/60">
        <span className="flex items-center gap-1.5 font-mono">
          <Fingerprint className="size-3" />
          {paste.id}
        </span>
        <span>最后更新于 {formatDate(paste.updated_at, true)}</span>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这条粘贴？"
        description="删除后链接会立即失效，且无法恢复。"
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </div>
  );
}

function ViewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
      <div className="mt-6 space-y-3">
        <div className="flex gap-2">
          <span className="h-6 w-12 animate-pulse rounded bg-surface-2" />
          <span className="h-6 w-16 animate-pulse rounded bg-surface-2" />
        </div>
        <span className="block h-8 w-2/3 animate-pulse rounded bg-surface-2" />
        <span className="block h-4 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-xl border border-line bg-surface" />
    </div>
  );
}

function StatusScreen({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className={cn("flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-muted")}>
        {icon}
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
