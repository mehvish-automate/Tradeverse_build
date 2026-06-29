import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const code = (params.code || "").toUpperCase();
  return {
    title: `Invite ${code}`,
    description:
      "You've been invited to TradeVerse — daily chart challenges and Quiz Floors on Indian markets. No trading, no real money.",
    openGraph: {
      title: `You're invited to TradeVerse (code ${code})`,
      description:
        "Daily chart challenges and Quiz Floors. Claim your invite and +150 XP.",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `You're invited to TradeVerse (code ${code})`,
      description:
        "Daily chart challenges and Quiz Floors. Claim your invite and +150 XP.",
    },
  };
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
