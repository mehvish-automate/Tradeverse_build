"use client";

// Comms engine (Phase 67). Compose a message, pick an audience + channel,
// send. In-app delivery works today (recipients' inboxes pull broadcasts);
// email / whatsapp are provider seams — registerCommsProvider() plugs in a
// real ESP / WhatsApp BSP later without touching call sites. Until then
// those channels record a "queued" campaign with the recipient count.

export type CommsChannel = "inapp" | "email" | "whatsapp";
export type CommsAudience = "all" | "event";

export type CampaignInput = {
  audience: CommsAudience;
  audienceRef?: string; // festId when audience = 'event'
  channel: CommsChannel;
  subject: string;
  body: string;
  /** Recipient emails for email/whatsapp channels (from the dashboard). */
  recipients?: string[];
};

export type Campaign = CampaignInput & {
  id: string;
  status: "sent" | "queued";
  recipientCount: number;
  createdAt: number;
};

export interface CommsProvider {
  /** Deliver/queue a campaign. Returns the persisted record. */
  send(input: CampaignInput): Promise<Campaign>;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const LOG_KEY = "tv.campaigns";

function readLog(): Campaign[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]") as Campaign[];
  } catch {
    return [];
  }
}

function writeLog(rows: Campaign[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(0, 200)));
}

export function campaignLog(): Campaign[] {
  return readLog().sort((a, b) => b.createdAt - a.createdAt);
}

export function validateCampaign(input: CampaignInput): string | null {
  if (!input.subject.trim()) return "Add a subject.";
  if (input.body.trim().length < 3) return "Write a message.";
  if (input.audience === "event" && !input.audienceRef) return "Pick an event.";
  if (
    (input.channel === "email" || input.channel === "whatsapp") &&
    (!input.recipients || input.recipients.length === 0)
  ) {
    return "No recipients for this channel yet.";
  }
  return null;
}

// Native provider: in-app → cloud broadcast (delivered via inbox pull);
// email/whatsapp → recorded as queued (real send awaits a provider).
const nativeProvider: CommsProvider = {
  async send(input) {
    const recipientCount =
      input.channel === "inapp" ? 0 : input.recipients?.length ?? 0;
    const status: Campaign["status"] = input.channel === "inapp" ? "sent" : "queued";
    const campaign: Campaign = {
      ...input,
      id: uuid(),
      status,
      recipientCount,
      createdAt: Date.now(),
    };

    // Cloud broadcast for in-app delivery (and as the campaign record).
    void (async () => {
      try {
        const { createBroadcast } = await import("./supabase/comms-sync");
        await createBroadcast(campaign);
      } catch {
        /* best-effort */
      }
    })();

    writeLog([campaign, ...readLog()]);
    return campaign;
  },
};

let active: CommsProvider = nativeProvider;

export function registerCommsProvider(p: CommsProvider): void {
  active = p;
}

export function commsProvider(): CommsProvider {
  return active;
}
