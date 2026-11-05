"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SiteSettings } from "@/server/settings";

const SiteConfigContext = createContext<SiteSettings | null>(null);

/** Site name and filing numbers, resolved on the server in the root layout. */
export function SiteConfigProvider({ value, children }: { value: SiteSettings; children: ReactNode }) {
  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteSettings {
  const value = useContext(SiteConfigContext);
  if (!value) throw new Error("useSiteConfig must be used inside SiteConfigProvider");
  return value;
}
