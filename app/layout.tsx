import type { Metadata, Viewport } from "next";
import "./globals.css";

import { InstallBanner } from "@/components/InstallBanner";
import { PushRuntime } from "@/components/PushRuntime";
import { SyncRuntime } from "@/components/SyncRuntime";

export const metadata: Metadata = {
  title: {
    default: "TradeVerse — Markets as a daily skill challenge",
    template: "%s · TradeVerse",
  },
  description:
    "TradeVerse is a pure skill platform for Indian markets. Daily chart challenges and Quiz Floors. No trading, no real money, no KYC.",
  metadataBase: new URL("https://tradeverse.app"),
  manifest: "/manifest.webmanifest",
  applicationName: "TradeVerse",
  keywords: [
    "TradeVerse",
    "stock market skill India",
    "chart reading",
    "NSE BSE",
    "finance learning India",
    "quiz floor",
  ],
  openGraph: {
    title: "TradeVerse — Markets as a daily skill challenge",
    description:
      "A daily 5-minute chart-reading challenge on Indian markets. Play solo, race your friends, no real money.",
    type: "website",
    siteName: "TradeVerse",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeVerse — Markets as a daily skill challenge",
    description:
      "A daily 5-minute chart-reading challenge on live NSE/BSE data. No trading, no real money.",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
    shortcut: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "TradeVerse",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <InstallBanner />
        <PushRuntime />
        <SyncRuntime />
      </body>
    </html>
  );
}
