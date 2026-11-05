"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, Sparkles, WrapText } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "./ui";

export function CodeEditor({
  value,
  onChange,
  onDropFile,
  onDetectLanguage,
  placeholder = "在这里粘贴代码、报错堆栈或日志…",
  maxBytes,
}: {
  value: string;
  onChange: (value: string) => void;
  onDropFile?: (file: File) => void;
  onDetectLanguage?: () => void;
  placeholder?: string;
  maxBytes: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wrap, setWrap] = useState(false);
  const [dragging, setDragging] = useState(false);

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  const byteSize = useMemo(() => new TextEncoder().encode(value).length, [value]);
  const overLimit = byteSize > maxBytes;

  function syncScroll() {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(next);
      window.requestAnimationFrame(() => {
        target.selectionStart = start + 2;
        target.selectionEnd = start + 2;
      });
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && onDropFile) onDropFile(file);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-[#0a0d12] transition",
        dragging ? "border-accent/70 ring-4 ring-accent/10" : "border-line",
      )}
    >
      <div className="flex h-11 items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-white/40">
          <span className="size-1.5 rounded-full bg-accent/70" />
          editor
        </span>
        <span className="text-[11px] text-white/20">·</span>
        <span className="text-[11px] text-white/40">{lineCount} 行</span>
        <div className="ml-auto flex items-center gap-1">
          {onDetectLanguage ? (
            <button
              type="button"
              onClick={onDetectLanguage}
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-white/45 transition hover:bg-white/5 hover:text-white/80"
              title="根据内容猜测语言"
            >
              <Sparkles className="size-3.5" />
              识别语言
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setWrap((current) => !current)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] transition",
              wrap ? "bg-accent/10 text-accent" : "text-white/45 hover:bg-white/5 hover:text-white/80",
            )}
            title={wrap ? "关闭自动换行" : "自动换行"}
          >
            <WrapText className="size-3.5" />
            <span className="hidden sm:inline">换行</span>
          </button>
          {onDropFile ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-white/45 transition hover:bg-white/5 hover:text-white/80"
                title="导入文本文件"
              >
                <FileUp className="size-3.5" />
                <span className="hidden sm:inline">导入</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.log,.json,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.kt,.c,.cpp,.h,.cs,.php,.rb,.swift,.sql,.sh,.bash,.yml,.yaml,.css,.html,.xml,.md,.diff,.toml,.ini,.env"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onDropFile(file);
                  event.target.value = "";
                }}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="relative flex h-[45vh] min-h-[320px] lg:h-[52vh]">
        {!wrap ? (
          <div
            ref={gutterRef}
            aria-hidden
            className="w-12 shrink-0 select-none overflow-hidden border-r border-white/[0.06] bg-white/[0.015] py-4 text-right font-mono text-[12.5px] leading-6 text-white/20"
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <div key={index} className="pr-3">
                {index + 1}
              </div>
            ))}
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap={wrap ? "soft" : "off"}
          placeholder={placeholder}
          className={cn(
            "h-full flex-1 resize-none bg-transparent px-4 py-4 font-mono text-[12.5px] leading-6 text-[#d7e2f0]",
            "placeholder:text-white/25 focus:outline-none",
            wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
          )}
        />
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px]">
        <span className={overLimit ? "text-rose-400" : "text-white/35"}>
          {formatBytes(byteSize)} / {formatBytes(maxBytes)}
          {overLimit ? " · 超出大小限制" : ""}
        </span>
        <span className="text-white/30">拖入文件可直接导入</span>
      </div>

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#0a0d12]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-accent">
            <FileUp className="size-6" />
            <span className="text-xs font-medium">松手导入文件</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EditorActions({ onClear }: { onClear: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClear}>
      清空
    </Button>
  );
}
