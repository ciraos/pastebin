import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-muted">
        <FileQuestion className="size-5" />
      </div>
      <div className="space-y-2">
        <p className="font-mono text-xs text-muted">404</p>
        <h1 className="text-xl font-semibold tracking-tight text-ink">页面不存在</h1>
        <p className="text-sm leading-6 text-muted">你访问的地址可能已经失效，或者链接输入有误。</p>
      </div>
      <div className="flex gap-2">
        <LinkButton href="/" size="sm">
          返回首页
        </LinkButton>
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center rounded-lg px-3 text-xs text-muted transition hover:text-ink"
        >
          我的粘贴
        </Link>
      </div>
    </div>
  );
}
