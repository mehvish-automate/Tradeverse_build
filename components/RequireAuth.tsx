"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/session";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loaded } = useSession();

  useEffect(() => {
    if (loaded && !user) router.replace("/signin");
  }, [loaded, user, router]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center text-sm text-ink-400">
        Loading…
      </div>
    );
  }
  if (!user) return null;

  return <>{children}</>;
}
