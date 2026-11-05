import { one } from "@/server/db";
import { handler, json } from "@/server/http";
import { currentUser } from "@/server/session";

type MineRow = {
  total: number;
  views: number;
  public: number;
  expiring: number;
  expired: number;
  protected: number;
};

export const GET = handler(async () => {
  const viewer = await currentUser();

  const mine = await one<MineRow>(
    `SELECT COUNT(*)::int AS total,
            COALESCE(SUM(views), 0)::int AS views,
            COALESCE(SUM(CASE WHEN visibility = 'public' THEN 1 ELSE 0 END), 0)::int AS public,
            COALESCE(SUM(CASE WHEN expires_at IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS expiring,
            COALESCE(SUM(CASE WHEN expires_at IS NOT NULL AND expires_at <= now() THEN 1 ELSE 0 END), 0)::int AS expired,
            COALESCE(SUM(CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS protected
     FROM pastes WHERE owner_id = $1`,
    [viewer.id],
  );

  const data: Record<string, unknown> = {
    mine: {
      pastes: mine?.total ?? 0,
      views: mine?.views ?? 0,
      public: mine?.public ?? 0,
      expiring: mine?.expiring ?? 0,
      expired: mine?.expired ?? 0,
      protected: mine?.protected ?? 0,
    },
  };

  if (viewer.role === "admin") {
    const global = await one<{ pastes: number; views: number; users: number }>(
      `SELECT (SELECT COUNT(*)::int FROM pastes) AS pastes,
              (SELECT COALESCE(SUM(views), 0)::int FROM pastes) AS views,
              (SELECT COUNT(*)::int FROM users) AS users`,
    );
    data.global = {
      pastes: global?.pastes ?? 0,
      views: global?.views ?? 0,
      users: global?.users ?? 0,
    };
  }

  return json(data);
});
