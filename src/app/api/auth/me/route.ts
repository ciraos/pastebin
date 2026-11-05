import { one } from "@/server/db";
import { handler, json, readJson } from "@/server/http";
import { serializeUser } from "@/server/serialize";
import { currentUser, type SessionUser } from "@/server/session";
import { text } from "@/server/validate";

export const GET = handler(async () => {
  const user = await currentUser();
  return json({ user: serializeUser(user) });
});

export const PATCH = handler(async (request: Request) => {
  const user = await currentUser();
  const payload = await readJson(request);
  const displayName = text(payload.display_name, "display_name", { min: 1, max: 40 });

  const updated = await one<SessionUser>(
    `UPDATE users SET display_name = $1 WHERE id = $2
     RETURNING id, email, display_name, role, disabled, created_at, last_login_at`,
    [displayName, user.id],
  );
  return json({ user: serializeUser(updated!) });
});
