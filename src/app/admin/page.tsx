"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  FileCode2,
  Eye,
  Pencil,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { RequireAuth } from "@/components/require-auth";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatCard } from "@/components/stat-card";
import { TimeAgo } from "@/components/time-ago";
import { Avatar, Badge, Button, EmptyState, Input, Modal, PageLoader, Select, Switch } from "@/components/ui";
import type { AdminOverview, SiteSettings, User } from "@/lib/types";
import { formatBytes, formatNumber } from "@/lib/utils";

export default function AdminPage() {
  return (
    <RequireAuth admin>
      <AdminContent />
    </RequireAuth>
  );
}

function AdminContent() {
  const { user, refresh: refreshAuth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [siteName, setSiteName] = useState("");
  const [icpNumber, setIcpNumber] = useState("");
  const [policeNumber, setPoliceNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"member" | "admin">("member");
  const [editDisabled, setEditDisabled] = useState(false);
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api<{ items: User[] }>("/admin/users"),
      api<AdminOverview>("/admin/overview"),
      api<{ settings: SiteSettings }>("/admin/settings"),
    ])
      .then(([userData, overviewData, settingsData]) => {
        if (!active) return;
        setUsers(userData.items);
        setOverview(overviewData);
        setSiteName(settingsData.settings.site_name);
        setIcpNumber(settingsData.settings.icp_number);
        setPoliceNumber(settingsData.settings.police_number);
        setAvatarUrl(settingsData.settings.avatar_url);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function openCreate() {
    setNewEmail("");
    setNewName("");
    setNewPassword("");
    setNewRole("member");
    setFormError(null);
    setCreateOpen(true);
  }

  function openEdit(target: User) {
    setEditing(target);
    setEditName(target.display_name);
    setEditRole(target.role);
    setEditDisabled(Boolean(target.disabled));
    setEditPassword("");
    setFormError(null);
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (newPassword.length < 8) {
      setFormError("密码至少需要 8 位字符");
      return;
    }
    setSubmitting(true);
    try {
      await api("/admin/users", {
        method: "POST",
        body: {
          email: newEmail.trim(),
          display_name: newName.trim(),
          password: newPassword,
          role: newRole,
        },
      });
      toast("成员账号已创建");
      setCreateOpen(false);
      reload();
    } catch (createError) {
      setFormError(errorMessage(createError));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || submitting) return;
    setFormError(null);
    if (editPassword && editPassword.length < 8) {
      setFormError("新密码至少需要 8 位字符");
      return;
    }
    const body: Record<string, unknown> = {
      display_name: editName.trim(),
      role: editRole,
      disabled: editDisabled,
    };
    if (editPassword) body.password = editPassword;
    if (editing.id === user?.id) {
      delete body.role;
      delete body.disabled;
    }
    setSubmitting(true);
    try {
      await api(`/admin/users/${editing.id}`, { method: "PATCH", body });
      toast("用户信息已更新");
      setEditing(null);
      reload();
      if (editing.id === user?.id) void refreshAuth();
    } catch (saveError) {
      setFormError(errorMessage(saveError));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeUser() {
    if (!deleting) return;
    setRemoveLoading(true);
    try {
      await api(`/admin/users/${deleting.id}`, { method: "DELETE" });
      toast(`已删除 ${deleting.display_name}`);
      setDeleting(null);
      reload();
    } catch (deleteError) {
      toast(errorMessage(deleteError), "error");
    } finally {
      setRemoveLoading(false);
    }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (savingSettings) return;
    setSettingsError(null);
    setSavingSettings(true);
    try {
      const data = await api<{ settings: SiteSettings }>("/admin/settings", {
        method: "PATCH",
        body: {
          site_name: siteName.trim(),
          icp_number: icpNumber.trim(),
          police_number: policeNumber.trim(),
        },
      });
      setSiteName(data.settings.site_name);
      setIcpNumber(data.settings.icp_number);
      setPoliceNumber(data.settings.police_number);
      setAvatarUrl(data.settings.avatar_url);
      toast("站点设置已更新");
      // Re-render the cached layout so the header/footer pick up the new values.
      router.refresh();
    } catch (saveError) {
      setSettingsError(errorMessage(saveError));
    } finally {
      setSavingSettings(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (avatarSaving) return;
    setAvatarSaving(true);
    setSettingsError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api<{ avatar_url: string | null }>("/admin/settings/avatar", {
        method: "POST",
        body: form,
      });
      setAvatarUrl(data.avatar_url);
      toast("站点头像已更新");
      router.refresh();
    } catch (uploadError) {
      setSettingsError(errorMessage(uploadError));
    } finally {
      setAvatarSaving(false);
    }
  }

  async function removeAvatar() {
    if (avatarSaving) return;
    setAvatarSaving(true);
    setSettingsError(null);
    try {
      const data = await api<{ avatar_url: string | null }>("/admin/settings/avatar", { method: "DELETE" });
      setAvatarUrl(data.avatar_url);
      toast("已移除站点头像");
      router.refresh();
    } catch (removeError) {
      setSettingsError(errorMessage(removeError));
    } finally {
      setAvatarSaving(false);
    }
  }

  if (loading && users.length === 0) return <PageLoader label="正在加载成员…" />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">用户管理</h1>
            <Badge tone="accent">
              <Shield className="size-3" />
              管理员
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">创建成员账号、调整角色，或禁用不再使用的账号。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setRefreshing(true); reload(); }}>
            <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
            刷新
          </Button>
          <Button size="sm" onClick={openCreate}>
            <UserPlus className="size-3.5" />
            添加成员
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="成员"
          value={overview ? formatNumber(overview.users) : "—"}
          hint={overview?.disabled_users ? `${overview.disabled_users} 个已禁用` : "全部可正常使用"}
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="粘贴总数"
          value={overview ? formatNumber(overview.pastes) : "—"}
          hint={overview ? `${overview.public_pastes} 条公开` : undefined}
          icon={<FileCode2 className="size-4" />}
        />
        <StatCard
          label="累计查看"
          value={overview ? formatNumber(overview.views) : "—"}
          icon={<Eye className="size-4" />}
        />
        <StatCard
          label="数据库占用"
          value={overview ? formatBytes(overview.storage_bytes) : "—"}
          hint={overview ? `${overview.protected_pastes} 条设置密码` : undefined}
          icon={<Database className="size-4" />}
          tone="accent"
        />
      </div>

      <form onSubmit={saveSettings} className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-xs font-semibold tracking-wide text-ink">站点设置</h2>
          <span className="text-[11px] text-muted">留空则不显示</span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <Input
            label="站点名称"
            value={siteName}
            onChange={(event) => setSiteName(event.target.value)}
            placeholder="Pastebin"
            maxLength={40}
            hint="显示在浏览器标题与页眉"
          />
          <Input
            label="ICP 备案号"
            value={icpNumber}
            onChange={(event) => setIcpNumber(event.target.value)}
            placeholder="京ICP备12345678号-1"
            maxLength={60}
            hint="填了才在页脚展示"
          />
          <Input
            label="公安备案号"
            value={policeNumber}
            onChange={(event) => setPoliceNumber(event.target.value)}
            placeholder="京公网安备 11010502030123号"
            maxLength={60}
            hint="填了才在页脚展示"
          />
        </div>

        <div className="flex flex-col gap-4 border-t border-line px-4 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by /api/site/avatar with immutable caching
              <img
                src={avatarUrl}
                alt="站点头像预览"
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-xl border border-line object-cover"
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-line-strong bg-canvas/40 font-mono text-sm font-bold text-muted">
                &gt;_
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink">站点头像</p>
              <p className="mt-0.5 text-[11px] leading-5 text-muted">
                PNG / JPEG / WebP / GIF，不超过 512 KB；显示在页眉和页脚，留空则用默认的 &gt;_ 标记。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadAvatar(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={avatarSaving}
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUrl ? "更换头像" : "上传头像"}
            </Button>
            {avatarUrl ? (
              <Button type="button" variant="ghost" size="sm" disabled={avatarSaving} onClick={() => void removeAvatar()}>
                移除
              </Button>
            ) : null}
          </div>
        </div>

        {settingsError ? (
          <p className="border-t border-line px-4 py-2 text-xs text-danger">{settingsError}</p>
        ) : null}
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <p className="text-[11px] text-muted/70">站点名称留空时回退到 .env 里的 APP_NAME。</p>
          <Button type="submit" size="sm" loading={savingSettings}>
            保存设置
          </Button>
        </div>
      </form>

      {error ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" onClick={reload}>
            重试
          </Button>
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-xs font-semibold tracking-wide text-ink">全部成员</h2>
          <span className="text-[11px] text-muted">{users.length} 人</span>
        </div>

        {users.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={<Users className="size-5" />} title="还没有成员" description="添加第一个成员，把链接分享给他们。" />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {users.map((member) => {
                const isSelf = member.id === user?.id;
                return (
                  <li key={member.id} className="flex items-start gap-3 px-4 py-3">
                    <Avatar name={member.display_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-ink">{member.display_name}</span>
                        {isSelf ? <Badge tone="neutral">我</Badge> : null}
                        {member.role === "admin" ? (
                          <Badge tone="accent">
                            <ShieldCheck className="size-3" />
                            管理员
                          </Badge>
                        ) : (
                          <Badge tone="neutral">成员</Badge>
                        )}
                        {member.disabled ? <Badge tone="danger">已禁用</Badge> : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">{member.email}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-muted/80">
                        <span>{member.paste_count ?? 0} 条粘贴</span>
                        <span>
                          最近登录 {member.last_login_at ? <TimeAgo value={member.last_login_at} /> : "从未"}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon" title="编辑" onClick={() => openEdit(member)}>
                        <Pencil className="size-4" />
                      </Button>
                      {!isSelf ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="删除"
                          onClick={() => setDeleting(member)}
                          className="hover:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted/70">
                  <th className="px-4 py-2.5 font-medium">用户</th>
                  <th className="px-4 py-2.5 font-medium">角色</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">粘贴</th>
                  <th className="px-4 py-2.5 font-medium">最近登录</th>
                  <th className="px-4 py-2.5 font-medium">加入时间</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((member) => {
                  const isSelf = member.id === user?.id;
                  return (
                    <tr key={member.id} className="transition hover:bg-surface-2/25">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.display_name} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-medium text-ink">{member.display_name}</span>
                              {isSelf ? <Badge tone="neutral">我</Badge> : null}
                            </div>
                            <span className="block max-w-[220px] truncate text-[11px] text-muted">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {member.role === "admin" ? (
                          <Badge tone="accent">
                            <ShieldCheck className="size-3" />
                            管理员
                          </Badge>
                        ) : (
                          <Badge tone="neutral">成员</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {member.disabled ? <Badge tone="danger">已禁用</Badge> : <Badge tone="neutral">正常</Badge>}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted">{member.paste_count ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {member.last_login_at ? <TimeAgo value={member.last_login_at} /> : "从未登录"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        <TimeAgo value={member.created_at} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="编辑" onClick={() => openEdit(member)}>
                            <Pencil className="size-4" />
                          </Button>
                          {!isSelf ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="删除"
                              onClick={() => setDeleting(member)}
                              className="hover:text-danger"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted/60">
        <ShieldCheck className="size-3" />
        发布对所有人开放；编辑、删除与成员管理由管理员统一负责。
      </p>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="添加成员"
        description="成员可以使用邮箱和密码登录，创建自己的粘贴。"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="create-user-form" size="sm" loading={submitting}>
              创建账号
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={createUser} className="space-y-4">
          <Input
            label="邮箱"
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="member@example.com"
            required
            autoFocus
          />
          <Input
            label="昵称"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="可选，默认使用邮箱前缀"
            maxLength={40}
          />
          <Input
            label="初始密码"
            type="text"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="至少 8 位"
            required
            minLength={8}
            hint="请通过安全渠道告知成员，登录后可自行修改。"
          />
          <Select label="角色" value={newRole} onChange={(event) => setNewRole(event.target.value as "member" | "admin")}>
            <option value="member">成员</option>
            <option value="admin">管理员</option>
          </Select>
          {formError ? (
            <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">{formError}</div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="编辑成员"
        description={editing?.email}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button type="submit" form="edit-user-form" size="sm" loading={submitting}>
              保存
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={saveUser} className="space-y-4">
          <Input
            label="昵称"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            required
            maxLength={40}
          />
          <Select
            label="角色"
            value={editRole}
            onChange={(event) => setEditRole(event.target.value as "member" | "admin")}
            disabled={editing?.id === user?.id}
            hint={editing?.id === user?.id ? "不能修改自己的角色" : undefined}
          >
            <option value="member">成员</option>
            <option value="admin">管理员</option>
          </Select>
          <div className="rounded-lg border border-line bg-canvas/40 p-3">
            <Switch
              checked={editDisabled}
              onChange={setEditDisabled}
              label="禁用账号"
              description="禁用后该成员的所有会话会立即失效，无法登录。"
              disabled={editing?.id === user?.id}
            />
          </div>
          {editing?.id !== user?.id ? (
            <Input
              label="重置密码"
              type="text"
              value={editPassword}
              onChange={(event) => setEditPassword(event.target.value)}
              placeholder="留空则不修改"
              minLength={8}
              hint="重置后该成员的所有会话会被注销。"
            />
          ) : null}
          {formError ? (
            <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">{formError}</div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="删除成员账号？"
        description={
          deleting
            ? `${deleting.display_name}（${deleting.email}）的账号和全部 ${deleting.paste_count ?? 0} 条粘贴都会被永久删除。`
            : undefined
        }
        confirmLabel="永久删除"
        loading={removeLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={removeUser}
      />
    </div>
  );
}
