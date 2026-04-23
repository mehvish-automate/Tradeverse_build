export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer id="faq" className="border-t border-ink-900 bg-ink-950">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
        <div className="col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
            TradeVerse
          </div>
          <p className="mt-3 max-w-xs text-sm text-ink-400">
            Skill-game for Indian markets. Daily chart challenges. Friend
            trade floors. Zero real money.
          </p>
          <p className="mt-4 text-xs text-ink-500">
            © {year} TradeVerse. Not an investment advisor. Not a broker. Not a
            fantasy-money-games platform.
          </p>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
            Product
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink-300">
            <li><a href="#heroes" className="hover:text-ink-50">Daily Challenge</a></li>
            <li><a href="#heroes" className="hover:text-ink-50">Trade Floors</a></li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
            FAQ
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink-300">
            <li>
              <span className="text-ink-100">Is this a trading app?</span>{" "}
              <span className="text-ink-500">No. We never touch real money.</span>
            </li>
            <li>
              <span className="text-ink-100">Do I need a demat?</span>{" "}
              <span className="text-ink-500">Never.</span>
            </li>
            <li>
              <span className="text-ink-100">Under 18?</span>{" "}
              <span className="text-ink-500">Gated at signup.</span>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
