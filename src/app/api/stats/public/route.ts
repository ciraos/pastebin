import { connection } from "next/server";
import { one } from "@/server/db";
import { handler, json } from "@/server/http";

export const GET = handler(async () => {
  await connection();
  const row = await one<{ pastes: number; views: number; users: number }>(
    `SELECT (SELECT COUNT(*)::int FROM pastes
             WHERE visibility = 'public' AND (expires_at IS NULL OR expires_at > now())) AS pastes,
            (SELECT COALESCE(SUM(views), 0)::int FROM pastes
             WHERE visibility = 'public' AND (expires_at IS NULL OR expires_at > now())) AS views,
            (SELECT COUNT(*)::int FROM users) AS users`,
  );
  return json({ pastes: row?.pastes ?? 0, views: row?.views ?? 0, users: row?.users ?? 0 });
});
