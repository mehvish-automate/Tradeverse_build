"use client";

import { useEffect, useState } from "react";

// Chrome / Edge / Android fire `beforeinstallprompt` when the PWA is
// installable; iOS Safari doesn't, so we detect it and show a short
// "tap Share → Add to Home Screen" hint instead.

type BipEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "tv.pwa.dismissed";

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BipEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Already installed (standalone display mode)?
    const mq = window.matchMedia("(display-mode: standalone)");
    if (
      mq.matches ||
      // iOS legacy check
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setStandalone(true);
      return;
    }

    const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    const isSafari =
      /Safari/.test(window.navigator.userAgent) &&
      !/CriOS|FxiOS|EdgiOS/.test(window.navigator.userAgent);

    if (isIos && isSafari) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BipEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const res = await deferred.userChoice;
    setDeferred(null);
    if (res.outcome === "accepted") {
      // Browsers will hide themselves but in case:
      setVisible(false);
    } else {
      dismiss();
    }
  }

  if (standalone) return null;
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install TradeVerse"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-brand-500/40 bg-ink-900/95 p-4 shadow-[0_0_40px_-10px_rgba(16,185,129,0.25)] backdrop-blur">
        <span className="text-2xl leading-none" aria-hidden>
          📲
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink-50">
            Install TradeVerse
          </div>
          <div className="mt-0.5 text-xs text-ink-300">
            {iosHint
              ? "Tap Share → Add to Home Screen to keep the daily habit one tap away."
              : "Add to your home screen to make the daily run one tap away."}
          </div>
          <div className="mt-3 flex gap-2">
            {!iosHint && deferred && (
              <button
                onClick={install}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
              >
                Install
              </button>
            )}
            <button
              onClick={dismiss}
              className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
