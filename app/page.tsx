export default function Home() {
  return (
    <main className="relative min-h-screen">
      <div className="bg-grid absolute inset-0 -z-10 opacity-40" />
      <section className="mx-auto max-w-6xl px-6 pt-28 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1 text-xs text-ink-300">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          V1 — pure skill, zero money, zero KYC
        </div>
        <h1 className="mt-6 text-balance text-5xl font-semibold leading-tight md:text-7xl">
          Markets as a <span className="text-brand-500">daily skill game</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-ink-300">
          TradeVerse turns live NSE/BSE data into a 5-minute daily chart
          challenge and a friend-league you play with your group chat. Not a
          trading app. Never.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
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
        <p className="mt-6 text-xs text-ink-500">
          Mathiks for markets · Duolingo for instinct · WhatsApp for the social
          spine
        </p>
      </section>
    </main>
  );
}
