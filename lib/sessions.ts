"use client";

// Club-hosted live sessions (scheduled meet-ups with a start time +
// external meeting link). No streaming infra from us — we just
// schedule + RSVP + hold space for the post-session notes. The
// real-time layer lives wherever the host already streams.

import { getClub } from "./clubs";

export type SessionKind = "walkthrough" | "open-market" | "ama" | "other";

export type SessionRsvp = {
  email: string;
  displayName: string;
  ts: number;
};

export type LiveSession = {
  id: string;
  clubId: string;
  title: string;
  description?: string;
  kind: SessionKind;
  hostEmail: string;
  hostDisplayName: string;
  startsAt: number; // ms epoch
  durationMins: number;
  externalLink?: string;
  notes?: string;
  rsvps: SessionRsvp[];
};

const KEY = "tv.sessions";

function read(): LiveSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as LiveSession[];
  } catch {
    return [];
  }
}
function write(all: LiveSession[]) {
  localStorage.setItem(KEY, JSON.stringify(all));
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// --- CRUD ---

export function sessionsForClub(clubId: string): LiveSession[] {
  return read()
    .filter((s) => s.clubId === clubId)
    .sort((a, b) => a.startsAt - b.startsAt);
}

export function getSession(id: string): LiveSession | null {
  return read().find((s) => s.id === id) ?? null;
}

export function createSession(input: {
  clubId: string;
  title: string;
  description?: string;
  kind: SessionKind;
  host: { email: string; displayName: string };
  startsAt: number;
  durationMins: number;
  externalLink?: string;
}): { ok: true; session: LiveSession } | { ok: false; error: string } {
  const club = getClub(input.clubId);
  if (!club) return { ok: false, error: "Club not found." };

  const isMember = club.members.some((m) => m.email === input.host.email);
  if (!isMember) return { ok: false, error: "Only members can host sessions." };

  const title = input.title.trim();
  if (title.length < 3) return { ok: false, error: "Title too short (min 3)." };
  if (title.length > 80) return { ok: false, error: "Title too long (max 80)." };

  if (!Number.isFinite(input.startsAt))
    return { ok: false, error: "Pick a start time." };
  if (input.durationMins < 15 || input.durationMins > 240)
    return { ok: false, error: "Duration must be 15–240 minutes." };

  const link = (input.externalLink || "").trim();
  if (link && !/^https?:\/\//i.test(link))
    return { ok: false, error: "Meeting link must start with https://" };

  const session: LiveSession = {
    id: genId(),
    clubId: input.clubId,
    title,
    description: input.description?.trim() || undefined,
    kind: input.kind,
    hostEmail: input.host.email,
    hostDisplayName: input.host.displayName,
    startsAt: input.startsAt,
    durationMins: input.durationMins,
    externalLink: link || undefined,
    rsvps: [
      {
        email: input.host.email,
        displayName: input.host.displayName,
        ts: Date.now(),
      },
    ],
  };

  const all = read();
  all.push(session);
  write(all);
  return { ok: true, session };
}

export function cancelSession(id: string, email: string): boolean {
  const all = read();
  const session = all.find((s) => s.id === id);
  if (!session) return false;
  if (session.hostEmail !== email) return false;
  write(all.filter((s) => s.id !== id));
  return true;
}

export function toggleRsvp(
  id: string,
  user: { email: string; displayName: string },
): { going: boolean } {
  const all = read();
  const session = all.find((s) => s.id === id);
  if (!session) return { going: false };
  const existing = session.rsvps.find((r) => r.email === user.email);
  if (existing) {
    session.rsvps = session.rsvps.filter((r) => r.email !== user.email);
    write(all);
    return { going: false };
  }
  session.rsvps.push({
    email: user.email,
    displayName: user.displayName,
    ts: Date.now(),
  });
  write(all);
  return { going: true };
}

export function updateNotes(
  id: string,
  email: string,
  notes: string,
): { ok: boolean; error?: string } {
  const all = read();
  const session = all.find((s) => s.id === id);
  if (!session) return { ok: false, error: "Session not found." };
  if (session.hostEmail !== email)
    return { ok: false, error: "Only the host can edit notes." };
  session.notes = notes.slice(0, 4000);
  write(all);
  return { ok: true };
}

// --- Helpers ---

export type SessionStatus = "upcoming" | "live" | "ended";

export function sessionStatus(
  s: LiveSession,
  now = Date.now(),
): SessionStatus {
  const endMs = s.startsAt + s.durationMins * 60 * 1000;
  if (now < s.startsAt) return "upcoming";
  if (now > endMs) return "ended";
  return "live";
}

export function mySessions(email: string): LiveSession[] {
  return read().filter((s) =>
    s.rsvps.some((r) => r.email === email),
  );
}

export function hostedSessionsCount(email: string): number {
  return read().filter((s) => s.hostEmail === email).length;
}
