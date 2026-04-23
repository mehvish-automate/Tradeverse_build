export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0 -z-10 opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl"
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pb-24 pt-20 md:grid-cols-5 md:pt-28">
        <div className="md:col-span-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1 text-xs text-ink-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            V1 — pure skill · zero money · zero KYC
          </div>

          <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Markets as a{" "}
            <span className="text-brand-500">daily skill game</span>.
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg text-ink-300">
            TradeVerse turns live NSE/BSE data into a 5-minute daily chart
            challenge and a trade floor you play with your group chat. Not a
            trading app. Never.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#waitlist"
              className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Join the waitlist
            </a>
            <a
              href="#how"
              className="rounded-lg border border-ink-700 px-5 py-3 text-sm font-medium text-ink-100 hover:bg-ink-900"
            >
              How it works
            </a>
          </div>

        </div>

        <div className="md:col-span-2">
          <HeroCard />
        </div>
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <div className="rounded-2xl border border-ink-700/70 bg-ink-900/60 p-5 shadow-[0_0_60px_-20px_rgba(16,185,129,0.35)]">
      <div className="flex items-center justify-between text-xs text-ink-300">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Today&apos;s Chart · Q3 of 5
        </span>
        <span className="font-mono text-ink-500">00:42</span>
      </div>

      <MiniChart />

      <p className="mt-4 text-sm text-ink-100">
        Which pattern is forming on NIFTY 50 between 10:45 and 14:30?
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Option label="Head &amp; Shoulders" />
        <Option label="Double Bottom" active />
        <Option label="Bull Flag" />
        <Option label="Descending Triangle" />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-ink-500">
        <span>Streak · 12 days</span>
        <span className="text-brand-300">+120 XP</span>
      </div>
    </div>
  );
}

function Option({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`rounded-lg border px-3 py-2 text-left transition ${
        active
          ? "border-brand-500 bg-brand-500/10 text-ink-50"
          : "border-ink-700 text-ink-300 hover:border-ink-500"
      }`}
      dangerouslySetInnerHTML={{ __html: label }}
    />
  );
}

function MiniChart() {
  // Decorative candle/line preview — not live data.
  const points = [
    [0, 38], [8, 32], [16, 34], [24, 28], [32, 30], [40, 22],
    [48, 26], [56, 18], [64, 14], [72, 20], [80, 26], [88, 22], [96, 12],
  ] as const;
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  return (
    <div className="mt-4 rounded-lg border border-ink-700/70 bg-ink-950 p-3">
      <svg viewBox="0 0 100 48" className="h-28 w-full">
        <defs>
          <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L 96 48 L 0 48 Z`} fill="url(#g)" />
        <path d={d} fill="none" stroke="#10b981" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
