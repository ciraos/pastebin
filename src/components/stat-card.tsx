import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "warn" | "danger";
}) {
  const tones = {
    neutral: "text-muted",
    accent: "text-accent",
    warn: "text-warn",
    danger: "text-danger",
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted">{label}</span>
        {icon ? <span className={cn("opacity-80", tones[tone])}>{icon}</span> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</div>
      {hint ? <p className="mt-0.5 text-[11px] text-muted/70">{hint}</p> : null}
    </div>
  );
}
