"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Club, getClub, getInstitute } from "@/lib/clubs";
import {
  LiveSession,
  SessionKind,
  cancelSession,
  createSession,
  sessionStatus,
  sessionsForClub,
  toggleRsvp,
  updateNotes,
} from "@/lib/sessions";
import { useSession } from "@/lib/session";

export default function SessionsPage() {
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
  const [items, setItems] = useState<LiveSession[]>([]);

  const refresh = useCallback(() => {
    if (!clubId) return;
    setClub(getClub(clubId));
    setItems(sessionsForClub(clubId));
  }, [clubId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const now = Date.now();
  const upcoming = items.filter((s) => sessionStatus(s, now) !== "ended");
  const past = items.filter((s) => sessionStatus(s, now) === "ended").reverse();

  return (
    <>
      <div className="mb-6">
        <Link
          href={`/clubs/${club.id}`}
          className="text-xs text-ink-400 hover:text-ink-100"
        >
          ← {club.name}
        </Link>
        <h1 className="mt-1 text-3xl font-semibold">Live sessions</h1>
        <p className="mt-1 text-xs text-ink-500">
          {inst?.short ?? "—"} · Scheduled walkthroughs, market-open
          watches, and AMAs. Hosted on whichever meeting tool the club
          uses — we just track time + RSVPs + notes.
        </p>
      </div>

      {amMember && (
        <CreateSessionCard clubId={club.id} onCreated={refresh} />
      )}

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
        Upcoming
      </h2>
      {upcoming.length === 0 ? (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-5 text-sm text-ink-400">
          Nothing scheduled.{" "}
          {amMember ? "Use the form above to add one." : "Check back soon."}
        </div>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((s) => (
            <li key={s.id}>
              <SessionCard session={s} onChange={refresh} />
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
            Past sessions
          </h2>
          <ul className="space-y-3">
            {past.map((s) => (
              <li key={s.id}>
                <SessionCard session={s} onChange={refresh} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function CreateSessionCard({
  clubId,
  onCreated,
}: {
  clubId: string;
  onCreated: () => void;
}) {
  const { user } = useSession();

  const now = new Date();
  const defaultDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  defaultDate.setMinutes(0, 0, 0);
  defaultDate.setHours(19); // 7 PM local

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<SessionKind>("walkthrough");
  const [date, setDate] = useState(defaultDate.toISOString().slice(0, 10));
  const [time, setTime] = useState("19:00");
  const [duration, setDuration] = useState(45);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const startsAt = new Date(`${date}T${time}:00`).getTime();
    const r = createSession({
      clubId,
      title,
      description: description || undefined,
      kind,
      host: { email: user!.email, displayName: user!.displayName },
      startsAt,
      durationMins: duration,
      externalLink: link || undefined,
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setTitle("");
    setDescription("");
    setLink("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-brand-500/40 bg-brand-500/5 px-4 py-2 text-sm font-medium text-brand-200 hover:bg-brand-500/10"
      >
        + Schedule a session
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5"
    >
      <h2 className="text-lg font-semibold">Schedule a session</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-300">Title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Budget-day chart walkthrough"
            required
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Description (optional)
          </span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="45-min walkthrough of pre-budget setups"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-300">Kind</span>
          <select
            className="input"
            value={kind}
            onChange={(e) => setKind(e.target.value as SessionKind)}
          >
            <option value="walkthrough">Chart walkthrough</option>
            <option value="open-market">Open-market watch</option>
            <option value="ama">AMA</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Duration (min)
          </span>
          <input
            className="input"
            type="number"
            min={15}
            max={240}
            step={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-300">Date</span>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-ink-300">Time</span>
          <input
            className="input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Meeting link (Meet / Zoom / YouTube)
          </span>
          <input
            className="input"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            type="url"
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Schedule
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-200 hover:bg-ink-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SessionCard({
  session,
  onChange,
}: {
  session: LiveSession;
  onChange: () => void;
}) {
  const { user } = useSession();
  const [notesDraft, setNotesDraft] = useState(session.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);

  if (!user) return null;

  const status = sessionStatus(session);
  const going = session.rsvps.some((r) => r.email === user.email);
  const isHost = session.hostEmail === user.email;

  function onRsvp() {
    toggleRsvp(session.id, { email: user!.email, displayName: user!.displayName });
    onChange();
  }

  function saveNotes() {
    updateNotes(session.id, user!.email, notesDraft);
    setEditingNotes(false);
    onChange();
  }

  return (
    <article
      className={
        "rounded-2xl border p-5 " +
        (status === "live"
          ? "border-brand-500/50 bg-brand-500/5"
          : status === "upcoming"
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-ink-700 bg-ink-900/40")
      }
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={
                "rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider " +
                (status === "live"
                  ? "bg-brand-500/20 text-brand-300"
                  : status === "upcoming"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-ink-800 text-ink-400")
              }
            >
              {status}
            </span>
            <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
              {session.kind === "walkthrough"
                ? "Walkthrough"
                : session.kind === "open-market"
                  ? "Open-market"
                  : session.kind === "ama"
                    ? "AMA"
                    : "Other"}
            </span>
          </div>
          <h3 className="mt-1.5 text-lg font-semibold text-ink-50">
            {session.title}
          </h3>
          <div className="mt-1 text-xs text-ink-500">
            {new Date(session.startsAt).toLocaleString()} · {session.durationMins} min ·
            hosted by @{session.hostDisplayName}
          </div>
          {session.description && (
            <p className="mt-2 text-sm text-ink-300">{session.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status !== "ended" && (
            <button
              onClick={onRsvp}
              className={
                "rounded-md px-3 py-1.5 text-xs font-semibold transition " +
                (going
                  ? "border border-brand-500 bg-brand-500/10 text-brand-200"
                  : "bg-brand-500 text-ink-950 hover:bg-brand-300")
              }
            >
              {going ? "Going ✓" : "RSVP"}
            </button>
          )}
          {session.externalLink && status !== "ended" && (
            <a
              href={session.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-900"
            >
              Open link →
            </a>
          )}
          {status !== "ended" && (
            <Link
              href={`/live/${session.id}`}
              className="rounded-md border border-brand-500/60 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-200 hover:bg-brand-500/20"
            >
              Join live room →
            </Link>
          )}
          {isHost && status !== "ended" && (
            <button
              onClick={() => {
                if (!confirm("Cancel this session?")) return;
                cancelSession(session.id, user!.email);
                onChange();
              }}
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
            >
              Cancel
            </button>
          )}
        </div>
      </header>

      <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
        <span>{session.rsvps.length} RSVPs</span>
        {session.rsvps.length > 0 && (
          <span className="text-ink-500">
            ·{" "}
            {session.rsvps
              .slice(0, 3)
              .map((r) => `@${r.displayName}`)
              .join(", ")}
            {session.rsvps.length > 3 && ` +${session.rsvps.length - 3}`}
          </span>
        )}
      </div>

      {(status === "ended" || isHost) && (
        <div className="mt-4 border-t border-ink-900 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-400">
              Notes
            </span>
            {isHost && !editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-xs text-brand-300 hover:underline"
              >
                {session.notes ? "Edit" : "Add notes"}
              </button>
            )}
          </div>
          {editingNotes ? (
            <>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                maxLength={4000}
                className="input min-h-[100px]"
                placeholder="Key takeaways, charts discussed, follow-up reads…"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={saveNotes}
                  className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingNotes(false);
                    setNotesDraft(session.notes ?? "");
                  }}
                  className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : session.notes ? (
            <p className="whitespace-pre-wrap text-sm text-ink-200">
              {session.notes}
            </p>
          ) : (
            <p className="text-xs text-ink-500">
              {isHost
                ? "Drop your takeaways here once the session ends."
                : "Host hasn't posted notes yet."}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
