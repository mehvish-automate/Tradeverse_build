"use client";

// Fires a screen_view analytics event on every route change (and captures
// first-touch attribution on first load). Mounted once in the root layout.
// Deduped by pathname so re-renders don't double-count.

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { EV, captureAttribution, screenName, track } from "@/lib/analytics";

export function ScreenTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    track(EV.screenView, { screen: screenName(pathname), path: pathname });
  }, [pathname]);

  return null;
}
