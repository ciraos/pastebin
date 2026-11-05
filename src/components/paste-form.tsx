"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bug,
  Check,
  Code2,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Info,
  Link2,
  Lock,
  ScrollText,
  ShieldQuestion,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Badge, Button, Input, LinkButton, Select, Switch } from "@/components/ui";
import { CodeEditor } from "@/components/code-editor";
import type { PasteDetail, PasteKind, User, Visibility } from "@/lib/types";
import { cn, detectLanguage, formatDate, languageLabel, LANGUAGES } from "@/lib/utils";

const DRAFT_KEY = "pastebin:draft:v1";
const MAX_BYTES = 1024 * 1024;

const EXPIRY_LABELS: Record<string, string> = {
  "3600": "1 小时",
  "86400": "1 天",
  "604800": "7 天",
  "2592000": "30 天",
  "7776000": "90 天",
};

type Props = {
  mode: "create" | "edit";
  initial?: PasteDetail;
  /** null when the visitor publishes anonymously. */
  user: User | null;
};

type Draft = {
  title: string;
  content: string;
  language: string;
  kind: PasteKind;
  visibility: Visibility;
  expiresChoice: string;
  burnAfterRead: boolean;
};

const KIND_OPTIONS: Array<{ value: PasteKind; label: string; icon: React.ReactNode }> = [
  { value: "code", label: "代码", icon: <Code2 className="size-3.5" /> },
  { value: "error", label: "报错", icon: <Bug className="size-3.5" /> },
  { value: "log", label: "日志", icon: <ScrollText className="size-3.5" /> },
  { value: "text", label: "文本", icon: <FileText className="size-3.5" /> },
];

const VISIBILITY_OPTIONS: Array<{
  value: Visibility;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  { value: "unlisted", label: "仅链接", description: "拿到链接的人可查看", icon: <Link2 className="size-4" /> },
  { value: "public", label: "公开", description: "会出现在最近公开", icon: <Globe2 className="size-4" /> },
  { value: "private", label: "私密", description: "只有自己可见", icon: <Lock className="size-4" /> },
];

const EXTENSION_LANGUAGE: Record<string, string> = {  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "tsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  json: "json",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  html: "html",
  htm: "html",
  css: "css",
  yml: "yaml",
  yaml: "yaml",
  java: "java",
  kt: "kotlin",
  go: "go",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  swift: "swift",
  md: "markdown",
  log: "log",
  txt: "text",
  ini: "text",
  toml: "text",
};

