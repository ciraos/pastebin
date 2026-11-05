"use client";

import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import { ChevronDown, Loader2, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "disabled:opacity-50 disabled:pointer-events-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-contrast shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(0,0,0,0.3)] hover:brightness-110 active:brightness-95",
  secondary:
    "border border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-2/80 active:scale-[0.99]",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  outline: "border border-line bg-transparent text-ink hover:border-accent/40 hover:text-accent",
  danger: "border border-danger/25 bg-danger/10 text-danger hover:bg-danger/20",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-9 w-9 p-0",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  prefetch,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
    >
      {children}
    </Link>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function Input({ className, label, hint, error, leading, trailing, id, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-xs font-medium tracking-wide text-muted">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">{leading}</span>
        ) : null}
        <input
          id={inputId}
          className={cn(
            "h-10 w-full rounded-lg border border-line bg-canvas/60 px-3 text-sm text-ink transition",
            "placeholder:text-muted/55 hover:border-line-strong",
            "focus:border-accent/55 focus:bg-canvas focus:outline-none focus:ring-4 focus:ring-accent/10",
            leading ? "pl-9" : null,
            trailing ? "pr-10" : null,
            error ? "border-danger/60 focus:border-danger focus:ring-danger/10" : null,
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {trailing ? <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span> : null}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted/80">{hint}</p> : null}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string | null;
};

export function Textarea({ className, label, hint, error, id, ...props }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-xs font-medium tracking-wide text-muted">
          {label}
        </label>
      ) : null}
      <textarea
        id={inputId}
        className={cn(
          "w-full rounded-lg border border-line bg-canvas/60 px-3 py-2.5 text-sm text-ink transition",
          "placeholder:text-muted/55 hover:border-line-strong",
          "focus:border-accent/55 focus:bg-canvas focus:outline-none focus:ring-4 focus:ring-accent/10",
          error ? "border-danger/60 focus:border-danger" : null,
          className,
        )}
        {...props}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted/80">{hint}</p> : null}
    </div>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
};

export function Select({ className, label, hint, id, children, ...props }: SelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-xs font-medium tracking-wide text-muted">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={inputId}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border border-line bg-canvas/60 pl-3 pr-9 text-sm text-ink transition",
            "hover:border-line-strong focus:border-accent/55 focus:outline-none focus:ring-4 focus:ring-accent/10",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </div>
      {hint ? <p className="text-xs text-muted/80">{hint}</p> : null}
    </div>
  );
}

export type BadgeTone = "accent" | "neutral" | "warn" | "danger" | "info";

const badgeTones: Record<BadgeTone, string> = {
  accent: "border-accent/25 bg-accent/10 text-accent",
  neutral: "border-line bg-surface-2 text-muted",
  warn: "border-warn/25 bg-warn/10 text-warn",
  danger: "border-danger/25 bg-danger/10 text-danger",
  info: "border-info/25 bg-info/10 text-info",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium leading-none",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-accent", className)} aria-label="加载中" />;
}

export function PageLoader({ label = "加载中" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted">
      <Spinner className="size-6" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? <div className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-muted">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? <p className="mx-auto max-w-sm text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_120ms_ease-out]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl shadow-black/40 sm:rounded-2xl",
          "animate-[popIn_150ms_ease-out]",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {description ? <p className="text-xs leading-5 text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted transition hover:bg-surface-2 hover:text-ink"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas/40 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-50")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked ? "border-accent/40 bg-accent" : "border-line-strong bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[3px]",
          )}
        />
      </button>
      <span className="space-y-0.5">
        <span className="block text-xs font-medium text-ink">{label}</span>
        {description ? <span className="block text-[11px] leading-4 text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}

const avatarPalette = [
  "from-teal-400/80 to-emerald-500/80",
  "from-sky-400/80 to-indigo-500/80",
  "from-fuchsia-400/80 to-violet-500/80",
  "from-amber-400/80 to-orange-500/80",
  "from-rose-400/80 to-pink-500/80",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) % 997;
  const palette = avatarPalette[hash % avatarPalette.length];
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-[11px]", lg: "size-10 text-sm" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-black/80 ring-1 ring-white/10",
        palette,
        sizes[size],
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
