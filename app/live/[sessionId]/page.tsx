"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { getClub, getInstitute } from "@/lib/clubs";
import {
  LiveMessage,
  addMessage,
  getCamera,
  getScreen,
  handsUp,
  listMessages,
  peers,
  stopTracks,
  toggleHand,
} from "@/lib/liveRooms";
import { useSession } from "@/lib/session";
import { getSession, sessionStatus } from "@/lib/sessions";

export default function LiveRoomPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ? String(params.sessionId) : "";

  const session = sessionId ? getSession(sessionId) : null;
  const club = session ? getClub(session.clubId) : null;
  const inst = club ? getInstitute(club.instituteId) : null;
  const isHost = session && user ? session.hostEmail === user.email : false;
  const status = session ? sessionStatus(session) : "upcoming";

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sharing, setSharing] = useState<"camera" | "screen" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [draft, setDraft] = useState("");

  const [myHand, setMyHand] = useState(false);
  const [allHands, setAllHands] = useState<string[]>([]);

  const refreshChat = useCallback(() => {
    if (!sessionId) return;
    setMessages(listMessages(sessionId));
    setAllHands(handsUp(sessionId));
  }, [sessionId]);

  useEffect(() => {
    refreshChat();
    const iv = setInterval(refreshChat, 2000);
    return () => clearInterval(iv);
  }, [refreshChat]);

  // Bind the stream to the video element whenever either changes.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    return () => stopTracks(stream);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  if (!session) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Session not found</h1>
        <p className="mt-2 text-sm text-ink-400">
          This live room hasn&apos;t been created, or the host cancelled.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  const peerList = peers(session.id);

  async function startCamera() {
    setErr(null);
    stopTracks(stream);
    const s = await getCamera();
    if (!s) {
      setErr("Camera / mic blocked or unsupported on this device.");
      setStream(null);
      setSharing(null);
      return;
    }
    setStream(s);
    setSharing("camera");
  }

  async function startScreen() {
    setErr(null);
    stopTracks(stream);
    const s = await getScreen();
    if (!s) {
      setErr("Screen share blocked or unsupported on this device.");
      setStream(null);
      setSharing(null);
      return;
    }
    setStream(s);
    setSharing("screen");
  }

  function stop() {
    stopTracks(stream);
    setStream(null);
    setSharing(null);
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const r = addMessage(
      session!.id,
      { email: user!.email, displayName: user!.displayName },
      draft,
    );
    if (r.ok) {
      setDraft("");
      refreshChat();
    }
  }

  function onHand() {
    const next = toggleHand(session!.id, user!.email);
    setMyHand(next);
    refreshChat();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/clubs/${session.clubId}/sessions`}
            className="text-xs text-ink-400 hover:text-ink-100"
          >
            ← {club?.name ?? "Club"} sessions
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{session.title}</h1>
            <span
              className={
                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                (status === "live"
                  ? "bg-brand-500/15 text-brand-300"
                  : status === "upcoming"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-ink-800 text-ink-400")
              }
            >
              {status}
            </span>
            {isHost && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Host
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-ink-500">
            {inst?.short ?? "—"} · hosted by @{session.hostDisplayName} ·{" "}
            {new Date(session.startsAt).toLocaleString()} ·{" "}
            {session.durationMins} min
          </div>
        </div>
        {session.externalLink && (
          <a
            href={session.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-900"
          >
            Open meeting link ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-4">
          <div className="relative overflow-hidden rounded-lg border border-ink-700 bg-ink-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={"w-full " + (stream ? "bg-black" : "bg-ink-950")}
              style={{ aspectRatio: "16 / 9" }}
            />
            {!stream && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-ink-500">
                <div>
                  <div className="text-4xl">📡</div>
                  <div className="mt-2">No stream yet</div>
                  {isHost ? (
                    <div className="mt-1 text-xs">
                      Tap Camera or Screen to go live on this device.
                    </div>
                  ) : (
                    <div className="mt-1 text-xs">
                      Waiting for the host to start the stream.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {isHost && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={startCamera}
                disabled={sharing === "camera"}
                className={
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition " +
                  (sharing === "camera"
                    ? "border border-brand-500 bg-brand-500/15 text-brand-200"
                    : "bg-brand-500 text-ink-950 hover:bg-brand-300")
                }
              >
                {sharing === "camera" ? "Camera live" : "Share camera"}
              </button>
              <button
                onClick={startScreen}
                disabled={sharing === "screen"}
                className={
                  "rounded-md px-3 py-1.5 text-sm transition " +
                  (sharing === "screen"
                    ? "border border-brand-500 bg-brand-500/15 text-brand-200"
                    : "border border-ink-700 text-ink-100 hover:bg-ink-900")
                }
              >
                {sharing === "screen" ? "Screen live" : "Share screen"}
              </button>
              {stream && (
                <button
                  onClick={stop}
                  className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20"
                >
                  Stop
                </button>
              )}
            </div>
          )}

          {err && (
            <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
              {err}
            </p>
          )}

          <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
            V1 scaffold: the video above is local-only — your camera / screen
            renders in your own tab. Multi-peer voice & video (remote
            participants seeing you) needs the backend WebRTC signalling +
            TURN relay that lands in a later phase.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-ink-700 bg-ink-900/40 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
                In the room
              </h2>
              <span className="text-xs text-ink-500">
                {peerList.length + 1} people
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-ink-100">
                  @{session.hostDisplayName}
                  <span className="ml-2 text-xs text-amber-300">host</span>
                </span>
                <span className="text-xs text-ink-500">—</span>
              </li>
              {peerList.map((p) => (
                <li key={p.handle} className="flex items-center justify-between">
                  <span className="text-ink-200">
                    @{p.handle}
                    {allHands.includes(`${p.handle}@demo.tradeverse.local`) && (
                      <span className="ml-1">✋</span>
                    )}
                  </span>
                  <span className="text-xs text-ink-500">{p.role}</span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-ink-800 pt-2">
                <span className="text-ink-100">
                  @{user.displayName}
                  <span className="ml-2 text-xs text-brand-300">you</span>
                  {myHand && <span className="ml-1">✋</span>}
                </span>
                <button
                  onClick={onHand}
                  className="rounded-md border border-ink-700 px-2 py-0.5 text-xs text-ink-200 hover:bg-ink-900"
                >
                  {myHand ? "Lower hand" : "Raise hand"}
                </button>
              </li>
            </ul>
          </div>

          <div className="flex flex-col rounded-2xl border border-ink-700 bg-ink-900/40 p-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
              Chat
            </h2>
            <ul className="mt-3 max-h-80 space-y-1.5 overflow-auto text-sm">
              {messages.length === 0 ? (
                <li className="text-xs text-ink-500">
                  No chat yet — say hello.
                </li>
              ) : (
                messages.map((m) => (
                  <li key={m.id}>
                    <span className="text-ink-100">@{m.displayName}</span>{" "}
                    <span className="text-ink-500 text-[10px]">
                      {new Date(m.ts).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <div className="text-ink-200">{m.body}</div>
                  </li>
                ))
              )}
            </ul>
            <form onSubmit={sendChat} className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message the room…"
                maxLength={500}
                className="input"
              />
              <button
                type="submit"
                disabled={draft.trim().length === 0}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/clubs/${session.clubId}/sessions`}
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to sessions
        </Link>
      </div>
    </>
  );
}
