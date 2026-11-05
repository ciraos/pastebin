"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { Badge, Button, Input, LinkButton, PageLoader } from "@/components/ui";
import { passwordScore } from "@/lib/password";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

export default function SetupPage() {
  const router = useRouter();
  const { loading, setupRequired, refresh, setUser, setSetupRequired, error: authError } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const strength = passwordScore(password);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    if (!email.trim()) {
      setError("请填写邮箱");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 位字符");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      const data = await api<{ user: User }>("/setup", {
        method: "POST",
        body: { email: email.trim(), password, display_name: displayName.trim() },
      });
      setUser(data.user);
      setSetupRequired(false);
      toast("管理员账号已创建，欢迎使用");
      router.replace("/dashboard");
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader label="正在检查站点状态…" />;

  if (!setupRequired) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
          <Check className="size-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">站点已经准备好了</h1>
          <p className="text-sm leading-6 text-muted">管理员账号已存在。如果你不是管理员，请联系站长为你创建账号。</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/login">去登录</LinkButton>
          <LinkButton href="/" variant="secondary">
            回到首页
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line/70 bg-surface/30 p-12 lg:flex">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative">
          <Badge tone="accent">
            <Sparkles className="size-3.5" />
            首次启动
          </Badge>
          <h1 className="mt-6 max-w-md text-4xl font-semibold leading-tight tracking-tight text-ink">
            先把门装好，
            <br />
            再开始分享代码。
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-7 text-muted">
            这是站点的第一次启动。创建一个管理员账号，之后就可以邀请团队成员，并决定谁能查看你的粘贴。
          </p>

          <div className="mt-10 space-y-4">
            <Step index="01" title="创建管理员" description="使用邮箱和密码注册，这个账号拥有最高权限。" active />
            <Step index="02" title="邀请成员" description="在管理后台为同事创建账号，或让他们直接查看分享链接。" />
            <Step index="03" title="开始分享" description="粘贴代码或报错，生成一条带高亮的短链接。" />
          </div>
        </div>

        <div className="relative flex items-start gap-3 rounded-xl border border-line bg-surface/70 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-xs leading-5 text-muted">
            密码使用 scrypt 加盐哈希存储，会话 Cookie 设置为 HttpOnly。所有数据保存在你自己的 PostgreSQL 数据库中。
          </p>
        </div>
      </aside>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-7 lg:hidden">
            <Badge tone="accent">首次启动</Badge>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">创建管理员账号</h1>
            <p className="mt-2 text-sm text-muted">第一个注册的账号将自动成为管理员。</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="mb-6 hidden items-center gap-3 lg:flex">
              <span className="flex size-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                <KeyRound className="size-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink">创建管理员账号</h2>
                <p className="text-xs text-muted">只需一次，之后用这个账号登录。</p>
              </div>
            </div>

            {authError ? (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5">
                <p className="text-xs text-danger">{authError}</p>
                <button
                  type="button"
                  onClick={() => void refresh().catch(() => undefined)}
                  className="w-fit text-xs font-medium text-danger underline-offset-2 hover:underline"
                >
                  重新连接
                </button>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="昵称（可选）"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="比如：阿吉"
                autoComplete="nickname"
                maxLength={40}
              />
              <Input
                label="邮箱"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
              <div>
                <Input
                  label="密码"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位字符"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="rounded p-1 text-muted transition hover:text-ink"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <span
                        key={level}
                        className={cn(
                          "h-1 flex-1 rounded-full transition",
                          strength.score >= level
                            ? strength.tone === "danger"
                              ? "bg-danger"
                              : strength.tone === "warn"
                                ? "bg-warn"
                                : strength.tone === "info"
                                  ? "bg-info"
                                  : "bg-accent"
                            : "bg-surface-2",
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted">{strength.label}</span>
                </div>
              </div>
              <Input
                label="确认密码"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="再输入一次"
                autoComplete="new-password"
                required
                error={confirm && confirm !== password ? "两次输入的密码不一致" : null}
              />

              {error ? (
                <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs leading-5 text-danger">
                  {error}
                </div>
              ) : null}

              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                创建管理员并进入
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <p className="mt-5 text-center text-[11px] leading-5 text-muted/70">
              继续即表示你了解：这个账号将成为站点管理员。已有账号？
              <Link href="/login" className="ml-1 text-accent hover:underline">
                直接登录
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({
  index,
  title,
  description,
  active = false,
}: {
  index: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3.5 transition", active ? "border-accent/25 bg-accent/[0.04]" : "border-transparent")}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px]",
          active ? "border-accent/30 bg-accent/10 text-accent" : "border-line bg-surface-2 text-muted",
        )}
      >
        {index}
      </span>
      <div>
        <p className={cn("text-xs font-semibold", active ? "text-ink" : "text-muted")}>{title}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-muted/80">{description}</p>
      </div>
    </div>
  );
}
