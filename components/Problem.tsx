import { Section } from "./Section";

const categories = [
  {
    tag: "Cockpits",
    name: "Zerodha · Groww",
    body: "Built for people who already know what they're doing. No scaffolding for the curious beginner.",
    tone: "neutral" as const,
  },
  {
    tag: "Gambling-adjacent",
    name: "Dream11-for-stocks",
    body: "Paid prediction contests. Regulatorily radioactive, ethically indefensible.",
    tone: "danger" as const,
  },
  {
    tag: "Missing category",
    name: "TradeVerse",
    body: "Daily-habit, social, skill-first, regulation-safe. Nothing else occupies this space.",
    tone: "brand" as const,
  },
];

export function Problem() {
  return (
    <Section
      id="how"
      eyebrow="The problem"
      title="15Cr+ demat accounts. Most users stay passive, intimidated and under-educated."
      kicker="Existing apps split into two flawed categories. The 22–28 year-old first-jobber — curious about markets, won't open a demat — has nowhere to go."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {categories.map((c) => (
          <article
            key={c.name}
            className={
              "rounded-xl border p-6 " +
              (c.tone === "brand"
                ? "border-brand-500/50 bg-brand-500/5"
                : c.tone === "danger"
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-ink-700 bg-ink-900/40")
            }
          >
            <div
              className={
                "text-xs font-medium uppercase tracking-wider " +
                (c.tone === "brand"
                  ? "text-brand-300"
                  : c.tone === "danger"
                    ? "text-red-300"
                    : "text-ink-500")
              }
            >
              {c.tag}
            </div>
            <h3 className="mt-2 text-xl font-semibold">{c.name}</h3>
            <p className="mt-3 text-sm text-ink-300">{c.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
