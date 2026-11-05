"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { PasteForm } from "@/components/paste-form";
import { RequireAuth } from "@/components/require-auth";
import { Button, EmptyState, PageLoader } from "@/components/ui";
import type { PasteDetail } from "@/lib/types";

export function EditPasteView() {
  return (
    <RequireAuth>
      <EditPasteContent />
    </RequireAuth>
  );
}

function EditPasteContent() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [paste, setPaste] = useState<PasteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<{ paste: PasteDetail }>(`/pastes/${params.id}`)
      .then((data) => {
        if (!active) return;
        if (!data.paste.can_edit) {
          setForbidden(true);
          return;
        }
        setPaste(data.paste);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  if (loading) return <PageLoader label="正在加载粘贴…" />;

  if (forbidden) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-20">
        <EmptyState
          icon={<Lock className="size-5" />}
          title="只有管理员可以编辑"
          description="粘贴发布后由管理员统一维护，你可以查看或复制链接，但无法修改内容与设置。"
          action={
            <Link href={`/p/${params.id}`}>
              <Button variant="secondary" size="sm">
                <ArrowLeft className="size-3.5" />
                返回粘贴
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (error || !paste || !user) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-20">
        <EmptyState
          icon={<Lock className="size-5" />}
          title="无法编辑这条粘贴"
          description={error ?? "粘贴不存在，或者链接已经失效。"}
          action={
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">
                返回我的粘贴
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return <PasteForm mode="edit" initial={paste} user={user} />;
}
