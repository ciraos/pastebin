"use client";

import { useMemo, useState } from "react";
import { Code2, WrapText } from "lucide-react";
import { highlightCode } from "@/lib/highlight";
import { cn, formatBytes, languageLabel } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export function CodeBlock({
  code,
  language,
  className,
  maxHeightClass = "max-h-[70vh]",
  showToolbar = true,
  filename,
}: {
  code: string;
  language: string;
  className?: string;
  maxHeightClass?: string;
  showToolbar?: boolean;
  filename?: string;
}) {
  const [wrap, setWrap] = useState(false);
  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);
  const lineCount = useMemo(() => code.split("\n").length, [code]);
  const byteSize = useMemo(() => new TextEncoder().encode(code).length, [code]);
  const numbers = useMemo(() => Array.from({ length: lineCount }, (_, index) => index + 1), [lineCount]);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-[#0a0d12] shadow-lg shadow-black/10", className)}>
      {showToolbar ? (
        <div className="flex h-11 items-center gap-3 border-b border-line/80 bg-surface/60 px-3">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <Code2 className="size-3.5 text-accent/80" />
            {languageLabel(language)}
          </span>
          {filename ? <span className="truncate font-mono text-[11px] text-muted/60">{filename}</span> : null}
          <span className="ml-auto flex items-center gap-2 text-[11px] text-muted/60">
            <span className="hidden sm:inline">{lineCount} 行</span>
            <span className="hidden sm:inline">·</span>
            <span>{formatBytes(byteSize)}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWrap((value) => !value)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition",
                wrap ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
              title={wrap ? "关闭自动换行" : "自动换行"}
            >
              <WrapText className="size-3.5" />
              <span className="hidden sm:inline">换行</span>
            </button>
            <CopyButton value={code} size="sm" variant="ghost" showLabel={false} className="h-7 w-7" />
          </div>
        </div>
      ) : null}

      <div className={cn("overflow-auto", maxHeightClass)}>
        <div className="flex w-max min-w-full">
          {!wrap ? (
            <div className="sticky left-0 z-10 shrink-0 select-none border-r border-line/60 bg-[#0a0d12] px-3 py-4 text-right font-mono text-[12px] leading-6 text-muted/30">
              {numbers.map((number) => (
                <div key={number}>{number}</div>
              ))}
            </div>
          ) : null}
          <pre
            className={cn(
              "flex-1 px-4 py-4 font-mono text-[12.5px] leading-6 text-[#d7e2f0]",
              wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
            )}
          >
            <code
              className={cn("hljs bg-transparent p-0", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </pre>
        </div>
      </div>

      {!showToolbar ? (
        <div className="flex items-center justify-between border-t border-line/70 px-3 py-2 text-[11px] text-muted/60">
          <span>{languageLabel(language)} · {lineCount} 行</span>
          <CopyButton value={code} size="sm" variant="ghost" />
        </div>
      ) : null}
    </div>
  );
}
