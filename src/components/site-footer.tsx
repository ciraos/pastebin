"use client";

import { useSiteConfig } from "./site-config-provider";

/** Site footer with the optional ICP / 公安备案 numbers configured in the admin backend. */
export function SiteFooter() {
  const { siteName, icpNumber, policeNumber } = useSiteConfig();
  const hasFilings = Boolean(icpNumber || policeNumber);

  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-md border border-accent/25 bg-accent/10 font-mono text-[10px] font-bold text-accent">
              &gt;_
            </span>
            <span className="text-xs text-muted">{siteName} · 代码与报错分享</span>
          </div>
          <p className="text-[11px] text-muted/60">由 Next.js 与 PostgreSQL 驱动 · 数据保存在你自己的服务器</p>
        </div>

        {hasFilings ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted/60">
            {icpNumber ? (
              <a
                href="https://beian.miit.gov.cn"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-accent"
              >
                {icpNumber}
              </a>
            ) : null}
            {policeNumber ? (
              <a
                href="https://beian.mps.gov.cn"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 transition hover:text-accent"
              >
                <ShieldIcon />
                {policeNumber}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
    </svg>
  );
}
