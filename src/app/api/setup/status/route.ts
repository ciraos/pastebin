import { connection } from "next/server";
import { one } from "@/server/db";
import { handler, json } from "@/server/http";

export const GET = handler(async () => {
  await connection();
  const row = await one<{ count: number }>("SELECT COUNT(*)::int AS count FROM users");
  return json({ setup_required: (row?.count ?? 0) === 0 });
});
