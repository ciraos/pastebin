"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui";

export function Pagination({
  page,
  hasMore,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  hasMore: boolean;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-xs text-muted">
        第 {page} / {pages} 页 · 共 {total} 条
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="size-3.5" />
          上一页
        </Button>
        <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => onChange(page + 1)}>
          下一页
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
