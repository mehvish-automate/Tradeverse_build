// Seed universe for virtual portfolios. Static company metadata and a
// deterministic daily price model so every user sees the same price
// history for a given date.
//
// Phase 5+ can swap the price() function for real NSE EOD data without
// changing any caller.

export type Sector =
  | "IT"
  | "Banking"
  | "FMCG"
  | "Auto"
  | "Pharma"
  | "Energy"
  | "Telecom"
  | "Metals"
  | "Infra"
  | "Consumer";

export type AssetClass = "stock" | "etf" | "index";

export type StockMarketRegion = "IN" | "UAE" | "US";

export type Stock = {
  symbol: string;
  name: string;
  sector: Sector;
  basePrice: number;
  // Trend in % per year. Mock: affects the deterministic walk.
  drift: number;
  // Volatility target (daily, in %).
  vol: number;
  assetClass?: AssetClass; // default "stock"
  /** Symbols inside our universe that live in the Nifty 50 proxy. */
  nifty50?: boolean;
  /** Symbols inside our universe that live in the Nifty 100 proxy. */
  nifty100?: boolean;
  /** Market region; defaults to IN since the V1 catalog is Indian-only. */
  marketRegion?: StockMarketRegion;
};

export const STOCKS: Stock[] = [
  { symbol: "RELIANCE",   name: "Reliance Industries",     sector: "Energy",   basePrice: 2820, drift: 12, vol: 1.5 },
  { symbol: "TCS",        name: "Tata Consultancy",        sector: "IT",       basePrice: 3910, drift: 10, vol: 1.3 },
  { symbol: "INFY",       name: "Infosys",                 sector: "IT",       basePrice: 1520, drift:  9, vol: 1.6 },
  { symbol: "HDFCBANK",   name: "HDFC Bank",               sector: "Banking",  basePrice: 1640, drift:  8, vol: 1.4 },
  { symbol: "ICICIBANK",  name: "ICICI Bank",              sector: "Banking",  basePrice: 1180, drift: 11, vol: 1.5 },
  { symbol: "SBIN",       name: "State Bank of India",     sector: "Banking",  basePrice:  820, drift:  7, vol: 1.7 },
  { symbol: "ITC",        name: "ITC",                     sector: "FMCG",     basePrice:  460, drift:  6, vol: 1.1 },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever",      sector: "FMCG",     basePrice: 2420, drift:  5, vol: 1.0 },
  { symbol: "NESTLEIND",  name: "Nestle India",            sector: "FMCG",     basePrice: 2490, drift:  6, vol: 1.1 },
  { symbol: "MARUTI",     name: "Maruti Suzuki",           sector: "Auto",     basePrice:12860, drift:  9, vol: 1.6 },
  { symbol: "TATAMOTORS", name: "Tata Motors",             sector: "Auto",     basePrice:  990, drift: 14, vol: 2.0 },
  { symbol: "M&M",        name: "Mahindra & Mahindra",     sector: "Auto",     basePrice: 2610, drift: 11, vol: 1.7 },
  { symbol: "SUNPHARMA",  name: "Sun Pharmaceutical",      sector: "Pharma",   basePrice: 1760, drift:  8, vol: 1.4 },
  { symbol: "CIPLA",      name: "Cipla",                   sector: "Pharma",   basePrice: 1490, drift:  7, vol: 1.3 },
  { symbol: "ONGC",       name: "ONGC",                    sector: "Energy",   basePrice:  270, drift:  5, vol: 1.8 },
  { symbol: "NTPC",       name: "NTPC",                    sector: "Energy",   basePrice:  360, drift:  6, vol: 1.4 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel",           sector: "Telecom",  basePrice: 1380, drift: 13, vol: 1.5 },
  { symbol: "TATASTEEL",  name: "Tata Steel",              sector: "Metals",   basePrice:  160, drift:  8, vol: 2.2 },
  { symbol: "HINDALCO",   name: "Hindalco",                sector: "Metals",   basePrice:  640, drift:  9, vol: 2.1 },
  { symbol: "LT",         name: "Larsen & Toubro",         sector: "Infra",    basePrice: 3580, drift: 12, vol: 1.5 },
  { symbol: "ADANIPORTS", name: "Adani Ports",             sector: "Infra",    basePrice: 1340, drift: 14, vol: 2.0 },
  { symbol: "ASIANPAINT", name: "Asian Paints",            sector: "Consumer", basePrice: 2790, drift:  5, vol: 1.3 },
  { symbol: "TITAN",      name: "Titan Company",           sector: "Consumer", basePrice: 3410, drift: 11, vol: 1.6 },
  { symbol: "BAJFINANCE", name: "Bajaj Finance",           sector: "Banking",  basePrice: 7180, drift:  9, vol: 1.8 },
  { symbol: "AXISBANK",   name: "Axis Bank",               sector: "Banking",  basePrice: 1090, drift:  8, vol: 1.6 },
  // --- ETFs (sector / index trackers) ---
  { symbol: "NIFTYBEES",    name: "Nippon India ETF Nifty 50",        sector: "Infra",    basePrice:  245, drift:  9, vol: 1.0, assetClass: "etf"   },
  { symbol: "BANKBEES",     name: "Nippon India ETF Bank Nifty",      sector: "Banking",  basePrice:  480, drift:  9, vol: 1.2, assetClass: "etf"   },
  { symbol: "GOLDBEES",     name: "Nippon India ETF Gold BeES",       sector: "Consumer", basePrice:   62, drift:  8, vol: 0.8, assetClass: "etf"   },
  { symbol: "JUNIORBEES",   name: "Nippon India ETF Nifty Next 50",   sector: "Infra",    basePrice:  640, drift: 11, vol: 1.2, assetClass: "etf"   },
  { symbol: "ITBEES",       name: "Nippon India ETF Nifty IT",        sector: "IT",       basePrice:   42, drift: 10, vol: 1.4, assetClass: "etf"   },
  // --- Indices (index products for Nifty & sectoral) ---
  { symbol: "NIFTY50",      name: "Nifty 50 index",                    sector: "Infra",    basePrice:22000, drift:  9, vol: 1.0, assetClass: "index" },
  { symbol: "BANKNIFTY",    name: "Nifty Bank index",                  sector: "Banking",  basePrice:48000, drift:  9, vol: 1.3, assetClass: "index" },
  { symbol: "NIFTYIT",      name: "Nifty IT index",                    sector: "IT",       basePrice:36000, drift: 10, vol: 1.5, assetClass: "index" },
  { symbol: "NIFTYAUTO",    name: "Nifty Auto index",                  sector: "Auto",     basePrice:23500, drift: 11, vol: 1.6, assetClass: "index" },
  { symbol: "NIFTYPHARMA",  name: "Nifty Pharma index",                sector: "Pharma",   basePrice:17800, drift:  8, vol: 1.3, assetClass: "index" },
  // --- US (Phase 6 multi-region V0.1) ---
  { symbol: "AAPL",         name: "Apple",                    sector: "IT",       basePrice:  185, drift: 12, vol: 1.4, marketRegion: "US" },
  { symbol: "MSFT",         name: "Microsoft",                sector: "IT",       basePrice:  410, drift: 13, vol: 1.3, marketRegion: "US" },
  { symbol: "GOOGL",        name: "Alphabet",                 sector: "IT",       basePrice:  165, drift: 11, vol: 1.5, marketRegion: "US" },
  { symbol: "AMZN",         name: "Amazon",                   sector: "Consumer", basePrice:  185, drift: 12, vol: 1.6, marketRegion: "US" },
  { symbol: "NVDA",         name: "NVIDIA",                   sector: "IT",       basePrice:  920, drift: 25, vol: 2.4, marketRegion: "US" },
  { symbol: "META",         name: "Meta Platforms",           sector: "IT",       basePrice:  490, drift: 14, vol: 1.8, marketRegion: "US" },
  { symbol: "TSLA",         name: "Tesla",                    sector: "Auto",     basePrice:  175, drift: 10, vol: 3.0, marketRegion: "US" },
  { symbol: "JPM",          name: "JPMorgan Chase",           sector: "Banking",  basePrice:  205, drift:  8, vol: 1.3, marketRegion: "US" },
  { symbol: "V",            name: "Visa",                     sector: "Banking",  basePrice:  275, drift:  9, vol: 1.2, marketRegion: "US" },
  { symbol: "JNJ",          name: "Johnson & Johnson",        sector: "Pharma",   basePrice:  155, drift:  6, vol: 1.0, marketRegion: "US" },
  { symbol: "WMT",          name: "Walmart",                  sector: "Consumer", basePrice:   78, drift:  9, vol: 1.0, marketRegion: "US" },
  { symbol: "PG",           name: "Procter & Gamble",         sector: "FMCG",     basePrice:  165, drift:  6, vol: 0.9, marketRegion: "US" },
  { symbol: "XOM",          name: "Exxon Mobil",              sector: "Energy",   basePrice:  118, drift:  7, vol: 1.4, marketRegion: "US" },
  { symbol: "UNH",          name: "UnitedHealth",             sector: "Pharma",   basePrice:  525, drift:  9, vol: 1.3, marketRegion: "US" },
  // US ETFs / indices
  { symbol: "SPY",          name: "SPDR S&P 500",             sector: "Infra",    basePrice:  525, drift:  9, vol: 1.0, assetClass: "etf",   marketRegion: "US" },
  { symbol: "QQQ",          name: "Invesco QQQ (Nasdaq 100)", sector: "IT",       basePrice:  450, drift: 11, vol: 1.3, assetClass: "etf",   marketRegion: "US" },
  { symbol: "VOO",          name: "Vanguard S&P 500",         sector: "Infra",    basePrice:  475, drift:  9, vol: 1.0, assetClass: "etf",   marketRegion: "US" },
  { symbol: "DIA",          name: "SPDR Dow Jones",           sector: "Infra",    basePrice:  395, drift:  7, vol: 0.9, assetClass: "etf",   marketRegion: "US" },
  { symbol: "SP500",        name: "S&P 500 index",            sector: "Infra",    basePrice: 5300, drift:  9, vol: 1.0, assetClass: "index", marketRegion: "US" },
  { symbol: "NDX",          name: "Nasdaq 100 index",         sector: "IT",       basePrice:18800, drift: 11, vol: 1.3, assetClass: "index", marketRegion: "US" },
  // --- UAE ---
  { symbol: "EMAAR",        name: "Emaar Properties",         sector: "Infra",    basePrice:    8, drift:  9, vol: 1.4, marketRegion: "UAE" },
  { symbol: "FAB",          name: "First Abu Dhabi Bank",     sector: "Banking",  basePrice:   13, drift:  7, vol: 1.2, marketRegion: "UAE" },
  { symbol: "ADCB",         name: "Abu Dhabi Commercial Bank",sector: "Banking",  basePrice:    9, drift:  6, vol: 1.3, marketRegion: "UAE" },
  { symbol: "DIB",          name: "Dubai Islamic Bank",       sector: "Banking",  basePrice:    6, drift:  6, vol: 1.4, marketRegion: "UAE" },
  { symbol: "EMIRATESNBD",  name: "Emirates NBD",             sector: "Banking",  basePrice:   17, drift:  8, vol: 1.3, marketRegion: "UAE" },
  { symbol: "ETISALAT",     name: "Etisalat (e&)",            sector: "Telecom",  basePrice:   23, drift:  6, vol: 1.0, marketRegion: "UAE" },
  { symbol: "ADNOCDIST",    name: "ADNOC Distribution",       sector: "Energy",   basePrice:    4, drift:  8, vol: 1.5, marketRegion: "UAE" },
  { symbol: "DEWA",         name: "DEWA",                     sector: "Energy",   basePrice:    2, drift:  7, vol: 1.2, marketRegion: "UAE" },
  { symbol: "ADX",          name: "FTSE ADX General index",   sector: "Infra",    basePrice: 9400, drift:  8, vol: 1.1, assetClass: "index", marketRegion: "UAE" },
  { symbol: "DFMGI",        name: "Dubai Financial Market index", sector:"Infra", basePrice: 4200, drift:  7, vol: 1.2, assetClass: "index", marketRegion: "UAE" },
];

// Stamp the default market region (legacy India entries don't carry it
// explicitly), then mark Indian stock-typed rows as Nifty 50 / Nifty
// 100 members. The Indian catalog is small enough that every stock-
// typed Indian row is treated as both Nifty 50 and Nifty 100 — refine
// when it grows beyond 50 names. Non-India regions don't get the
// nifty flags (those filters are India-specific).
for (const s of STOCKS) {
  s.marketRegion = s.marketRegion ?? "IN";
  if (s.marketRegion === "IN" && (s.assetClass ?? "stock") === "stock") {
    s.nifty50 = true;
    s.nifty100 = true;
  }
}

export const ASSET_CLASSES: AssetClass[] = ["stock", "etf", "index"];

export function assetClassOf(s: Stock): AssetClass {
  return s.assetClass ?? "stock";
}

export const SECTORS: Sector[] = Array.from(
  new Set(STOCKS.map((s) => s.sector)),
) as Sector[];

export function getStock(symbol: string): Stock | null {
  return STOCKS.find((s) => s.symbol === symbol) ?? null;
}

// Phase 49 — universe filtering for trade-floor scoped trading.
//
// Trade-floor launches capture three independent universe constraints:
//   - stockUniverse.kind: "nifty50" | "nifty100" | "all"
//   - assetClasses[]:     "stocks" | "etfs" | "indices"  (plural)
//   - marketRegion:       "IN" | "UAE" | "US" | "GLOBAL"
//
// Until the catalog grows beyond Indian names, UAE/US/GLOBAL pickers
// will be empty — the trade ticket should surface that explicitly.

export type FloorUniverseConstraint = {
  universeKind: "nifty50" | "nifty100" | "all" | "custom-sectors" | "handpicked";
  customSectors?: string[];
  handpickedSymbols?: string[];
  assetClasses: ("stocks" | "etfs" | "indices")[];
  marketRegion: "IN" | "UAE" | "US" | "GLOBAL";
};

const ASSET_CLASS_PLURAL_MAP: Record<
  "stocks" | "etfs" | "indices",
  AssetClass
> = {
  stocks: "stock",
  etfs: "etf",
  indices: "index",
};

export function filterStocksForFloor(c: FloorUniverseConstraint): Stock[] {
  const allowedClasses = new Set<AssetClass>(
    c.assetClasses.map((p) => ASSET_CLASS_PLURAL_MAP[p]),
  );

  // GLOBAL = no region filter; otherwise must match the floor's region.
  const regionOk = (s: Stock): boolean => {
    if (c.marketRegion === "GLOBAL") return true;
    return (s.marketRegion ?? "IN") === c.marketRegion;
  };

  const universeOk = (s: Stock): boolean => {
    switch (c.universeKind) {
      case "nifty50":
        // Index/ETF rows that track Nifty 50 are still useful here.
        return Boolean(s.nifty50) || s.assetClass === "etf" || s.assetClass === "index";
      case "nifty100":
        return (
          Boolean(s.nifty100) || s.assetClass === "etf" || s.assetClass === "index"
        );
      case "all":
        return true;
      case "custom-sectors":
        return c.customSectors?.includes(s.sector) ?? false;
      case "handpicked":
        return c.handpickedSymbols?.includes(s.symbol) ?? false;
      default:
        return true;
    }
  };

  return STOCKS.filter(
    (s) => allowedClasses.has(s.assetClass ?? "stock") && regionOk(s) && universeOk(s),
  );
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

// Seeded Gaussian-ish noise in [-1, 1] range from (symbol, dayIdx).
function noise(symbol: string, dayIdx: number): number {
  let h = hash(`${symbol}|${dayIdx}`);
  // Mix twice and average for a smoother distribution.
  const a = ((h % 10000) / 10000) * 2 - 1;
  h = (h * 1103515245 + 12345) >>> 0;
  const b = ((h % 10000) / 10000) * 2 - 1;
  return (a + b) / 2;
}

const ANCHOR = new Date("2025-01-01T00:00:00Z").getTime();

export function dayIndex(date: Date): number {
  return Math.floor((date.getTime() - ANCHOR) / (24 * 60 * 60 * 1000));
}

/**
 * Deterministic EOD close for (symbol, date). Uses a geometric-ish walk
 * built from the anchor and the stock's drift + vol. The same (symbol,
 * date) pair always yields the same price on every device.
 */
export function price(symbol: string, date: Date): number {
  const s = getStock(symbol);
  if (!s) return 0;
  const d = Math.max(0, dayIndex(date));

  // Compounding drift.
  const dailyDrift = s.drift / 100 / 252;
  const trendFactor = Math.exp(dailyDrift * d);

  // Cumulative seeded "wiggle" so prices don't just monotonically drift.
  let wiggle = 0;
  // Walk using a coarser window so consecutive days look correlated.
  for (let k = 0; k < d; k++) {
    wiggle += noise(symbol, k) * (s.vol / 100);
  }
  // Dampen wiggle so prices don't explode over a long horizon.
  const dampened = wiggle / Math.max(1, Math.sqrt(d + 1) * 0.35);

  const multiplier = trendFactor * Math.exp(dampened);
  return +(s.basePrice * multiplier).toFixed(2);
}

/** Simple percent return from -> to (both dates). */
export function pctReturn(
  symbol: string,
  from: Date,
  to: Date,
): number {
  const p0 = price(symbol, from);
  const p1 = price(symbol, to);
  if (p0 <= 0) return 0;
  return +(((p1 - p0) / p0) * 100).toFixed(2);
}

/** Synthetic NIFTY 50 proxy: equal-weight of our full universe. */
/** Stocks only — used to anchor the Nifty proxy below. */
const STOCK_ONLY = STOCKS.filter((s) => (s.assetClass ?? "stock") === "stock");

export function niftyReturn(from: Date, to: Date): number {
  const sum = STOCK_ONLY.reduce((s, st) => s + pctReturn(st.symbol, from, to), 0);
  return +(sum / STOCK_ONLY.length).toFixed(2);
}

export function niftyPrice(date: Date): number {
  // Index level normalised to 22000 at anchor.
  const sum = STOCK_ONLY.reduce((s, st) => s + price(st.symbol, date), 0);
  const anchorSum = STOCK_ONLY.reduce((s, st) => s + st.basePrice, 0);
  return +((sum / anchorSum) * 22000).toFixed(2);
}
