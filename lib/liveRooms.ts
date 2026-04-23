"use client";

// Live room — client-only scaffold.
//
// V1 uses the browser's getUserMedia + getDisplayMedia to render the
// host's own camera / screen locally, with a chat + participant panel
// backed by localStorage. Real multi-peer voice & video (WebRTC with
// a signalling server, TURN/STUN relays, media selective-forwarding)
// lands after the backend — this file gives the UI and the local
// primitives it needs.

export type LiveMessage = {
  id: string;
  email: string;
  displayName: string;
  body: string;
  ts: number;
};

const MSG_KEY = (sessionId: string) => `tv.live.chat.${sessionId}`;
const PEERS_KEY = (sessionId: string) => `tv.live.peers.${sessionId}`;

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function listMessages(sessionId: string): LiveMessage[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MSG_KEY(sessionId)) || "[]") as LiveMessage[];
  } catch {
    return [];
  }
}

export function addMessage(
  sessionId: string,
  author: { email: string; displayName: string },
  body: string,
): { ok: boolean; error?: string; message?: LiveMessage } {
  const trimmed = body.trim();
  if (trimmed.length < 1) return { ok: false, error: "Can't send empty." };
  if (trimmed.length > 500) return { ok: false, error: "Max 500 chars." };
  const all = listMessages(sessionId);
  const msg: LiveMessage = {
    id: genId(),
    email: author.email,
    displayName: author.displayName,
    body: trimmed,
    ts: Date.now(),
  };
  all.push(msg);
  // Keep only the most recent 200 lines.
  localStorage.setItem(MSG_KEY(sessionId), JSON.stringify(all.slice(-200)));
  return { ok: true, message: msg };
}

// --- Seeded peer list (demo presence until real signalling lands) ---

export type Peer = {
  handle: string;
  role: "host" | "listener";
};

const SEED_PEERS: Peer[] = [
  { handle: "ananya_b",   role: "listener" },
  { handle: "rohan.98",   role: "listener" },
  { handle: "kabir_m",    role: "listener" },
  { handle: "tara.99",    role: "listener" },
  { handle: "advait.dev", role: "listener" },
  { handle: "rhea_k",     role: "listener" },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export function peers(sessionId: string): Peer[] {
  // Deterministic-but-varying peer count per session (3–6 listeners)
  const n = 3 + (hash(sessionId) % 4);
  return SEED_PEERS.slice(0, n);
}

// --- Media helpers ---

export async function getCamera(): Promise<MediaStream | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
  } catch {
    return null;
  }
}

export async function getScreen(): Promise<MediaStream | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return null;
  const md = navigator.mediaDevices as unknown as {
    getDisplayMedia?: (opts: unknown) => Promise<MediaStream>;
  };
  if (!md.getDisplayMedia) return null;
  try {
    return await md.getDisplayMedia({ video: true, audio: true });
  } catch {
    return null;
  }
}

export function stopTracks(stream: MediaStream | null) {
  if (!stream) return;
  for (const t of stream.getTracks()) t.stop();
}

// --- Hand raises (local only, for demo) ---

const HANDS_KEY = (sessionId: string) => `tv.live.hands.${sessionId}`;

export function toggleHand(sessionId: string, email: string): boolean {
  if (typeof window === "undefined") return false;
  let set = new Set<string>();
  try {
    set = new Set(JSON.parse(localStorage.getItem(HANDS_KEY(sessionId)) || "[]"));
  } catch {
    // keep empty
  }
  if (set.has(email)) set.delete(email);
  else set.add(email);
  localStorage.setItem(HANDS_KEY(sessionId), JSON.stringify([...set]));
  return set.has(email);
}

export function handsUp(sessionId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HANDS_KEY(sessionId)) || "[]") as string[];
  } catch {
    return [];
  }
}
