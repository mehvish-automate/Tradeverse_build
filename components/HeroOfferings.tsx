import { Section } from "./Section";

export function HeroOfferings() {
  return (
    <Section
      id="heroes"
      eyebrow="Hero offerings"
      title="Two modes. One muscle: market instinct."
      kicker="Everything else is supporting cast. H1 builds the daily habit. H2 builds the social loop."
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <OfferingCard
          badge="H1"
          title="Daily Chart Challenge"
          tagline="5–10 visual questions a day. 3–5 minutes. Scored on accuracy + speed."
          bullets={[
            "System-generated from yesterday's real NSE/BSE tape",
            "Patterns, charts, support/resistance, fundamentals",
            "Streaks, XP, and a press moment: \"I learned chart reading in 10 days\"",
            "Regulation-safe by construction — no tips, no recommendations",
          ]}
          why="D30 retention engine."
          preview={<ChartPreview />}
        />

        <OfferingCard
          badge="H2"
          title="Friend Leagues"
          tagline="3–20 friends. Same questions. Weekly leaderboard. Zero money."
          bullets={[
            "WhatsApp-native invites — 2 taps from group chat to league",
            "Ranked by accuracy and speed, not capital",
            "Weekly cycle with a clean reset — no compounding advantage",
            "India-flavored social loop, zero regulatory exposure",
          ]}
          why="The virality engine."
          preview={<LeaguePreview />}
        />
      </div>
    </Section>
  );
}

function OfferingCard({
  badge,
  title,
  tagline,
  bullets,
  why,
  preview,
}: {
  badge: string;
  title: string;
  tagline: string;
  bullets: string[];
  why: string;
  preview: React.ReactNode;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/40">
      <div className="border-b border-ink-700/70 bg-ink-950/40 p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-300">
            {badge}
          </span>
          <h3 className="text-2xl font-semibold">{title}</h3>
        </div>
        <p className="mt-3 text-ink-300">{tagline}</p>
      </div>

      <div className="p-6">{preview}</div>

      <ul className="space-y-2 px-6 pb-6 text-sm text-ink-300">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-brand-500" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="border-t border-ink-700/70 bg-ink-950/40 px-6 py-4 text-xs text-ink-500">
        <span className="text-ink-300">Why it matters — </span>
        {why}
      </div>
    </article>
  );
}

function ChartPreview() {
  const points = [
    [0, 30], [10, 20], [20, 28], [30, 18], [40, 24],
    [50, 12], [60, 20], [70, 8], [80, 14], [90, 4], [100, 10],
  ] as const;
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-950 p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-ink-500">
        <span>RELIANCE · 5m · Apr 21</span>
        <span className="font-mono">+1.8%</span>
      </div>
      <svg viewBox="0 0 100 36" className="h-24 w-full">
        <defs>
          <linearGradient id="h1g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L 100 36 L 0 36 Z`} fill="url(#h1g)" />
        <path d={d} fill="none" stroke="#10b981" strokeWidth="1.3" />
      </svg>
      <div className="mt-3 grid grid-cols-4 gap-1 text-[11px]">
        {["Bullish flag", "Double top", "Ascending ▲", "Bear pennant"].map(
          (t, i) => (
            <span
              key={t}
              className={
                "rounded border px-2 py-1 text-center " +
                (i === 2
                  ? "border-brand-500 bg-brand-500/10 text-ink-50"
                  : "border-ink-700 text-ink-400")
              }
            >
              {t}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function LeaguePreview() {
  const rows = [
    { name: "you", score: 4820, delta: "+320", me: true },
    { name: "ananya_b", score: 4605, delta: "+280" },
    { name: "rohan.98", score: 4410, delta: "+150" },
    { name: "kabir_m", score: 3980, delta: "+90" },
  ];
  return (
    <div className="rounded-lg border border-ink-700/70 bg-ink-950 p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-ink-500">
        <span>IIM-B Finance Club · Week 14</span>
        <span>3d 11h left</span>
      </div>
      <ul className="divide-y divide-ink-900">
        {rows.map((r, i) => (
          <li
            key={r.name}
            className={
              "flex items-center justify-between py-2 text-sm " +
              (r.me ? "text-ink-50" : "text-ink-300")
            }
          >
            <span className="flex items-center gap-3">
              <span
                className={
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                  (i === 0
                    ? "bg-brand-500 text-ink-950"
                    : "bg-ink-900 text-ink-300")
                }
              >
                {i + 1}
              </span>
              <span>@{r.name}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-mono">{r.score}</span>
              <span className="text-xs text-brand-300">{r.delta}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
