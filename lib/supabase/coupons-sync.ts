"use client";

// Cloud mirror for the coupon wallet (own-rows RLS). Best-effort; the
// local wallet stays the read source of truth. No-op without env.

import { getBrowserSupabase } from "./client";
import type { Coupon } from "../coupons";

export async function mirrorCoupon(coupon: Coupon, _email: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return false;
  const row = {
    id: coupon.id,
    user_id: userId,
    def_id: coupon.defId,
    code: coupon.code,
    label: coupon.label,
    discount_pct: coupon.discountPct,
    perk: coupon.perk,
    source: coupon.source,
    used: coupon.used,
    created_at: new Date(coupon.createdAt).toISOString(),
  };
  const { error } = await (supabase.from("coupons") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "id" });
  return !error;
}
