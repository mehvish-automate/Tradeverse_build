import { Section } from "./Section";

const personas = [
  {
    id: "rohan",
    name: "Rohan · the curious first-jobber",
    tag: "Primary",
    age: "22–28 · ₹30K–₹80K/mo · Tier 1/2",
    jtbd:
      "I want to feel like I understand the stock market without feeling like an idiot or losing money.",
    signals: [
      "Heard of Zerodha, hasn't opened an account (or opened & abandoned)",
      "40+ min/day on Instagram · WhatsApp · Dream11",
    ],
  },
  {
    id: "ananya",
    name: "Ananya · the campus enthusiast",
    tag: "Secondary",
    age: "18–22 · college finance / investment club",
    jtbd: "I want to win something with my friends and look smart doing it.",
    signals: ["Time-rich, social-active, no income yet", "IIT / NIT / IIM / top commerce"],
  },
];

const nonPersonas = [
  "Active retail traders (Zerodha's user)",
  "Passive long-term SIP investors (Groww's user)",
  "Under-18 users (age-gated at signup)",
];

export function Personas() {
  return (
    <Section
      id="who"
      eyebrow="Who it's for"
      title="Built for curious beginners. Not for traders. Not for kids."
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {personas.map((p) => (
          <article
            key={p.id}
            className="rounded-xl border border-ink-700 bg-ink-900/40 p-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-brand-300">
                {p.tag}
              </span>
              <span className="text-xs text-ink-500">{p.age}</span>
            </div>
            <h3 className="mt-2 text-xl font-semibold">{p.name}</h3>
            <blockquote className="mt-3 border-l-2 border-brand-500 pl-3 text-sm italic text-ink-200">
              &ldquo;{p.jtbd}&rdquo;
            </blockquote>
            <ul className="mt-4 space-y-1.5 text-sm text-ink-300">
              {p.signals.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-ink-500" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-ink-700 bg-ink-950/60 p-6">
        <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
          Explicit non-personas
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-ink-300 md:grid-cols-3">
          {nonPersonas.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="text-ink-600">✕</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
