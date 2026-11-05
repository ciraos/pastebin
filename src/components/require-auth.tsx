"use client";

import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useAuth } from "./auth-provider";
import { Button, PageLoader } from "./ui";

export function RequireAuth({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <PageLoader label="正在跳转到登录页…" />;

  if (admin && user.role !== "admin") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-danger/20 bg-danger/10 text-danger">
          <ShieldAlert className="size-5" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-ink">需要管理员权限</h1>
          <p className="text-sm text-muted">这个页面仅对站点管理员开放。</p>
        </div>
        <Link href="/dashboard">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="size-3.5" />
            返回我的粘贴
          </Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
