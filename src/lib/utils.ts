import type { PasteKind, Visibility } from "./types";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return "刚刚";
}

export function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return "永不过期";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "永不过期";
  if (date.getTime() <= Date.now()) return "已过期";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} 分钟后过期`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时后过期`;
  return `${Math.round(seconds / 86400)} 天后过期`;
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return Array.from(trimmed).slice(0, 2).join("").toUpperCase();
}

export const VISIBILITY_META: Record<
  Visibility,
  { label: string; short: string; description: string; tone: "accent" | "neutral" | "warn" }
> = {
  public: {
    label: "公开",
    short: "公开",
    description: "出现在「最近公开」列表中，任何人可读",
    tone: "accent",
  },
  unlisted: {
    label: "仅链接",
    short: "仅链接",
    description: "不出现在列表里，拿到链接的人可以查看",
    tone: "neutral",
  },
  private: {
    label: "私密",
    short: "私密",
    description: "只有你自己能查看，适合内部资料",
    tone: "warn",
  },
};

export const KIND_META: Record<PasteKind, { label: string; tone: "info" | "danger" | "warn" | "neutral" }> = {
  code: { label: "代码", tone: "info" },
  error: { label: "报错", tone: "danger" },
  log: { label: "日志", tone: "warn" },
  text: { label: "文本", tone: "neutral" },
};

export const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "text", label: "纯文本" },
  { value: "log", label: "日志 / 控制台" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "tsx", label: "TSX / JSX" },
  { value: "python", label: "Python" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash / Shell" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "yaml", label: "YAML" },
  { value: "java", label: "Java" },
  { value: "kotlin", label: "Kotlin" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "diff", label: "Diff" },
  { value: "markdown", label: "Markdown" },
];

export function languageLabel(value: string): string {
  return LANGUAGES.find((item) => item.value === value)?.label ?? value.toUpperCase();
}

export function detectLanguage(code: string): string {
  const sample = code.slice(0, 4000);
  if (/Traceback \(most recent call last\)/.test(sample) || /^\s*File ".*", line \d+/m.test(sample)) {
    return "python";
  }
  if (/^\s*at .+\(.+:\d+:\d+\)/m.test(sample) || /node:internal/.test(sample)) return "javascript";
  if (/panic: .+\n\ngoroutine \d+/.test(sample)) return "go";
  if (/Exception in thread "main"|^\s*at [\w.$]+\([\w.]+\.java:\d+\)/m.test(sample)) return "java";
  if (/^\s*Caused by: /m.test(sample) && /^\s*at [\w.$]+\(/m.test(sample)) return "java";
  if (/^\s*thread '.*' panicked at/m.test(sample)) return "rust";
  if (/^\s*<\?php/m.test(sample)) return "php";
  if (/^\s*<!DOCTYPE html>|^\s*<html[\s>]/im.test(sample)) return "html";
  if (/^\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*$/.test(sample) && /"\s*:/.test(sample)) return "json";
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/im.test(sample)) return "sql";
  if (/^\s*(def |class |import |from .+ import )/m.test(sample)) return "python";
  if (/^\s*(function |const |let |var |import .+ from |export )/m.test(sample)) return "javascript";
  if (/^\s*#include\s*</m.test(sample)) return "cpp";
  if (/^\s*package main\b/m.test(sample)) return "go";
  if (/^\s*(fn main|use std::|pub fn )/m.test(sample)) return "rust";
  return "text";
}

export function extensionFor(language: string): string {
  const map: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    tsx: "tsx",
    python: "py",
    bash: "sh",
    json: "json",
    yaml: "yml",
    html: "html",
    css: "css",
    sql: "sql",
    java: "java",
    kotlin: "kt",
    go: "go",
    rust: "rs",
    c: "c",
    cpp: "cpp",
    csharp: "cs",
    php: "php",
    ruby: "rb",
    swift: "swift",
    dockerfile: "dockerfile",
    diff: "diff",
    markdown: "md",
    log: "log",
  };
  return map[language] ?? "txt";
}
