"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  Notification,
  buildFeed,
  isRead,
  markAllRead,
  markRead,
} from "@/lib/notifications";
import { useSession } from "@/lib/session";

export default function InboxPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <InboxInner />
        </RequireAuth>
      </main>
    </>
  );
}

function InboxInner() {
  const { user } = useSession();
  const [feed, setFeed] = useState<Notification[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    if (!user) return;
    setFeed(buildFeed(user.email));
    setTick((t) => t + 1);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;

  const unread = feed.filter((n) => !isRead(user.email, n.id)).length;

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Activity
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Inbox</h1>
          <p className="mt-2 text-sm text-ink-400">
            Every reward, streak milestone, fest transition, and claimable
            quest lands here. {unread} unread.
          </p>
        </div>
        <button
          onClick={() => {
            if (!user) return;
            markAllRead(user.email, feed);
            refresh();
          }}
          disabled={unread === 0}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900 disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>

      {feed.length === 0 ? (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          Nothing here yet. Play today&apos;s challenge, join a fest, or
          resolve an event — activity shows up here within a minute.
        </div>
      ) : (
        <ul className="divide-y divide-ink-900 rounded-2xl border border-ink-700 bg-ink-900/40">
          {feed.map((n) => {
            const read = isRead(user.email, n.id);
            const onClick = () => {
              if (!read) {
                markRead(user!.email, n.id);
                refresh();
              }
            };
            const cls =
              "flex items-start gap-4 px-5 py-4 " +
              (n.href ? "cursor-pointer hover:bg-ink-900/60 " : "") +
              (read ? "opacity-70" : "");
            const body = (
              <>
                <span className="mt-0.5 text-2xl leading-none">
                  {n.emoji ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-50">{n.title}</span>
                    {!read && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                    )}
                  </div>
                  <div className="mt-0.5 text-sm text-ink-300">{n.body}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-500">
                    {new Date(n.ts).toLocaleString()}
                  </div>
                </div>
                {n.href && (
                  <span className="self-center text-sm text-ink-400">→</span>
                )}
              </>
            );
            return (
              <li key={n.id + ":" + tick}>
                {n.href ? (
                  <Link href={n.href} onClick={onClick} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <div onClick={onClick} className={cls}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-10">
        <Link
          href="/profile"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
      </div>
    </>
  );
}
