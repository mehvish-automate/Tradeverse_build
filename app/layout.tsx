import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TradeVerse — Markets as a daily skill game",
    template: "%s · TradeVerse",
  },
  description:
    "TradeVerse is a pure skill-game for Indian markets. Daily chart challenges and friend leagues. No trading, no real money, no KYC.",
  metadataBase: new URL("https://tradeverse.app"),
  keywords: [
    "TradeVerse",
    "stock market game India",
    "chart reading",
    "NSE BSE",
    "finance learning India",
    "friend league",
  ],
  openGraph: {
    title: "TradeVerse — Markets as a daily skill game",
    description:
      "Mathiks for markets. Duolingo for instinct. WhatsApp for the social spine.",
    type: "website",
    siteName: "TradeVerse",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeVerse — Markets as a daily skill game",
    description:
      "A daily 5-minute skill game on live NSE/BSE data. No trading, no real money.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
