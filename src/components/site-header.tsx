"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { useAuth } from "./auth-provider";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, Badge, Button } from "./ui";
import { useSiteConfig } from "./site-config-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "最近公开" },
  { href: "/dashboard", label: "我的粘贴" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { siteName } = useSiteConfig();
  // Auth is resolved on the client, so the server HTML always shows the skeleton.
  // Branching on `mounted` keeps the first client render identical and avoids a
  // hydration mismatch when the session resolves before hydration finishes.
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const minimal = pathname === "/setup" || pathname === "/login";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={`${siteName} 首页`}>
          <span className="flex size-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 font-mono text-[13px] font-bold text-accent transition group-hover:bg-accent/15">
            &gt;_
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight text-ink">{siteName}</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-muted/70 sm:inline">paste</span>
          </span>
        </Link>

        {!minimal ? (
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[13px] transition",
                    active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {user?.role === "admin" ? (
              <Link
                href="/admin"
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[13px] transition",
                  pathname.startsWith("/admin")
                    ? "bg-surface-2 text-ink"
                    : "text-muted hover:bg-surface-2/60 hover:text-ink",
                )}
              >
                管理
              </Link>
            ) : null}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {minimal ? null : !mounted || loading ? (
            <span className="block h-8 w-24 animate-pulse rounded-lg bg-surface-2" />
          ) : user ? (
            <>
              <Link href="/new" className="hidden sm:block">
                <Button size="sm">
                  <Plus className="size-3.5" />
                  新建
                </Button>
              </Link>
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-lg border border-transparent p-1 pr-1.5 transition hover:border-line hover:bg-surface-2"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <Avatar name={user.display_name} size="sm" />
                  <span className="hidden max-w-28 truncate text-xs font-medium text-ink sm:block">{user.display_name}</span>
                  <ChevronDown className="hidden size-3.5 text-muted sm:block" />
                </button>
                {userMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/40 animate-[popIn_120ms_ease-out]"
                  >
                    <div className="border-b border-line px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user.display_name} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-ink">{user.display_name}</p>
                          <p className="truncate text-[11px] text-muted">{user.email}</p>
                        </div>
                      </div>
                      {user.role === "admin" ? (
                        <Badge tone="accent" className="mt-2">
                          管理员
                        </Badge>
                      ) : null}
                    </div>
                    <div className="p-1">
                      <MenuLink href="/dashboard" icon={<LayoutDashboard className="size-4" />} label="我的粘贴" />
                      <MenuLink href="/new" icon={<Plus className="size-4" />} label="新建粘贴" />
                      <MenuLink href="/settings" icon={<Settings className="size-4" />} label="账号设置" />
                      {user.role === "admin" ? (
                        <MenuLink href="/admin" icon={<Shield className="size-4" />} label="用户管理" />
                      ) : null}
                    </div>
                    <div className="border-t border-line p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          void logout();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-muted transition hover:bg-danger/10 hover:text-danger"
                        role="menuitem"
                      >
                        <LogOut className="size-4" />
                        退出登录
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-1.5 text-[13px] text-muted transition hover:bg-surface-2 hover:text-ink sm:block"
              >
                登录
              </Link>
              <Link href="/new">
                <Button size="sm" variant="primary">
                  <Plus className="size-3.5" />
                  新建粘贴
                </Button>
              </Link>
            </>
          )}

          {!minimal ? (
            <button
              type="button"
              className="ml-0.5 flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="打开菜单"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          ) : null}
        </div>
      </div>

      {menuOpen && !minimal ? (
        <div className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/new" className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink">
              新建粘贴
            </Link>
            {!user ? (
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink">
                登录
              </Link>
            ) : null}
            {user?.role === "admin" ? (
              <Link href="/admin" className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink">
                用户管理
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      {icon}
      {label}
    </Link>
  );
}
