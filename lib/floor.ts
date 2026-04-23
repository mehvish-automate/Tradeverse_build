"use client";

// Club social trading floor: posts, reactions, comments. Client-side
// today; the backend will replace the storage layer without changing
// the shape. Real-time / voice rooms are deliberately out of scope for
// V1 — that's a different infra commitment.

export type ReactionEmoji = "👏" | "🔥" | "🧠" | "😅" | "📈";

export const REACTIONS: ReactionEmoji[] = ["👏", "🔥", "🧠", "😅", "📈"];

export type Comment = {
  id: string;
  email: string;
  displayName: string;
  body: string;
  ts: number;
};

export type PostKind = "text" | "chart-read" | "portfolio-share";

export type Post = {
  id: string;
  clubId: string;
  email: string;
  displayName: string;
  body: string;
  kind: PostKind;
  meta?: { ticker?: string; portfolioName?: string };
  createdAt: number;
  reactions: Record<ReactionEmoji, string[]>;
  comments: Comment[];
};

const KEY = (clubId: string) => `tv.floor.${clubId}`;
const SEED_KEY = (clubId: string) => `tv.floor.seeded.${clubId}`;

function read(clubId: string): Post[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(clubId)) || "[]") as Post[];
  } catch {
    return [];
  }
}
function write(clubId: string, posts: Post[]) {
  localStorage.setItem(KEY(clubId), JSON.stringify(posts));
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

const SEED_HANDLES = [
  "ananya_b", "rohan.98", "kabir_m", "tara.99",
  "advait.dev", "rhea_k", "neha_iitb",
];

const SEED_TEMPLATES: Omit<Post, "id" | "clubId" | "createdAt" | "reactions" | "comments">[] = [
  {
    email: "ananya_b@demo.tradeverse.local",
    displayName: "ananya_b",
    body: "RELIANCE 15m looks like a textbook bull flag — shallow pullback on lower volume, holding the 20EMA. Open for debate.",
    kind: "chart-read",
    meta: { ticker: "RELIANCE" },
  },
  {
    email: "rohan.98@demo.tradeverse.local",
    displayName: "rohan.98",
    body: "Ran today's daily in 2m34s. 5/5 but the RSI one was a coin flip — 72 vs 68 on similar-looking candles.",
    kind: "text",
  },
  {
    email: "kabir_m@demo.tradeverse.local",
    displayName: "kabir_m",
    body: "Budget week play: 40% banking, 30% infra, 20% cash, 10% auto. Underweight IT feels right with the FX on the screen.",
    kind: "portfolio-share",
    meta: { portfolioName: "Budget-Week Balanced" },
  },
  {
    email: "tara.99@demo.tradeverse.local",
    displayName: "tara.99",
    body: "HDFCBANK: 1500 is acting like the working support again. Three bounces this week already. Not a tip — just pattern-spotting.",
    kind: "chart-read",
    meta: { ticker: "HDFCBANK" },
  },
  {
    email: "neha_iitb@demo.tradeverse.local",
    displayName: "neha_iitb",
    body: "Weekly challenge done. Streak: 14 days. The pattern-recognition reps really compound after day 10.",
    kind: "text",
  },
];

/** Ensure every club has some posts so new floors aren't empty. */
function ensureSeeded(clubId: string) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_KEY(clubId)) === "1") return;

  const existing = read(clubId);
  if (existing.length > 0) {
    localStorage.setItem(SEED_KEY(clubId), "1");
    return;
  }

  const seed = hash(clubId);
  const now = Date.now();
  const seeds: Post[] = SEED_TEMPLATES.map((tmpl, i) => {
    const hoursAgo = 2 + ((seed + i * 17) % 40);
    const reactions: Record<ReactionEmoji, string[]> = {
      "👏": [],
      "🔥": [],
      "🧠": [],
      "😅": [],
      "📈": [],
    };
    // Sprinkle a few deterministic reactions so cards look lived-in.
    const bucket: ReactionEmoji =
      REACTIONS[(seed + i) % REACTIONS.length] ?? "👏";
    const reactorCount = 1 + ((seed + i * 11) % 4);
    reactions[bucket] = SEED_HANDLES.slice(0, reactorCount).map(
      (h) => `${h}@demo.tradeverse.local`,
    );
    return {
      id: genId(),
      clubId,
      createdAt: now - hoursAgo * 60 * 60 * 1000,
      reactions,
      comments: [],
      ...tmpl,
    };
  });

  write(clubId, seeds);
  localStorage.setItem(SEED_KEY(clubId), "1");
}

