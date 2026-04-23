// Seed question bank. Deterministically mapped to a date so every user
// sees the same set on any given day — that's the point: daily social
// competition requires a shared canvas.
//
// Phase 5 will replace this with a generator fed by yesterday's NSE/BSE
// tape. The shape stays the same.

export type ChartSeries = { label: string; points: number[] };

export type Question =
  | {
      id: string;
      kind: "pattern";
      symbol: string;
      interval: string;
      date: string;
      prompt: string;
      series: ChartSeries;
      options: string[];
      answer: number; // index into options
      explain: string;
    }
  | {
      id: string;
      kind: "level";
      symbol: string;
      interval: string;
      date: string;
      prompt: string;
      series: ChartSeries;
      levels: number[]; // candidate y-values
      answer: number; // index into levels (the correct support/resistance)
      options: string[]; // human labels for each level
      explain: string;
    }
  | {
      id: string;
      kind: "fundamental";
      prompt: string;
      options: string[];
      answer: number;
      explain: string;
    }
  // Class 2 — Chart Matching.
  | {
      id: string;
      kind: "match";
      prompt: string;
      // Always 4 mini-charts. Player picks the one that matches the prompt.
      charts: ChartSeries[];
      options: string[]; // human labels shown beneath each chart
      answer: number;
      explain: string;
    }
  // Class 3 — Indicator Reasoning.
  | {
      id: string;
      kind: "indicator";
      indicator: "RSI" | "MACD" | "Bollinger";
      prompt: string;
      // One row per candidate. Pick the row that satisfies the prompt.
      rows: { symbol: string; value: number }[];
      answer: number;
      explain: string;
    };

