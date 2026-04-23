// Curated "event portfolios" — scenario-based, sector-level allocations.
// A user reads the thesis, picks an allocation across the allowed sectors
// (and cash), and is scored at resolution. No buy/sell advice is given
// by us — the options are just the allowed sectors; the user decides.

import type { Sector } from "./stocks";

export type EventDef = {
  id: string;
  title: string;
  tagline: string;
  thesis: string[]; // paragraphs of context
  sectors: Sector[]; // selectable sectors for this event
  /** Days from today when the event was framed. Negative = in the past. */
  baseOffsetDays: number;
  /** Days from today when the event resolves. Positive = future. */
  resolveOffsetDays: number;
  rewardXp: number;
};

/**
 * Events are defined as offsets from "today" so the demo always has a mix
 * of open and resolved events without the dates going stale. Real-world
 * equivalent will pin absolute dates on creation.
 */
export const EVENTS: EventDef[] = [
  {
    id: "e-budget-2026",
    title: "Union Budget 2026 week",
    tagline: "Infra push vs. consumption tax tweaks. How are you positioned?",
    thesis: [
      "The Union Budget typically moves sectors in quick, uneven bursts. Infra and defence tend to pre-run on order-book hopes; consumer names are more reactive to direct tax changes.",
      "You've got a week to pick an allocation across the allowed sectors (or park it in cash). Your portfolio is scored at close on resolution day.",
      "Zero money, zero prescription — just your call.",
    ],
    sectors: ["Infra", "Consumer", "Banking", "Auto", "Metals"],
    baseOffsetDays: -60,
    resolveOffsetDays: -30,
    rewardXp: 250,
  },
  {
    id: "e-it-earnings",
    title: "IT earnings week",
    tagline: "Dollar revenue guidance meets margin pressure.",
    thesis: [
      "Indian IT services are mid-earnings. Cross-currents: rupee weakness helps rupee revenue, but US BFSI softness hurts growth guidance.",
      "Pick your positioning across the allowed sectors — IT obviously, plus some defensives and cash if you want to express caution.",
    ],
    sectors: ["IT", "FMCG", "Pharma", "Banking"],
    baseOffsetDays: -10,
    resolveOffsetDays: 7,
    rewardXp: 200,
  },
  {
    id: "e-auto-festive",
    title: "Festive-season auto check",
    tagline: "Tractor and 2W volumes read through to auto + financiers.",
    thesis: [
      "Festive retail is the single most-watched volume window for Indian auto. Financiers (NBFCs in banking) lead or lag based on rural credit demand.",
      "You have the auto complex, banking, and metals to play with. Over-allocate and get punished if the festive number disappoints.",
    ],
    sectors: ["Auto", "Banking", "Metals", "Consumer"],
    baseOffsetDays: 0,
    resolveOffsetDays: 14,
    rewardXp: 200,
  },
];

export function baseDate(def: EventDef): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + def.baseOffsetDays);
  return d;
}

export function resolveDate(def: EventDef): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + def.resolveOffsetDays);
  return d;
}

export function isResolved(def: EventDef, now = new Date()): boolean {
  return now.getTime() >= resolveDate(def).getTime();
}

export function getEvent(id: string): EventDef | null {
  return EVENTS.find((e) => e.id === id) ?? null;
}
