"use client";

// Reusable comms composer. The caller fixes the audience (+ optional
// recipient list) and which channels are offered; this handles channel
// choice, subject/body, validation, and send through the active provider.

import { useState } from "react";

import {
  Campaign,
  CommsAudience,
  CommsChannel,
  commsProvider,
  validateCampaign,
} from "@/lib/comms";

const CHANNEL_LABEL: Record<CommsChannel, string> = {
  inapp: "In-app (inbox)",
  email: "Email",
  whatsapp: "WhatsApp",
};

export function CommsComposer({
  audience,
  audienceRef,
  recipients,
  label,
  channels,
  onSent,
}: {
  audience: CommsAudience;
  audienceRef?: string;
  recipients?: string[];
  label: string;
  channels: CommsChannel[];
  onSent?: (c: Campaign) => void;
}) {
  const [channel, setChannel] = useState<CommsChannel>(channels[0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onSend() {
    const input = { audience, audienceRef, channel, subject, body, recipients };
    const err = validateCampaign(input);
    if (err) {
      setError(err);
      setResult(null);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const c = await commsProvider().send(input);
      setResult(
        c.status === "sent"
          ? `Sent in-app to ${label} — it's in their inbox.`
          : `Queued ${c.recipientCount} ${CHANNEL_LABEL[channel]} recipient(s). Connect a ${CHANNEL_LABEL[channel]} provider to actually deliver.`,
      );
      setSubject("");
      setBody("");
      onSent?.(c);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      {channels.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {channels.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={
                "rounded-md border px-3 py-1.5 text-xs transition " +
                (c === channel
                  ? "border-brand-500 bg-brand-500/10 text-ink-50"
                  : "border-ink-700 text-ink-300 hover:border-ink-500")
              }
            >
              {CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
      )}

      <div className="text-xs text-ink-500">
        Sending <span className="text-ink-300">{CHANNEL_LABEL[channel]}</span> to{" "}
        <span className="text-ink-300">{label}</span>
      </div>

      <input
        className="input"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={120}
      />
      <textarea
        className="input min-h-[120px]"
        placeholder="Your message…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
      />

      {error && <p className="text-sm text-red-300">{error}</p>}
      {result && (
        <p className="rounded-md border border-brand-500/30 bg-brand-500/5 px-3 py-2 text-sm text-brand-200">
          {result}
        </p>
      )}

      <button
        onClick={onSend}
        disabled={sending}
        className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
