"use client";

import Link from "next/link";
import { Lock, Pin } from "lucide-react";
import type { PasteSummary } from "@/lib/types";
import { Avatar, Badge } from "./ui";
import { TimeAgo } from "./time-ago";
import { cn, KIND_META, languageLabel, VISIBILITY_META } from "@/lib/utils";

const kindAccent: Record<PasteSummary["kind"], string> = {
  code: "before:bg-info",
  error: "before:bg-danger",
  log: "before:bg-warn",
  text: "before:bg-line-strong",
};

export function PasteCard({ paste }: { paste: PasteSummary }) {
  const kind = KIND_META[paste.kind];
  return (
    <Link
      href={`/p/${paste.id}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 transition duration-200",
        "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-black/20",
        "before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:opacity-60 before:transition group-hover:before:opacity-100",
        kindAccent[paste.kind],
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={kind.tone}>{kind.label}</Badge>
        <Badge tone="neutral">{languageLabel(paste.language)}</Badge>
        {paste.visibility !== "public" ? (
          <Badge tone={VISIBILITY_META[paste.visibility].tone}>{VISIBILITY_META[paste.visibility].label}</Badge>
        ) : null}
        {paste.has_password ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted" title="密码保护">
            <Lock className="size-3" />
          </span>
        ) : null}
        <span className="ml-auto text-[11px] text-muted/70">
          <TimeAgo value={paste.created_at} />
        </span>
      </div>

      <h3 className="mt-3 line-clamp-1 text-sm font-semibold text-ink transition group-hover:text-accent">
        {paste.title || "未命名粘贴"}
      </h3>

      {paste.preview ? (
        <pre className="mt-2 line-clamp-3 overflow-hidden whitespace-pre-wrap break-words font-mono text-[11.5px] leading-5 text-muted/85">
          {paste.preview}
        </pre>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted/70">
          <Pin className="size-3" />
          内容已隐藏，打开后查看
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Avatar name={paste.owner.display_name} size="sm" />
        <span className="truncate text-[11px] text-muted">{paste.owner.display_name}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted/70">
          {paste.expires_at ? <span>{paste.expired ? "已过期" : "限时"}</span> : null}
          <span>{paste.views} 次查看</span>
        </span>
      </div>
    </Link>
  );
}
