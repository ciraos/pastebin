import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteConfigProvider } from "@/components/site-config-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { APP_TAGLINE } from "@/lib/config";
import { themeBootstrapScript } from "@/lib/theme";
import { getSiteSettings } from "@/server/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSiteSettings();
  return {
    title: {
      default: `${siteName} · 代码与报错分享`,
      template: `%s · ${siteName}`,
    },
    description: APP_TAGLINE,
    applicationName: siteName,
    robots: { index: false, follow: false },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const siteSettings = await getSiteSettings();

  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col antialiased">
        {/* Runs before the rest of the body paints, so there is no theme flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript() }} />
        <Providers>
          <SiteConfigProvider value={siteSettings}>
            <Suspense fallback={<div className="h-14 border-b border-line/70 bg-canvas/80" />}>
              <SiteHeader />
            </Suspense>
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </SiteConfigProvider>
        </Providers>
      </body>
    </html>
  );
}
