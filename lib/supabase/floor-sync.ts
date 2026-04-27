"use client";

// Phase 35 — mirror club floor posts, reactions, and comments to
// Supabase. localStorage is the read source of truth (per-club key
// `tv.floor.<clubId>`). Cloud rows give cross-device persistence and
// power the realtime tick on `floor_posts`.
//
// Uses lazy imports from lib/floor.ts to avoid circular deps.
// Skips clubs with non-UUID ids (legacy local-only clubs from before
// the genId() fix in Phase 33).

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import type { Comment, Post, ReactionEmoji } from "../floor";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Insert a new floor post. The local UUID becomes the cloud row id. */
export async function mirrorPost(post: Post): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  if (!UUID_RE.test(post.id) || !UUID_RE.test(post.clubId)) return false;

  const row = {
    id: post.id,
    club_id: post.clubId,
    user_id: userId,
    kind: post.kind,
    body: post.body,
    ticker: post.meta?.ticker ?? null,
  };
  const { error } = await (supabase.from("floor_posts") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "id", ignoreDuplicates: true });
  return !error;
}

/** Delete a floor post (RLS allows author only). */
export async function mirrorDeletePost(postId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  if (!UUID_RE.test(postId)) return false;
  const { error } = await (supabase.from("floor_posts") as unknown as {
    delete: () => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .delete()
    .eq("id", postId);
  return !error;
}

/**
 * Set the current user's reaction on a post. Schema PK is (post_id,
 * user_id) so upsert overwrites the previous emoji — matches the local
 * one-reaction-per-user-per-post invariant in toggleReaction().
 */
export async function mirrorReaction(
  postId: string,
  emoji: ReactionEmoji,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  if (!UUID_RE.test(postId)) return false;
  const row = { post_id: postId, user_id: userId, emoji };
  const { error } = await (supabase.from("floor_reactions") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "post_id,user_id" });
  return !error;
}

/** Remove the current user's reaction from a post. */
export async function mirrorClearReaction(postId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  if (!UUID_RE.test(postId)) return false;
  const { error } = await (supabase.from("floor_reactions") as unknown as {
    delete: () => {
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  })
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  return !error;
}

/** Insert a comment row. The local UUID becomes the cloud row id. */
export async function mirrorComment(
  postId: string,
  comment: Comment,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  if (!UUID_RE.test(postId) || !UUID_RE.test(comment.id)) return false;
  const row = {
    id: comment.id,
    post_id: postId,
    user_id: userId,
    body: comment.body,
  };
  const { error } = await (supabase.from("floor_comments") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "id", ignoreDuplicates: true });
  return !error;
}

/**
 * Pull every post in a club, plus its reactions and comments, and merge
 * into localStorage. Cloud is authoritative for shared post ids (since
 * other-device reactions/comments aren't in local). Local-only posts
 * (seed posts, offline drafts) are preserved.
 *
 * Called on floor page mount + after each realtime tick on floor_posts.
 */
export async function pullClubFloor(clubId: string): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;
  if (!UUID_RE.test(clubId)) return 0;

  // 1. Posts in this club.
  type PostRow = {
    id: string;
    club_id: string;
    user_id: string;
    kind: "text" | "chart-read" | "portfolio-share";
    body: string;
    ticker: string | null;
    created_at: string;
  };
  const postsRes = await (supabase.from("floor_posts") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: PostRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("id, club_id, user_id, kind, body, ticker, created_at")
    .eq("club_id", clubId);
  if (postsRes.error || !postsRes.data) return 0;
  if (postsRes.data.length === 0) return 0;
  const postIds = postsRes.data.map((p) => p.id);

  // 2. Reactions on those posts.
  type RxRow = { post_id: string; user_id: string; emoji: string };
  const rxRes = await (supabase.from("floor_reactions") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: RxRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("post_id, user_id, emoji")
    .in("post_id", postIds);
  const rx = rxRes.data ?? [];

  // 3. Comments on those posts.
  type CommentRow = {
    id: string;
    post_id: string;
    user_id: string;
    body: string;
    created_at: string;
  };
  const cmRes = await (supabase.from("floor_comments") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: CommentRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("id, post_id, user_id, body, created_at")
    .in("post_id", postIds);
  const cm = cmRes.data ?? [];

  // 4. Resolve all user_ids → email + display_name.
  const userIds = Array.from(
    new Set([
      ...postsRes.data.map((p) => p.user_id),
      ...rx.map((r) => r.user_id),
      ...cm.map((c) => c.user_id),
    ]),
  );
  type ProfileRow = { id: string; email: string; display_name: string };
  const profilesRes = await (supabase.from("profiles") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: ProfileRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("id, email, display_name")
    .in("id", userIds);
  const profileById = new Map<string, ProfileRow>();
  for (const p of profilesRes.data ?? []) profileById.set(p.id, p);

  // 5. Stitch into Post[] (with empty reaction buckets pre-filled).
  const REACTION_KEYS: ReactionEmoji[] = ["👏", "🔥", "🧠", "😅", "📈"];
  const cloudPosts: Post[] = postsRes.data.map((p) => {
    const author = profileById.get(p.user_id);
    const reactions: Record<ReactionEmoji, string[]> = {
      "👏": [], "🔥": [], "🧠": [], "😅": [], "📈": [],
    };
    for (const r of rx) {
      if (r.post_id !== p.id) continue;
      const reactor = profileById.get(r.user_id);
      const reactorEmail = reactor?.email ?? r.user_id;
      const e = REACTION_KEYS.includes(r.emoji as ReactionEmoji)
        ? (r.emoji as ReactionEmoji)
        : null;
      if (!e) continue;
      reactions[e].push(reactorEmail);
    }
    const comments: Comment[] = cm
      .filter((c) => c.post_id === p.id)
      .map((c) => {
        const cu = profileById.get(c.user_id);
        return {
          id: c.id,
          email: cu?.email ?? c.user_id,
          displayName: cu?.display_name ?? "Member",
          body: c.body,
          ts: new Date(c.created_at).getTime(),
        };
      })
      .sort((a, b) => a.ts - b.ts);

    return {
      id: p.id,
      clubId: p.club_id,
      email: author?.email ?? p.user_id,
      displayName: author?.display_name ?? "Member",
      body: p.body,
      kind: p.kind,
      meta: p.ticker ? { ticker: p.ticker } : undefined,
      createdAt: new Date(p.created_at).getTime(),
      reactions,
      comments,
    };
  });

  // 6. Merge into localStorage. Cloud wins for shared ids.
  const KEY = `tv.floor.${clubId}`;
  let existing: Post[] = [];
  try {
    existing = JSON.parse(localStorage.getItem(KEY) || "[]") as Post[];
  } catch { existing = []; }
  const byId = new Map<string, Post>();
  for (const p of existing) byId.set(p.id, p);
  for (const p of cloudPosts) byId.set(p.id, p);
  localStorage.setItem(KEY, JSON.stringify(Array.from(byId.values())));

  return cloudPosts.length;
}
