import { connection } from "next/server";
import { fail, handler } from "@/server/http";
import { readAvatar } from "@/server/settings";

/**
 * Public site avatar. The URL carries a version (`?v=…`) that changes on every
 * upload, so the bytes can be cached by the browser indefinitely.
 */
export const GET = handler(async () => {
  await connection();
  const avatar = await readAvatar();
  if (!avatar) throw fail(404, "not_found", "未设置站点头像");
  return new Response(new Uint8Array(avatar.bytes), {
    status: 200,
    headers: {
      "Content-Type": avatar.mime,
      "Content-Length": String(avatar.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
