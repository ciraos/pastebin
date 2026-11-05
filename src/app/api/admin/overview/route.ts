import { one } from "@/server/db";
import { handler, json } from "@/server/http";
import { requireAdmin } from "@/server/session";

type Counts = {
  users: number;
  disabled: number;
  pastes: number;
  views: number;
  public_pastes: number;
  protected: number;
  storage: number;
};

export const GET = handler(async () => {
  await requireAdmin();
  const row = await one<Counts>(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM users WHERE disabled) AS disabled,
      (SELECT COUNT(*)::int FROM pastes) AS pastes,
      (SELECT COALESCE(SUM(views), 0)::int FROM pastes) AS views,
      (SELECT COUNT(*)::int FROM pastes WHERE visibility = 'public') AS public_pastes,
      (SELECT COUNT(*)::int FROM pastes WHERE password_hash IS NOT NULL) AS protected,
      (SELECT COALESCE(SUM(octet_length(content)), 0)::bigint FROM pastes) AS storage
  `);

  return json({
    users: row?.users ?? 0,
    disabled_users: row?.disabled ?? 0,
    pastes: row?.pastes ?? 0,
    views: row?.views ?? 0,
    public_pastes: row?.public_pastes ?? 0,
    protected_pastes: row?.protected ?? 0,
    storage_bytes: Number(row?.storage ?? 0),
  });
});
