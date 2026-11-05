"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, KeyRound, LogOut, Palette, Shield, UserRound } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { RequireAuth } from "@/components/require-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge, Button, Input, PageLoader } from "@/components/ui";
import { passwordScore } from "@/lib/password";
import { cn, formatDate } from "@/lib/utils";
import type { User } from "@/lib/types";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}

function SettingsContent() {
  const { user, loading, setUser, logout } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const strength = passwordScore(newPassword);

  if (loading) return <PageLoader />;
  if (!user) return <PageLoader label="正在跳转到登录页…" />;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (profileSaving) return;
    setProfileError(null);
    setProfileSaved(false);
    if (!displayName.trim()) {
      setProfileError("昵称不能为空");
      return;
    }
    setProfileSaving(true);
    try {
      const data = await api<{ user: User }>("/auth/me", {
        method: "PATCH",
        body: { display_name: displayName.trim() },
      });
      setUser(data.user);
      setProfileSaved(true);
      toast("资料已更新");
      window.setTimeout(() => setProfileSaved(false), 2000);
    } catch (saveError) {
      setProfileError(errorMessage(saveError));
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (passwordSaving) return;
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("新密码至少需要 8 位字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("两次输入的新密码不一致");
      return;
    }
    setPasswordSaving(true);
    try {
      await api("/auth/password", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword },
      });
      toast("密码已更新，其他设备已退出登录");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (saveError) {
      setPasswordError(errorMessage(saveError));
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">账号设置</h1>
        <p className="mt-1 text-sm text-muted">管理你的个人资料和登录密码。</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <UserRound className="size-3.5 text-accent" />
              <h2 className="text-xs font-semibold text-ink">个人资料</h2>
            </div>
            <form onSubmit={saveProfile} className="space-y-4 p-4">
              <Input
                label="昵称"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={40}
                required
                hint="显示在你创建的粘贴和公开列表中。"
              />
              <Input label="邮箱" value={user.email} disabled hint="邮箱是登录账号，如需更换请联系管理员。" />
              {profileError ? (
                <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">{profileError}</div>
              ) : null}
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" loading={profileSaving}>
                  {profileSaved ? <Check className="size-3.5" /> : null}
                  保存资料
                </Button>
                {profileSaved ? <span className="text-[11px] text-accent">已保存</span> : null}
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <KeyRound className="size-3.5 text-accent" />
              <h2 className="text-xs font-semibold text-ink">修改密码</h2>
            </div>
            <form onSubmit={savePassword} className="space-y-4 p-4">
              <Input
                label="当前密码"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <div>
                <Input
                  label="新密码"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  hint="修改后，其他设备上的登录会立即失效。"
                />
                {newPassword ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <span
                          key={level}
                          className={cn(
                            "h-1 flex-1 rounded-full",
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
                ) : null}
              </div>
              <Input
                label="确认新密码"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                error={confirmPassword && confirmPassword !== newPassword ? "两次输入的密码不一致" : null}
              />
              {passwordError ? (
                <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {passwordError}
                </div>
              ) : null}
              <Button type="submit" size="sm" loading={passwordSaving}>
                更新密码
              </Button>
            </form>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <Palette className="size-3.5 text-accent" />
              <h2 className="text-xs font-semibold text-ink">界面主题</h2>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-canvas/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-ink">跟随时间 / 浅色 / 深色</p>
                <p className="text-[10px] text-muted">选择「跟随时间」后，白天浅色、19:00 后自动变深色。</p>
              </div>
              <ThemeToggle className="border border-line" />
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-xs font-semibold text-ink">账号信息</h2>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">角色</dt>
                <dd>
                  {user.role === "admin" ? (
                    <Badge tone="accent">
                      <Shield className="size-3" />
                      管理员
                    </Badge>
                  ) : (
                    <Badge tone="neutral">成员</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">加入时间</dt>
                <dd className="text-ink/80">{formatDate(user.created_at)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">最近登录</dt>
                <dd className="text-ink/80">{user.last_login_at ? formatDate(user.last_login_at, true) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">用户 ID</dt>
                <dd className="max-w-36 truncate font-mono text-[10px] text-muted/70">{user.id}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2 border-t border-line pt-3">
              {user.role === "admin" ? (
                <Link href="/admin" className="block">
                  <Button variant="secondary" size="sm" className="w-full">
                    <Shield className="size-3.5" />
                    用户管理
                  </Button>
                </Link>
              ) : null}
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted hover:text-danger" onClick={() => void logout()}>
                <LogOut className="size-3.5" />
                退出登录
              </Button>
            </div>
          </section>

          <div className="rounded-xl border border-line bg-surface/50 p-4">
            <p className="text-[11px] leading-5 text-muted/70">
              账号由管理员创建。如果忘记密码且无法登录，请联系管理员在「用户管理」中重置。
            </p>
            <Link href="/dashboard" className="mt-2 inline-block">
              <span className="text-[11px] font-medium text-accent transition hover:underline">返回我的粘贴 →</span>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
