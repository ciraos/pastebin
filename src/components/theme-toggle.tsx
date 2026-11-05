"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Moon, Sun, SunMoon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyTheme,
  readStoredMode,
  storeMode,
  THEME_MODES,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme";

const OPTIONS: Array<{ value: ThemeMode; label: string; hint: string; icon: typeof Sun }> = [
  { value: "auto", label: "跟随时间", hint: "白天浅色 · 19:00 后深色", icon: SunMoon },
  { value: "light", label: "浅色", hint: "始终使用浅色", icon: Sun },
  { value: "dark", label: "深色", hint: "始终使用深色", icon: Moon },
];

const MODE_LABEL: Record<ThemeMode, string> = { auto: "跟随时间", light: "浅色", dark: "深色" };

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [open, setOpen] = useState(false);
  // Effects must not apply "auto" before the stored mode is known, otherwise the
  // initial auto tick would override an explicit light/dark choice on reload.
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with what the bootstrap script already applied.
  useEffect(() => {
    const stored = readStoredMode();
    setMode(stored);
    setResolved(applyTheme(stored));
    setMounted(true);
  }, []);

  // In auto mode, re-evaluate at the day/night boundary and when the tab returns.
  useEffect(() => {
    if (!mounted || mode !== "auto") return;
    const tick = () => setResolved(applyTheme("auto"));
    tick();
    const timer = window.setInterval(tick, 60_000);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, mounted]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "pb-theme") return;
      const next = readStoredMode();
      setMode(next);
      setResolved(applyTheme(next));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: ThemeMode) {
    setMode(next);
    setResolved(applyTheme(next));
    storeMode(next);
    setOpen(false);
  }

  const Icon = mode === "auto" ? SunMoon : mode === "light" ? Sun : Moon;
  const description = mode === "auto" ? `跟随时间（当前${resolved === "light" ? "浅色" : "深色"}）` : `${MODE_LABEL[mode]}模式`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink",
          className,
        )}
        aria-label={`主题：${description}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={description}
      >
        <Icon className="size-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-2xl shadow-black/40"
        >
          {THEME_MODES.map((value) => {
            const option = OPTIONS.find((item) => item.value === value)!;
            const OptionIcon = option.icon;
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(value)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                  active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink",
                )}
              >
                <OptionIcon className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">{option.label}</span>
                  <span className="block truncate text-[10px] text-muted">{option.hint}</span>
                </span>
                {active ? <Check className="mt-0.5 size-3.5 shrink-0 text-accent" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