export function listPosts(clubId: string): Post[] {
  ensureSeeded(clubId);
  return read(clubId).sort((a, b) => b.createdAt - a.createdAt);
}

export function createPost(input: {
  clubId: string;
  author: { email: string; displayName: string };
  body: string;
  kind?: PostKind;
  meta?: Post["meta"];
}): { ok: true; post: Post } | { ok: false; error: string } {
  const body = input.body.trim();
  if (body.length < 2) return { ok: false, error: "Post too short." };
  if (body.length > 500) return { ok: false, error: "Post too long (max 500)." };

  const post: Post = {
    id: genId(),
    clubId: input.clubId,
    email: input.author.email,
    displayName: input.author.displayName,
    body,
    kind: input.kind ?? "text",
    meta: input.meta,
    createdAt: Date.now(),
    reactions: {
      "👏": [],
      "🔥": [],
      "🧠": [],
      "😅": [],
      "📈": [],
    },
    comments: [],
  };
  const all = read(input.clubId);
  all.push(post);
  write(input.clubId, all);
  return { ok: true, post };
}

export function deletePost(clubId: string, postId: string, email: string): boolean {
  const all = read(clubId);
  const post = all.find((p) => p.id === postId);
  if (!post) return false;
  if (post.email !== email) return false; // only author
  write(clubId, all.filter((p) => p.id !== postId));
  return true;
}

export function toggleReaction(
  clubId: string,
  postId: string,
  email: string,
  emoji: ReactionEmoji,
) {
  const all = read(clubId);
  const post = all.find((p) => p.id === postId);
  if (!post) return;
  // Remove the email from every bucket first — enforces one-per-post.
  for (const k of REACTIONS) {
    post.reactions[k] = (post.reactions[k] || []).filter((e) => e !== email);
  }
  // Then add to the target bucket.
  if (!post.reactions[emoji]) post.reactions[emoji] = [];
  post.reactions[emoji].push(email);
  write(clubId, all);
}

export function clearReaction(clubId: string, postId: string, email: string) {
  const all = read(clubId);
  const post = all.find((p) => p.id === postId);
  if (!post) return;
  for (const k of REACTIONS) {
    post.reactions[k] = (post.reactions[k] || []).filter((e) => e !== email);
  }
  write(clubId, all);
}

export function myReaction(post: Post, email: string): ReactionEmoji | null {
  for (const k of REACTIONS) {
    if ((post.reactions[k] || []).includes(email)) return k;
  }
  return null;
}

export function addComment(
  clubId: string,
  postId: string,
  author: { email: string; displayName: string },
  body: string,
): { ok: boolean; error?: string } {
  const trimmed = body.trim();
  if (trimmed.length < 2) return { ok: false, error: "Comment too short." };
  if (trimmed.length > 280) return { ok: false, error: "Comment too long." };
  const all = read(clubId);
  const post = all.find((p) => p.id === postId);
  if (!post) return { ok: false, error: "Post not found." };
  post.comments.push({
    id: genId(),
    email: author.email,
    displayName: author.displayName,
    body: trimmed,
    ts: Date.now(),
  });
  write(clubId, all);
  return { ok: true };
}

// --- Counters for quests / badges ---

/** Count of posts authored by this user across all clubs. */
export function postsAuthoredCount(email: string): number {
  if (typeof window === "undefined") return 0;
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("tv.floor.") || k.startsWith("tv.floor.seeded.")) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || "[]") as Post[];
      count += arr.filter((p) => p.email === email).length;
    } catch {
      // ignore
    }
  }
  return count;
}
