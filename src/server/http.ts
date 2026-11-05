import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";

export type ErrorBody = { detail: { code: string; message: string } };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Record<string, string>;

  constructor(status: number, code: string, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function fail(status: number, code: string, message: string, headers?: Record<string, string>): ApiError {
  return new ApiError(status, code, message, headers);
}

/** 429 with a standards-compliant Retry-After header. */
export function rateLimited(message: string, retryAfterSeconds: number): ApiError {
  return new ApiError(429, "rate_limited", message, { "Retry-After": String(Math.max(1, retryAfterSeconds)) });
}

export function json<T>(data: T, init?: { status?: number; headers?: Record<string, string> }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: init?.headers });
}

/** Turn a thrown error into the JSON error shape the client already understands. */
export function toResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json<ErrorBody>(
      { detail: { code: error.code, message: error.message } },
      { status: error.status, headers: error.headers },
    );
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json<ErrorBody>(
    { detail: { code: "internal_error", message: "服务器出错了，请稍后再试" } },
    { status: 500 },
  );
}

/** Wrap a handler so every thrown ApiError becomes a proper JSON response. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Framework control-flow errors (prerender aborts, redirect, notFound) must
      // reach Next.js untouched, otherwise `next build` fails to prerender.
      unstable_rethrow(error);
      return toResponse(error);
    }
  };
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw fail(422, "validation_error", "请求体不是合法的 JSON");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw fail(422, "validation_error", "请求体必须是 JSON 对象");
  }
  return raw as Record<string, unknown>;
}

/**
 * Best-effort client IP for rate limiting. The app only ever sees the request
 * as it arrives from whatever proxy is in front of it, so this reads the usual
 * forwarding headers. When none of them is present (a direct connection, or
 * local development without a proxy) every caller shares one bucket, which is
 * worth knowing when throttling behaviour looks surprising.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64) || "unknown";
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim().slice(0, 64) || "unknown";
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp) return cloudflareIp.trim().slice(0, 64) || "unknown";
  return "unknown";
}
