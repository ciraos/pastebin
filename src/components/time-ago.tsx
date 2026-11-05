"use client";

import { relativeTime } from "@/lib/utils";

export function TimeAgo({ value, className }: { value: string | null; className?: string }) {
  return (
    <time
      dateTime={value ?? undefined}
      title={value ? new Date(value).toLocaleString("zh-CN") : undefined}
      className={className}
      suppressHydrationWarning
    >
      {relativeTime(value)}
    </time>
  );
}
