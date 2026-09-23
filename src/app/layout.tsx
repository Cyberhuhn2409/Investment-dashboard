import type { Metadata, Viewport } from "next";
import { MotionProvider } from "@/components/motion-provider";
import { SearchHost } from "@/components/search/search-host";
import { Sidebar } from "@/components/shell/sidebar";
import { TabBar } from "@/components/shell/tab-bar";
import { ServiceWorker } from "@/components/service-worker";
import { NavTracker } from "@/components/shell/back-link";
import { MarketBar } from "@/components/live/market-bar";
import { clockOffsetMs } from "@/lib/server/clock";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Signal – Marktsignale aus Kursen, News & Social",
    template: "%s · Signal",
  },
  description:
    "Signal bündelt Kurse, Nachrichten und Social-Media-Diskussionen zu transparenten, erklärbaren Marktsignalen. Recherche-Werkzeug, keine Anlageberatung.",
  applicationName: "Signal",
  appleWebApp: { capable: true, title: "Signal", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLORS.dark,
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Zum Inhalt springen
        </a>
        <MotionProvider>
          <div className="mx-auto flex min-h-dvh max-w-[90rem]">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <MarketBar offsetMs={clockOffsetMs()} />
              <main id="inhalt" className="pb-tabbar min-w-0 lg:px-10 lg:pb-16">
                {children}
              </main>
            </div>
          </div>
          <TabBar />
          <SearchHost />
          <NavTracker />
        </MotionProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
