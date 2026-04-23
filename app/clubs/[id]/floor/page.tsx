"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Club, getClub, getInstitute } from "@/lib/clubs";
import {
  Post,
  PostKind,
  REACTIONS,
  ReactionEmoji,
  addComment,
  clearReaction,
  createPost,
  deletePost,
  listPosts,
  myReaction,
  toggleReaction,
} from "@/lib/floor";
import { useSession } from "@/lib/session";
import { useRealtimeFloor } from "@/lib/supabase/realtime";
import { writeFloorPost } from "@/lib/supabase/writes";

export default function FloorPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const params = useParams<{ id: string }>();
  const clubId = params?.id ? String(params.id) : "";

  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);

  const live = useRealtimeFloor();

  const refresh = useCallback(() => {
    if (!clubId) return;
    setClub(getClub(clubId));
    setPosts(listPosts(clubId));
  }, [clubId]);

  useEffect(() => {
    refresh();
  }, [refresh, live.tick]);

  if (!user || club === undefined) return null;
  if (club === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Club not found</h1>
        <Link
          href="/clubs"
          className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to clubs
        </Link>
      </div>
    );
  }

  const inst = getInstitute(club.instituteId);
  const amMember = club.members.some((m) => m.email === user.email);

  return (
    <>
      <div className="mb-6">
        <Link
          href={`/clubs/${club.id}`}
          className="text-xs text-ink-400 hover:text-ink-100"
        >
          ← {club.name}
        </Link>
        <h1 className="mt-1 text-3xl font-semibold">Trading floor</h1>
        <p className="mt-1 text-xs text-ink-500">
          {inst?.short ?? "—"} · Post reads, react, comment. No tips or
          recommendations — just patterns, process, and banter.
        </p>
      </div>

      {amMember ? (
        <Composer
          clubId={club.id}
          onPosted={() => refresh()}
        />
      ) : (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-5 text-sm text-ink-400">
          Join the club to post here.{" "}
          <Link href={`/clubs/${club.id}`} className="text-brand-300 hover:underline">
            Open club →
          </Link>
        </div>
      )}

      <ul className="mt-8 space-y-4">
        {posts.map((p) => (
          <li key={p.id}>
            <PostCard
              post={p}
              clubId={club.id}
              viewerEmail={user.email}
              viewerDisplayName={user.displayName}
              onChange={refresh}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function Composer({ clubId, onPosted }: { clubId: string; onPosted: () => void }) {
  const { user } = useSession();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<PostKind>("text");
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = createPost({
      clubId,
      author: { email: user!.email, displayName: user!.displayName },
      body,
      kind,
      meta: kind === "chart-read" && ticker ? { ticker: ticker.toUpperCase() } : undefined,
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    void writeFloorPost({
      clubId,
      body: r.post.body,
      kind: r.post.kind,
      ticker: r.post.meta?.ticker,
    });
    setBody("");
    setTicker("");
    setKind("text");
    onPosted();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {(["text", "chart-read", "portfolio-share"] as PostKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              "rounded-md border px-2.5 py-1 text-xs transition " +
              (kind === k
                ? "border-brand-500 bg-brand-500/10 text-brand-200"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {k === "text" ? "Take" : k === "chart-read" ? "Chart read" : "Portfolio share"}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          kind === "chart-read"
            ? "What are you seeing on the chart?"
            : kind === "portfolio-share"
              ? "What's your current allocation and why?"
              : "Short take. 2–3 lines max works best."
        }
        maxLength={500}
        className="input mt-3 min-h-[90px]"
        required
      />

      {kind === "chart-read" && (
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ticker (RELIANCE, HDFCBANK, …)"
          className="input mt-2 max-w-xs"
          maxLength={16}
        />
      )}

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-ink-500">{body.length}/500</span>
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Post
        </button>
      </div>
    </form>
  );
}

function PostCard({
  post,
  clubId,
  viewerEmail,
  viewerDisplayName,
  onChange,
}: {
  post: Post;
  clubId: string;
  viewerEmail: string;
  viewerDisplayName: string;
  onChange: () => void;
}) {
  const [comment, setComment] = useState("");
  const mine = myReaction(post, viewerEmail);

  function onReact(e: ReactionEmoji) {
    if (mine === e) clearReaction(clubId, post.id, viewerEmail);
    else toggleReaction(clubId, post.id, viewerEmail, e);
    onChange();
  }

  function onComment(e: React.FormEvent) {
    e.preventDefault();
    const r = addComment(
      clubId,
      post.id,
      { email: viewerEmail, displayName: viewerDisplayName },
      comment,
    );
    if (r.ok) {
      setComment("");
      onChange();
    }
  }

  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
      <header className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-100">@{post.displayName}</span>
          <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
            {post.kind === "text"
              ? "Take"
              : post.kind === "chart-read"
                ? "Chart read"
                : "Portfolio share"}
          </span>
          {post.meta?.ticker && (
            <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] text-brand-300">
              {post.meta.ticker}
            </span>
          )}
        </div>
        <span className="text-ink-500">{relativeTime(post.createdAt)}</span>
      </header>

      <p className="mt-3 whitespace-pre-wrap text-ink-200">{post.body}</p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {REACTIONS.map((e) => {
          const count = (post.reactions[e] || []).length;
          const picked = mine === e;
          return (
            <button
              key={e}
              onClick={() => onReact(e)}
              className={
                "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition " +
                (picked
                  ? "border-brand-500 bg-brand-500/10 text-ink-50"
                  : "border-ink-700 text-ink-300 hover:border-ink-500")
              }
            >
              <span>{e}</span>
              {count > 0 && <span className="text-ink-400">{count}</span>}
            </button>
          );
        })}
        {post.email === viewerEmail && (
          <button
            onClick={() => {
              if (!confirm("Delete this post?")) return;
              deletePost(clubId, post.id, viewerEmail);
              onChange();
            }}
            className="ml-auto rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-400 hover:bg-ink-900"
          >
            Delete
          </button>
        )}
      </div>

      {post.comments.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-ink-900 pt-3 text-sm">
          {post.comments.map((c) => (
            <li key={c.id} className="text-ink-300">
              <span className="text-ink-100">@{c.displayName}</span> ·{" "}
              <span className="text-ink-500 text-xs">{relativeTime(c.ts)}</span>
              <div className="mt-0.5 text-ink-200">{c.body}</div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={onComment}
        className="mt-4 flex items-center gap-2 border-t border-ink-900 pt-3"
      >
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Reply…"
          maxLength={280}
          className="input"
        />
        <button
          type="submit"
          disabled={comment.trim().length < 2}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900 disabled:opacity-40"
        >
          Reply
        </button>
      </form>
    </article>
  );
}

function relativeTime(ts: number): string {
  const delta = Math.max(0, Date.now() - ts);
  const m = Math.floor(delta / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
