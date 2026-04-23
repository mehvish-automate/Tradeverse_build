import type { Metadata } from "next";

import CardClient from "./CardClient";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const read = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : "";
  };
  const kind = read("kind");
  const handle = read("handle");

  if (kind === "run") {
    const score = read("score");
    const acc = read("accuracy");
    return {
      title: `${score} on TradeVerse`,
      description: `@${handle} scored ${score} on today's chart challenge (${acc}% accuracy).`,
      openGraph: {
        title: `${score} on TradeVerse`,
        description: `@${handle} scored ${score} — ${acc}% accuracy.`,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${score} on TradeVerse`,
        description: `@${handle} scored ${score} — ${acc}% accuracy.`,
      },
    };
  }
  if (kind === "rank") {
    const rank = read("rank");
    const outOf = read("outOf");
    const ctx = read("context");
    return {
      title: `#${rank} of ${outOf} on TradeVerse`,
      description: `@${handle} is ranked #${rank} of ${outOf} in ${ctx}.`,
      openGraph: {
        title: `#${rank} of ${outOf} on TradeVerse`,
        description: `@${handle} · ${ctx}`,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `#${rank} of ${outOf} on TradeVerse`,
        description: `@${handle} · ${ctx}`,
      },
    };
  }

  return {
    title: "Share card",
    description: "A TradeVerse share card.",
  };
}

export default function ShareCardPage() {
  return <CardClient />;
}