const BANK: Question[] = [
  {
    id: "q-pattern-reliance-flag",
    kind: "pattern",
    symbol: "RELIANCE",
    interval: "15m",
    date: "yesterday",
    prompt:
      "RELIANCE, 15m. After the sharp run-up in the morning, what pattern is forming in the consolidation zone?",
    series: {
      label: "RELIANCE",
      points: [
        10, 14, 18, 22, 28, 34, 40, 44, 46, 42, 44, 41, 43, 40, 42, 40, 42, 48, 56,
      ],
    },
    options: ["Head & Shoulders", "Bull Flag", "Double Top", "Descending Triangle"],
    answer: 1,
    explain:
      "Strong up-move followed by a shallow, downward-sloping consolidation on lower volume is a textbook bull flag — a continuation pattern.",
  },
  {
    id: "q-pattern-tcs-doublebottom",
    kind: "pattern",
    symbol: "TCS",
    interval: "1d",
    date: "yesterday",
    prompt: "TCS, daily. The last 3 weeks of price action most closely resembles…",
    series: {
      label: "TCS",
      points: [
        40, 36, 32, 26, 22, 20, 22, 26, 30, 28, 24, 20, 22, 28, 32, 36, 40, 42,
      ],
    },
    options: ["Rising Wedge", "Double Bottom", "Ascending Triangle", "Bear Flag"],
    answer: 1,
    explain:
      "Two distinct lows at similar price, separated by a rally, followed by a break above the interim high — classic double bottom.",
  },
  {
    id: "q-level-hdfc-support",
    kind: "level",
    symbol: "HDFCBANK",
    interval: "1h",
    date: "yesterday",
    prompt:
      "HDFCBANK, 1h. Which dashed level is acting as the clearest short-term support?",
    series: {
      label: "HDFCBANK",
      points: [
        40, 34, 30, 28, 34, 38, 32, 28, 30, 36, 40, 34, 30, 28, 32, 38, 42,
      ],
    },
    levels: [28, 35, 42],
    options: ["28 (lower dashed)", "35 (middle dashed)", "42 (upper dashed)"],
    answer: 0,
    explain:
      "Price has bounced from ~28 three separate times without closing below — that's the working support. 42 is resistance; 35 is a mid-range axis.",
  },
  {
    id: "q-fund-pe",
    kind: "fundamental",
    prompt:
      "A P/E ratio of 45 for a slow-growing FMCG large-cap, vs. sector average 28, most likely indicates…",
    options: [
      "The stock is undervalued",
      "The stock is priced for richer growth than peers",
      "Dividend yield will be high",
      "Book value is above market price",
    ],
    answer: 1,
    explain:
      "Higher P/E vs. peers generally reflects the market pricing in stronger expected growth, quality premium, or scarcity — not undervaluation.",
  },
  {
    id: "q-fund-marketcap",
    kind: "fundamental",
    prompt: "Market capitalization is calculated as…",
    options: [
      "Revenue × number of employees",
      "Share price × total outstanding shares",
      "Net profit × P/E ratio",
      "Book value × debt-equity ratio",
    ],
    answer: 1,
    explain:
      "Market cap = share price × shares outstanding. Separate from enterprise value, which adjusts for net debt.",
  },

  // --- Class 2: Chart Matching ---
  {
    id: "q-match-morning-rally-fade",
    kind: "match",
    prompt:
      "Which of these charts shows a strong morning rally that fades completely into a red close?",
    charts: [
      { label: "A", points: [20, 24, 30, 36, 42, 44, 42, 38, 32, 28, 22, 18] },
      { label: "B", points: [20, 18, 16, 14, 14, 16, 20, 24, 28, 32, 36, 40] },
      { label: "C", points: [30, 30, 31, 30, 30, 31, 30, 30, 31, 30, 29, 30] },
      { label: "D", points: [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 44] },
    ],
    options: ["Chart A", "Chart B", "Chart C", "Chart D"],
    answer: 0,
    explain:
      "A climbs hard into the midday high and then gives it all back by close — the classic morning-rally-fade. B is an afternoon reversal up; C is flat; D is a steady climb.",
  },
  {
    id: "q-match-double-bottom",
    kind: "match",
    prompt: "Which chart is forming a clean double bottom?",
    charts: [
      { label: "A", points: [40, 36, 32, 30, 32, 34, 36, 38, 40, 42, 44, 46] },
      { label: "B", points: [40, 32, 24, 20, 24, 30, 28, 22, 20, 24, 32, 40] },
      { label: "C", points: [20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64] },
      { label: "D", points: [40, 38, 36, 38, 42, 44, 42, 44, 46, 44, 46, 48] },
    ],
    options: ["Chart A", "Chart B", "Chart C", "Chart D"],
    answer: 1,
    explain:
      "B prints two distinct lows at ~20 with an interim rally to ~30 in between — the defining double bottom shape.",
  },
  {
    id: "q-match-reliance-breakout",
    kind: "match",
    prompt:
      "Which chart best matches: months of tight range, then a decisive breakout on the right side?",
    charts: [
      { label: "A", points: [30, 31, 29, 30, 32, 31, 30, 32, 31, 30, 38, 46] },
      { label: "B", points: [30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8] },
      { label: "C", points: [30, 34, 38, 34, 30, 34, 38, 34, 30, 34, 38, 34] },
      { label: "D", points: [10, 20, 30, 40, 50, 60, 50, 40, 30, 20, 10, 20] },
    ],
    options: ["Chart A", "Chart B", "Chart C", "Chart D"],
    answer: 0,
    explain:
      "A sits inside a ±2 band for most of the window, then breaks sharply higher at the end — that's a range-then-breakout profile.",
  },

  // --- Class 3: Indicator Reasoning ---
  {
    id: "q-ind-rsi-overbought",
    kind: "indicator",
    indicator: "RSI",
    prompt:
      "RSI > 70 is conventionally considered overbought. Which of these is most overbought right now?",
    rows: [
      { symbol: "RELIANCE", value: 62 },
      { symbol: "TCS", value: 48 },
      { symbol: "ADANIENT", value: 78 },
      { symbol: "HDFCBANK", value: 55 },
    ],
    answer: 2,
    explain:
      "ADANIENT at 78 is the only one above 70. Being overbought doesn't mean 'sell' — it means the recent momentum is stretched and a cool-off is more likely than usual.",
  },
  {
    id: "q-ind-rsi-oversold",
    kind: "indicator",
    indicator: "RSI",
    prompt:
      "RSI < 30 is conventionally considered oversold. Which of these fits that zone?",
    rows: [
      { symbol: "INFY", value: 42 },
      { symbol: "WIPRO", value: 27 },
      { symbol: "TATAMOTORS", value: 55 },
      { symbol: "SBIN", value: 38 },
    ],
    answer: 1,
    explain:
      "WIPRO at 27 is the only one below 30. Oversold readings often precede technical bounces but don't guarantee a reversal.",
  },
  {
    id: "q-ind-rsi-neutral",
    kind: "indicator",
    indicator: "RSI",
    prompt:
      "Which RSI value best describes a stock in a neutral, no-extreme zone?",
    rows: [
      { symbol: "MARUTI", value: 50 },
      { symbol: "ASIANPAINT", value: 81 },
      { symbol: "ITC", value: 23 },
      { symbol: "BAJFINANCE", value: 71 },
    ],
    answer: 0,
    explain:
      "50 is textbook neutral — the midpoint of the RSI scale. ITC is oversold; ASIANPAINT and BAJFINANCE are overbought.",
  },
];

/** Deterministic pseudo-random selection of N questions for a given date. */
export function dailyQuestions(date: Date, count = 5): Question[] {
  const key = date.toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;

  const pool = [...BANK];
  const picked: Question[] = [];
  while (picked.length < Math.min(count, BANK.length)) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const idx = seed % pool.length;
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function todayKey(now = new Date()): string {
  // Use local date (IST for Indian users in practice). Keep simple for V1.
  return now.toISOString().slice(0, 10);
}
