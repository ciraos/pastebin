import { revalidateTag } from "next/cache";
import { handler, json, readJson } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { readSiteSettings, saveSiteSettings, SETTINGS_TAG, type SiteSettings } from "@/server/settings";
import { text } from "@/server/validate";

/** Wire format stays snake_case like the rest of the API. */
function wire(settings: SiteSettings) {
  return {
    site_name: settings.siteName,
    icp_number: settings.icpNumber,
    police_number: settings.policeNumber,
  };
}

export const GET = handler(async () => {
  await requireAdmin();
  return json({ settings: wire(await readSiteSettings()) });
});

export const PATCH = handler(async (request: Request) => {
  await requireAdmin();
  const payload = await readJson(request);

  const siteName = text(payload.site_name ?? "", "site_name", { max: 40 });
  const icpNumber = text(payload.icp_number ?? "", "icp_number", { max: 60 });
  const policeNumber = text(payload.police_number ?? "", "police_number", { max: 60 });

  const settings = await saveSiteSettings({ siteName, icpNumber, policeNumber });
  // The name and filings render from a cached read shared by every page.
  revalidateTag(SETTINGS_TAG, { expire: 0 });
  return json({ settings: wire(settings) });
});
