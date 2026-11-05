import { config } from "./config";
import { fail } from "./http";

type Field = string;

function validationError(field: Field, message: string): never {
  throw fail(422, "validation_error", field ? `${field}: ${message}` : message);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANGUAGE_RE = /^[a-zA-Z0-9+#._-]{1,32}$/;

export function requireObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw fail(422, "validation_error", "请求体必须是 JSON 对象");
  }
  return value as Record<string, unknown>;
}

export function email(value: unknown, field = "email"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) validationError(field, "请填写邮箱");
  if (!EMAIL_RE.test(raw) || raw.length > 254) validationError(field, "邮箱格式不正确");
  return raw;
}

export function text(
  value: unknown,
  field: Field,
  { min = 0, max = 200, trim = true }: { min?: number; max?: number; trim?: boolean } = {},
): string {
  if (typeof value !== "string") validationError(field, "必须是字符串");
  const out = trim ? value.trim() : value;
  if (out.length < min) validationError(field, min === 1 ? "不能为空" : `至少需要 ${min} 个字符`);
  if (out.length > max) validationError(field, `最多 ${max} 个字符`);
  return out;
}

export function optionalText(
  value: unknown,
  field: Field,
  options: { min?: number; max?: number; trim?: boolean } = {},
): string | null {
  if (value === undefined || value === null) return null;
  return text(value, field, options);
}

export function boolean(value: unknown, field: Field, fallback?: boolean): boolean {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    validationError(field, "必须是布尔值");
  }
  if (typeof value !== "boolean") validationError(field, "必须是布尔值");
  return value;
}

export function optionalBoolean(value: unknown, field: Field): boolean | null {
  if (value === undefined || value === null) return null;
  return boolean(value, field);
}

export function integer(
  value: unknown,
  field: Field,
  { min, max }: { min: number; max: number },
): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed)) validationError(field, "必须是整数");
  if (parsed < min || parsed > max) validationError(field, `必须在 ${min} 到 ${max} 之间`);
  return parsed;
}

export function optionalInteger(
  value: unknown,
  field: Field,
  range: { min: number; max: number },
): number | null {
  if (value === undefined || value === null) return null;
  return integer(value, field, range);
}

export function oneOf<T extends string>(value: unknown, field: Field, allowed: readonly T[], fallback?: T): T {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    validationError(field, `必须是 ${allowed.join(" / ")} 之一`);
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    validationError(field, `必须是 ${allowed.join(" / ")} 之一`);
  }
  return value as T;
}

export function language(value: unknown, field = "language", fallback?: string): string {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    validationError(field, "不支持的语法标记");
  }
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!LANGUAGE_RE.test(raw)) validationError(field, "不支持的语法标记");
  return raw;
}

export function content(value: unknown, field = "content", { required = true } = {}): string {
  if (typeof value !== "string") validationError(field, required ? "不能为空" : "必须是字符串");
  if (required && value.length === 0) validationError(field, "不能为空");
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > config.maxPasteBytes) {
    validationError(field, `内容超过 ${Math.floor(config.maxPasteBytes / 1024)} KB 上限`);
  }
  return value;
}

export function passwordValue(value: unknown, field = "password", { min = 8 } = {}): string {
  return text(value, field, { min, max: 200 });
}

export function passwordHashSource(value: unknown, field = "password"): string | null {
  if (value === undefined || value === null) return null;
  const raw = typeof value === "string" ? value.trim() : null;
  if (raw === null) validationError(field, "必须是字符串");
  if (raw.length > 128) validationError(field, "最多 128 个字符");
  return raw || null;
}