export function PasteForm({ mode, initial, user }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "text");
  const [kind, setKind] = useState<PasteKind>(initial?.kind ?? "code");
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? "unlisted");
  const [expiresChoice, setExpiresChoice] = useState<string>(mode === "edit" ? "keep" : "");
  const [burnAfterRead, setBurnAfterRead] = useState(initial?.burn_after_read ?? false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [removePassword, setRemovePassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const editing = mode === "edit";
  // Anonymous visitors may publish, but a private paste would be visible to nobody.
  const visibilityOptions = user ? VISIBILITY_OPTIONS : VISIBILITY_OPTIONS.filter((option) => option.value !== "private");
  const backHref = editing && initial ? `/p/${initial.id}` : user ? "/dashboard" : "/";
  const backLabel = editing ? "返回粘贴" : user ? "返回我的粘贴" : "返回首页";
  const pasteId = initial?.id;
  const byteSize = new TextEncoder().encode(content).length;
  const hasExistingPassword = Boolean(initial?.has_password);

  useEffect(() => {
    if (editing) {
      setDraftReady(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<Draft>;
        if (draft.content) {
          setTitle(draft.title ?? "");
          setContent(draft.content);
          setLanguage(draft.language ?? "text");
          setKind(draft.kind ?? "code");
          setVisibility(draft.visibility ?? "unlisted");
          setExpiresChoice(draft.expiresChoice ?? "");
          setBurnAfterRead(Boolean(draft.burnAfterRead));
          setDraftRestored(true);
        }
      }
    } catch {
      // ignore broken drafts
    }
    setDraftReady(true);
  }, [editing]);

  useEffect(() => {
    if (editing || !draftReady) return;
    const timer = window.setTimeout(() => {
      try {
        const draft: Draft = { title, content, language, kind, visibility, expiresChoice, burnAfterRead };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // storage might be full or unavailable
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [editing, draftReady, title, content, language, kind, visibility, expiresChoice, burnAfterRead]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setDraftRestored(false);
  }

  function detect() {
    if (!content.trim()) {
      toast("先贴入一些内容，才能识别语言", "info");
      return;
    }
    const detected = detectLanguage(content);
    setLanguage(detected);
    toast(`已识别为 ${languageLabel(detected)}`, "info");
  }

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast("文件超过 1 MB，请拆分后再上传", "error");
      return;
    }
    const text = await file.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES) {
      toast("文件超过 1 MB，请拆分后再上传", "error");
      return;
    }
    setContent(text);
    setFileName(file.name);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const detected = EXTENSION_LANGUAGE[extension] ?? detectLanguage(text);
    setLanguage(detected);
    toast(`已导入 ${file.name}`);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (!content.trim()) {
      setError("内容不能为空");
      return;
    }
    if (byteSize > MAX_BYTES) {
      setError("内容超过 1 MB 上限");
      return;
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      content,
      language,
      kind,
      visibility,
      burn_after_read: burnAfterRead,
    };

    if (!editing || expiresChoice !== "keep") {
      payload.expires_in = expiresChoice ? Number(expiresChoice) : null;
    }

    if (editing) {
      if (removePassword) payload.password = null;
      else if (password.trim()) payload.password = password.trim();
    } else if (password.trim()) {
      payload.password = password.trim();
    }

    setSubmitting(true);
    try {
      const data = editing
        ? await api<{ paste: PasteDetail }>(`/pastes/${pasteId}`, { method: "PATCH", body: payload })
        : await api<{ paste: PasteDetail }>("/pastes", { method: "POST", body: payload });
      if (!editing) clearDraft();
      toast(editing ? "修改已保存" : "链接已生成，可以分享了");
      router.push(`/p/${data.paste.id}`);
      router.refresh();
    } catch (submitError) {
      setError(errorMessage(submitError));
      // The error sits below the editor, often off-screen on long forms.
      requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    } finally {
      setSubmitting(false);
    }
  }

  const expiryHint =
    mode === "edit" && expiresChoice === "keep"
      ? initial?.expires_at
        ? `当前到期时间：${formatDate(initial.expires_at, true)}`
        : "当前设置为永不过期"
      : undefined;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-accent"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            {editing ? "编辑粘贴" : "新建粘贴"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {editing ? "修改后会保留原来的链接和访问量。" : "粘贴代码、报错或日志，生成一条可分享的链接。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href={backHref} variant="ghost" size="sm">
            取消
          </LinkButton>
          <Button type="submit" size="sm" loading={submitting} className="hidden sm:inline-flex">
            {editing ? "保存修改" : "创建粘贴"}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {!user && !editing ? (
        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-info/25 bg-info/5 px-3 py-2.5">
          <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
          <p className="text-[11px] leading-5 text-muted">
            未登录也能发布，链接生成后即可分享；编辑与删除由管理员统一管理，发布后你自己无法修改。
          </p>
        </div>
      ) : null}

      {draftRestored ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-info/25 bg-info/5 px-3 py-2">
          <p className="text-xs text-info">已恢复上次未提交的草稿。</p>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setTitle("");
              setContent("");
            }}
            className="inline-flex items-center gap-1 text-[11px] text-info/80 underline-offset-2 hover:underline"
          >
            <Trash2 className="size-3" />
            丢弃草稿
          </button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0 space-y-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="未命名粘贴 · 给这段内容起个名字（可选）"
            maxLength={160}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-medium text-ink transition placeholder:text-muted/50 hover:border-line-strong focus:border-accent/50 focus:outline-none focus:ring-4 focus:ring-accent/10"
          />

          <CodeEditor
            value={content}
            onChange={(value) => {
              setContent(value);
              if (fileName) setFileName(null);
            }}
            onDropFile={handleFile}
            onDetectLanguage={detect}
            maxBytes={MAX_BYTES}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted/70">
            <span>
              {content ? `${content.split("\n").length} 行 · ${(byteSize / 1024).toFixed(1)} KB` : "支持拖入 .log / .json / .py 等文本文件"}
              {fileName ? ` · 已导入 ${fileName}` : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3" />
              识别语言后可自动高亮
            </span>
          </div>

          {error ? (
            <div
              ref={errorRef}
              className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs leading-5 text-danger"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 sm:hidden">
            <Button type="submit" loading={submitting}>
              {editing ? "保存修改" : "创建粘贴"}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-xs font-semibold tracking-wide text-ink">发布设置</h2>
            </div>

            <div className="space-y-5 p-4">
              <fieldset className="space-y-2">
                <legend className="mb-2 block text-[11px] font-medium text-muted">谁能查看</legend>
                <div className="space-y-1.5">
                  {visibilityOptions.map((option) => {
                    const selected = visibility === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setVisibility(option.value)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
                          selected
                            ? "border-accent/40 bg-accent/[0.06]"
                            : "border-line bg-canvas/40 hover:border-line-strong",
                        )}
                      >
                        <span className={cn("shrink-0", selected ? "text-accent" : "text-muted")}>{option.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-ink">{option.label}</span>
                          <span className="block text-[10px] text-muted">{option.description}</span>
                        </span>
                        {selected ? <Check className="size-3.5 shrink-0 text-accent" /> : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-2">
                <span className="block text-[11px] font-medium text-muted">类型</span>
                <div className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-canvas/40 p-1">
                  {KIND_OPTIONS.map((option) => {
                    const selected = kind === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setKind(option.value)}
                        className={cn(
                          "flex h-8 items-center justify-center gap-1 rounded-md text-[11px] transition",
                          selected ? "bg-surface-2 text-ink shadow-sm" : "text-muted hover:text-ink",
                        )}
                        title={option.label}
                      >
                        {option.icon}
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Select label="语法高亮" value={language} onChange={(event) => setLanguage(event.target.value)}>
                {LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <div>
                <Select
                  label="有效期"
                  value={expiresChoice}
                  onChange={(event) => setExpiresChoice(event.target.value)}
                  hint={expiryHint}
                >
                  {editing ? <option value="keep">保持当前设置</option> : null}
                  <option value="">永不过期</option>
                  <option value="3600">1 小时</option>
                  <option value="86400">1 天</option>
                  <option value="604800">7 天</option>
                  <option value="2592000">30 天</option>
                  <option value="7776000">90 天</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Input
                  label="访问密码"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (event.target.value) setRemovePassword(false);
                  }}
                  placeholder={editing && hasExistingPassword ? "留空则保持原密码" : "可选，设置后需要密码访问"}
                  autoComplete="new-password"
                  maxLength={128}
                  disabled={removePassword}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="rounded p-1 text-muted transition hover:text-ink"
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
                {editing && hasExistingPassword ? (
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      checked={removePassword}
                      onChange={(event) => {
                        setRemovePassword(event.target.checked);
                        if (event.target.checked) setPassword("");
                      }}
                      className="size-3.5 accent-teal-400"
                    />
                    移除当前密码
                  </label>
                ) : (
                  <p className="text-[10px] leading-4 text-muted/70">密码只保存哈希，无法找回；可随时在编辑页移除。</p>
                )}
              </div>

              <div className="border-t border-line pt-4">
                <Switch
                  checked={burnAfterRead}
                  onChange={setBurnAfterRead}
                  label="阅后即焚"
                  description="除你之外，第一位打开者读取后自动删除。"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">即将创建</span>
              <Badge tone="neutral">{languageLabel(language)}</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              {visibilityOptions.find((option) => option.value === visibility)?.description}
              {expiresChoice && expiresChoice !== "keep"
                ? ` · ${EXPIRY_LABELS[expiresChoice] ?? ""}后过期`
                : ""}
              {burnAfterRead ? " · 阅后即焚" : ""}
            </p>
            <Button type="submit" size="lg" className="mt-4 w-full" loading={submitting}>
              {editing ? "保存修改" : "创建并获取链接"}
              <ArrowRight className="size-4" />
            </Button>
            <p className="mt-3 text-center text-[10px] text-muted/60">
              按 <kbd className="rounded border border-line px-1">Ctrl</kbd> +{" "}
              <kbd className="rounded border border-line px-1">Enter</kbd> 快速提交
            </p>
            <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-muted/60">
              <ShieldQuestion className="size-3" />
              创建者：{user?.display_name ?? "匿名访客"}
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
