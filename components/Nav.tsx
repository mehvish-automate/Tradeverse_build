import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/80 bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
          TradeVerse
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-300 md:flex">
          <a href="#how" className="hover:text-ink-50">How it works</a>
          <a href="#heroes" className="hover:text-ink-50">Game modes</a>
          <a href="#who" className="hover:text-ink-50">Who it&apos;s for</a>
          <a href="#faq" className="hover:text-ink-50">FAQ</a>
        </nav>
        <a
          href="#waitlist"
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-brand-300"
        >
          Join waitlist
        </a>
      </div>
    </header>
  );
}
