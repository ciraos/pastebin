import type { NextRequest } from "next/server";
import { fail, handler } from "@/server/http";
import { checkAccess, EXTENSIONS, fetchPaste, readPaste, unlockCookieName } from "@/server/pastes";
import { optionalUser } from "@/server/session";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (request: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const viewer = await optionalUser();
  const row = await fetchPaste(id);
  if (!row) throw fail(404, "not_found", "粘贴不存在");
  checkAccess(row, viewer, request.cookies.get(unlockCookieName(id))?.value);
  const paste = await readPaste(row, viewer);

  const extension = EXTENSIONS[paste.language as string] ?? "txt";
  return new Response(paste.content as string, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="${id}.${extension}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
});
