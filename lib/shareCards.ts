"use client";

// Lightweight share-card URL encoding. The card page reads query
// params and renders a branded card + share CTAs. A real backend
// later can replace this with opaque ids, but query-params work
// without one and survive being pasted into WhatsApp / X.

export type RunCardParams = {
  kind: "run";
  handle: string;
  score: string; // e.g. "5/5"
  accuracy: number; // %
  xp: number;
  streak?: number;
  date?: string; // ISO
};

export type RankCardParams = {
  kind: "rank";
  handle: string;
  context: string; // e.g. "IIM-B Finance Club · Week 14"
  rank: number;
  outOf: number;
  xp?: number;
  delta?: string; // e.g. "+320 XP"
};

export type CardParams = RunCardParams | RankCardParams;

export function cardUrl(params: CardParams, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "https://tradeverse.app");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    qs.set(k, String(v));
  }
  return `${base}/s/card?${qs.toString()}`;
}

export function whatsappShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

export function twitterShareUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function parseCard(params: URLSearchParams): CardParams | null {
  const kind = params.get("kind");
  if (kind === "run") {
    const handle = params.get("handle");
    const score = params.get("score");
    if (!handle || !score) return null;
    return {
      kind: "run",
      handle,
      score,
      accuracy: Number(params.get("accuracy") || 0),
      xp: Number(params.get("xp") || 0),
      streak: params.get("streak") ? Number(params.get("streak")) : undefined,
      date: params.get("date") || undefined,
    };
  }
  if (kind === "rank") {
    const handle = params.get("handle");
    const context = params.get("context");
    if (!handle || !context) return null;
    return {
      kind: "rank",
      handle,
      context,
      rank: Number(params.get("rank") || 0),
      outOf: Number(params.get("outOf") || 0),
      xp: params.get("xp") ? Number(params.get("xp")) : undefined,
      delta: params.get("delta") || undefined,
    };
  }
  return null;
}

export function defaultCopyFor(params: CardParams): string {
  if (params.kind === "run") {
    return `I scored ${params.score} on today's TradeVerse chart challenge (${params.accuracy}% accuracy).`;
  }
  return `#${params.rank} of ${params.outOf} in ${params.context} on TradeVerse.`;
}
