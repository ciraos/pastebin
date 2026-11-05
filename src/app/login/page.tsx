"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LogIn, Terminal } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { Button, Input, LinkButton, PageLoader } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader label="正在准备登录…" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, setupRequired, login, setSetupRequired } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextParam = searchParams.get("next");
  const target = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  useEffect(() => {
    if (!loading && user) {
      router.replace(target);
    }
  }, [loading, user, router, target]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email.trim(), password, remember);
      toast(`欢迎回来，${loggedIn.display_name}`);
      router.replace(target);
      router.refresh();
    } catch (loginError) {
      if (loginError instanceof ApiError && loginError.code === "setup_required") {
        setSetupRequired(true);
        router.push("/setup");
        return;
      }
      setError(errorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader label="正在检查登录状态…" />;

  if (setupRequired) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
          <Terminal className="size-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">站点还没有初始化</h1>
          <p className="text-sm leading-6 text-muted">第一次使用需要先创建管理员账号，这个过程只需要一分钟。</p>
        </div>
        <LinkButton href="/setup">
          开始初始化
          <ArrowRight className="size-4" />
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 font-mono text-base font-bold text-accent shadow-lg shadow-accent/5">
            &gt;_
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">欢迎回来</h1>
          <p className="mt-1.5 text-sm text-muted">登录后管理你的粘贴和分享链接。</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-2xl shadow-black/20 sm:p-7">
          <form onSubmit={onSubmit} className="space-y-4">
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
            <Input
              label="密码"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入密码"
              autoComplete="current-password"
              required
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

            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="size-3.5 rounded border-line bg-canvas text-accent accent-teal-400"
              />
              在这台设备上保持登录
            </label>

            {error ? (
              <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs leading-5 text-danger">
                {error}
              </div>
            ) : null}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              <LogIn className="size-4" />
              登录
            </Button>
          </form>

          <div className="mt-5 border-t border-line pt-4 text-center text-[11px] leading-5 text-muted/70">
            账号由管理员创建，忘记密码请联系管理员重置。
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/" className="transition hover:text-accent">
            先随便看看公开粘贴
          </Link>
        </p>
      </div>
    </div>
  );
}
