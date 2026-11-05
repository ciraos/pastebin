import { connection } from "next/server";
import { query } from "@/server/db";
import { handler, json } from "@/server/http";

export const GET = handler(async () => {
  await connection();
  await query("SELECT 1");
  return json({ status: "ok", version: "1.0.0" });
});
