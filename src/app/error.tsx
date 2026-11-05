"use client";

import { RefreshCw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-ink">页面出了一点问题</h1>
        <p className="text-sm leading-6 text-muted">可以尝试重新加载。如果问题持续出现，请检查后端服务是否在运行。</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-xs text-ink transition hover:border-line-strong"
      >
        <RefreshCw className="size-3.5" />
        重新加载
      </button>
    </div>
  );
}
