import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeVerse — Markets as a daily skill game",
  description:
    "TradeVerse is a pure skill-game for Indian markets. Daily chart challenges and friend leagues. No trading, no real money.",
  metadataBase: new URL("https://tradeverse.app"),
  openGraph: {
    title: "TradeVerse — Markets as a daily skill game",
    description:
      "Mathiks for markets. Duolingo for instinct. WhatsApp for the social spine.",
    type: "website",
  },
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
