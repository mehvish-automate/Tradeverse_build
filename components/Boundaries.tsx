import { Section } from "./Section";

const notBuilding = [
  { t: "Real-money trading, broker integration, KYC, demat", why: "Locked out permanently" },
  { t: "Paid-entry cash-prize contests in V1/V2", why: "V3 only, separate gaming-law entity" },
  { t: "Personalized investment advice / buy-sell tips", why: "SEBI finfluencer rules" },
  { t: "Copy-trading", why: "Requires RIA license + real-money rails we've killed" },
  { t: "Crypto, NFTs, F&O, derivatives", why: "Scope + regulatory" },
  { t: "Hindi / Tamil / regional UI", why: "English only, permanently" },
];

export function Boundaries() {
  return (
    <Section
      eyebrow="Non-goals — LOCKED"
      title="Things we will never build."
      kicker={`This list is the product. Every "no" below is what makes the "yes" — a daily skill game — actually work.`}
    >
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {notBuilding.map((n) => (
          <li
            key={n.t}
            className="rounded-xl border border-ink-700 bg-ink-900/40 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-300">
                No
              </span>
              <div>
                <div className="text-sm text-ink-100">{n.t}</div>
                <div className="mt-1 text-xs text-ink-500">{n.why}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
