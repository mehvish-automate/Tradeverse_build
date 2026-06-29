import { Section } from "./Section";

export function Vision() {
  return (
    <Section
      eyebrow="Vision & positioning"
      title="A daily 5-minute skill challenge Gen Z Indians take with their friends."
      kicker="For first-job Gen Z Indians (22–28) who find the stock market intimidating, TradeVerse is the only markets platform that turns live market data into a daily visual skill challenge and Quiz Floor — no trading, no real money."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Pillar
          eyebrow="Habit"
          title="Daily reps"
          body="Short daily sessions. Streaks. XP. Muscle memory for pattern recognition."
        />
        <Pillar
          eyebrow="Social"
          title="Play with friends"
          body="Quiz Floors with weekly cycles. Bragging rights over the group chat."
        />
        <Pillar
          eyebrow="Skill"
          title="Zero money"
          body="No brokerage, no KYC, no demat — ever. Competing on skill, not capital."
        />
      </div>
    </Section>
  );
}

function Pillar({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        {eyebrow}
      </div>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-ink-300">{body}</p>
    </div>
  );
}
