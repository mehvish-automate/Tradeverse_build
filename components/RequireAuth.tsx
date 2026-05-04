"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { useSession } from "@/lib/session";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loaded } = useSession();

  useEffect(() => {
    if (loaded && !user) router.replace("/signin");
  }, [loaded, user, router]);

  if (!loaded) {
    // Page-shaped skeleton so the layout doesn't shift when the real
    // content paints. Auth resolves in ~1 frame on warm sessions.
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-1/2 animate-pulse rounded-md bg-ink-900/60" />
          <Skeleton lines={2} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }
  if (!user) return null;

  return <>{children}</>;
}
