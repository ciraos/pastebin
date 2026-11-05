import { revalidateTag } from "next/cache";
import { fail, handler, json } from "@/server/http";
import { requireAdmin } from "@/server/session";
import {
  AVATAR_MIME_TYPES,
  clearAvatar,
  isAvatarMimeType,
  MAX_AVATAR_BYTES,
  saveAvatar,
  SETTINGS_TAG,
} from "@/server/settings";

function wire(settings: { avatarUrl: string | null }) {
  return { avatar_url: settings.avatarUrl };
}

export const POST = handler(async (request: Request) => {
  await requireAdmin();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw fail(422, "validation_error", "请求体必须是 multipart/form-data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw fail(422, "validation_error", "请选择要上传的图片");
  if (!isAvatarMimeType(file.type)) {
    throw fail(422, "unsupported_type", `只支持 ${AVATAR_MIME_TYPES.join(" / ")}`);
  }
  if (file.size === 0) throw fail(422, "validation_error", "图片是空文件");
  if (file.size > MAX_AVATAR_BYTES) {
    throw fail(413, "image_too_large", `图片不能超过 ${Math.floor(MAX_AVATAR_BYTES / 1024)} KB`);
  }

  const settings = await saveAvatar(Buffer.from(await file.arrayBuffer()), file.type);
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  return json(wire(settings));
});

export const DELETE = handler(async () => {
  await requireAdmin();
  const settings = await clearAvatar();
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  return json(wire(settings));
});
