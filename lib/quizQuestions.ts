"use client";

// Finance & markets MCQ bank for the Quiz Floor (fests with
// eventType='quiz'). Two sources feed a quiz:
//
//   - Custom quizzes ship their own questions on the fest record.
//   - System quizzes draw a deterministic slice of this bank, seeded by
//     the 6-char quiz code so every player sees the SAME set — the same
//     shared-canvas rule the daily challenge uses.
//
// Phase 54+ (Question of the Day, Topic-wise practice) reuse this bank.

import type { Fest, FestQuestion } from "./fests";

export type QuizCategory =
  | "basics"
  | "technicals"
  | "options"
  | "fundamentals"
  | "macro"
  | "mutual-funds"
  | "taxation"
  | "history";

export type QuizDifficulty = "beginner" | "intermediate" | "advanced";

export type BankQuestion = FestQuestion & {
  category: QuizCategory;
  difficulty: QuizDifficulty;
};

export const QUIZ_BANK: BankQuestion[] = [
  // --- basics ---
  {
    id: "b-pe",
    category: "basics",
    difficulty: "beginner",
    prompt: "What does the P/E ratio stand for?",
    options: ["Price-to-Earnings", "Profit-to-Equity", "Price-to-Equity", "Profit-to-Earnings"],
    answer: 0,
    explain: "P/E = market price per share ÷ earnings per share.",
  },
  {
    id: "b-nifty",
    category: "basics",
    difficulty: "beginner",
    prompt: "Which index tracks 50 large stocks on the NSE?",
    options: ["SENSEX", "NIFTY 50", "BANKNIFTY", "NIFTY 500"],
    answer: 1,
    explain: "The NIFTY 50 is the NSE's flagship 50-stock benchmark.",
  },
  {
    id: "b-sensex",
    category: "basics",
    difficulty: "beginner",
    prompt: "The SENSEX is the benchmark index of which exchange?",
    options: ["NSE", "BSE", "MCX", "NCDEX"],
    answer: 1,
    explain: "The SENSEX (30 stocks) is the Bombay Stock Exchange's benchmark.",
  },
  {
    id: "b-bull",
    category: "basics",
    difficulty: "beginner",
    prompt: "In a 'bull market', prices are generally…",
    options: ["Falling", "Flat", "Rising", "Random"],
    answer: 2,
    explain: "A bull market is a sustained period of rising prices.",
  },
  {
    id: "b-dividend",
    category: "basics",
    difficulty: "beginner",
    prompt: "What is a dividend?",
    options: [
      "A loan from the company",
      "A share of profits paid to shareholders",
      "A type of bond",
      "A brokerage fee",
    ],
    answer: 1,
    explain: "Dividends distribute a portion of company profits to shareholders.",
  },
  {
    id: "b-ipo",
    category: "basics",
    difficulty: "beginner",
    prompt: "What is an IPO?",
    options: [
      "Internal Profit Offering",
      "Initial Public Offering",
      "Indian Portfolio Order",
      "Interim Payout Option",
    ],
    answer: 1,
    explain: "An IPO is a company's first sale of shares to the public.",
  },
  {
    id: "b-demat",
    category: "basics",
    difficulty: "beginner",
    prompt: "A demat account is used to…",
    options: [
      "Hold securities in electronic form",
      "Store physical share certificates",
      "Pay income tax",
      "Trade only commodities",
    ],
    answer: 0,
    explain: "Dematerialised accounts hold shares and securities electronically.",
  },

  // --- technicals ---
  {
    id: "t-rsi",
    category: "technicals",
    difficulty: "intermediate",
    prompt: "An RSI reading above 70 typically signals a stock is…",
    options: ["Oversold", "Overbought", "Fairly valued", "Delisted"],
    answer: 1,
    explain: "RSI > 70 is the classic overbought zone; < 30 is oversold.",
  },
  {
    id: "t-support",
    category: "technicals",
    difficulty: "intermediate",
    prompt: "'Support' is a price level where…",
    options: [
      "Selling tends to accelerate",
      "Buying tends to halt a decline",
      "Trading is suspended",
      "Dividends are paid",
    ],
    answer: 1,
    explain: "At support, demand has historically been strong enough to stop falls.",
  },
  {
    id: "t-golden",
    category: "technicals",
    difficulty: "intermediate",
    prompt: "A 'Golden Cross' occurs when…",
    options: [
      "The 50-day MA crosses above the 200-day MA",
      "The 200-day MA crosses above the 50-day MA",
      "Price hits an all-time high",
      "RSI crosses 50",
    ],
    answer: 0,
    explain: "A bullish Golden Cross is the 50-day average crossing above the 200-day.",
  },
  {
    id: "t-doji",
    category: "technicals",
    difficulty: "intermediate",
    prompt: "A candlestick 'doji' (open ≈ close) usually indicates…",
    options: ["Strong trend", "Indecision", "A gap up", "High dividends"],
    answer: 1,
    explain: "A doji shows buyers and sellers in balance — indecision.",
  },
  {
    id: "t-uptrend",
    category: "technicals",
    difficulty: "beginner",
    prompt: "Higher highs and higher lows describe…",
    options: ["A downtrend", "A range", "An uptrend", "A reversal"],
    answer: 2,
    explain: "Successively higher highs and lows define an uptrend.",
  },
  {
    id: "t-ma",
    category: "technicals",
    difficulty: "beginner",
    prompt: "A moving average is used to…",
    options: [
      "Smooth price over a period",
      "Predict dividends",
      "Measure volume only",
      "Calculate taxes",
    ],
    answer: 0,
    explain: "Moving averages smooth noisy prices to reveal the trend.",
  },

  // --- options ---
  {
    id: "o-call",
    category: "options",
    difficulty: "advanced",
    prompt: "A call option gives the holder the right to…",
    options: [
      "Sell the underlying at the strike",
      "Buy the underlying at the strike",
      "Receive a dividend",
      "Short the index",
    ],
    answer: 1,
    explain: "A call is the right (not obligation) to buy at the strike price.",
  },
  {
    id: "o-itm",
    category: "options",
    difficulty: "advanced",
    prompt: "A call option is 'in the money' when…",
    options: [
      "Underlying price is above the strike",
      "Underlying price is below the strike",
      "It expires worthless",
      "IV is zero",
    ],
    answer: 0,
    explain: "An ITM call has the spot above its strike — it has intrinsic value.",
  },
  {
    id: "o-theta",
    category: "options",
    difficulty: "advanced",
    prompt: "Option 'theta' measures sensitivity to…",
    options: ["Volatility", "Time decay", "Interest rates", "Dividends"],
    answer: 1,
    explain: "Theta is the rate an option loses value as time passes.",
  },
  {
    id: "o-maxloss",
    category: "options",
    difficulty: "advanced",
    prompt: "The maximum loss for buying a call option is…",
    options: [
      "Unlimited",
      "The strike price",
      "The premium paid",
      "The underlying's value",
    ],
    answer: 2,
    explain: "A long call's loss is capped at the premium you paid.",
  },
  {
    id: "o-iv",
    category: "options",
    difficulty: "advanced",
    prompt: "Rising implied volatility generally…",
    options: [
      "Lowers option premiums",
      "Raises option premiums",
      "Has no effect",
      "Only affects calls",
    ],
    answer: 1,
    explain: "Higher IV means bigger expected moves, so premiums rise.",
  },

  // --- fundamentals ---
  {
    id: "f-eps",
    category: "fundamentals",
    difficulty: "intermediate",
    prompt: "EPS stands for…",
    options: [
      "Equity Per Share",
      "Earnings Per Share",
      "Expense Per Share",
      "Earnings Profit Sum",
    ],
    answer: 1,
    explain: "EPS = net profit attributable to shareholders ÷ shares outstanding.",
  },
  {
    id: "f-de",
    category: "fundamentals",
    difficulty: "intermediate",
    prompt: "A high debt-to-equity ratio indicates…",
    options: [
      "Lower financial leverage",
      "More leverage / financial risk",
      "No debt",
      "Higher dividends guaranteed",
    ],
    answer: 1,
    explain: "A high D/E means the firm is financed more by debt — more risk.",
  },
  {
    id: "f-mcap",
    category: "fundamentals",
    difficulty: "beginner",
    prompt: "Market capitalization equals…",
    options: [
      "Share price × shares outstanding",
      "Revenue × profit margin",
      "Assets − liabilities",
      "EPS × dividend",
    ],
    answer: 0,
    explain: "Market cap = current share price multiplied by total shares.",
  },
  {
    id: "f-fcf",
    category: "fundamentals",
    difficulty: "advanced",
    prompt: "Free cash flow is roughly…",
    options: [
      "Revenue minus taxes",
      "Operating cash flow minus capital expenditure",
      "Net profit plus debt",
      "Dividends plus buybacks",
    ],
    answer: 1,
    explain: "FCF = cash from operations − capex; cash left after maintaining assets.",
  },

  // --- macro ---
  {
    id: "m-repo",
    category: "macro",
    difficulty: "intermediate",
    prompt: "When the RBI raises the repo rate, borrowing generally becomes…",
    options: ["Cheaper", "More expensive", "Unchanged", "Tax-free"],
    answer: 1,
    explain: "A higher repo rate lifts banks' cost of funds, so loans cost more.",
  },
  {
    id: "m-inflation",
    category: "macro",
    difficulty: "beginner",
    prompt: "Inflation measures…",
    options: [
      "The rate of rising prices",
      "Stock market returns",
      "Government debt",
      "Currency reserves",
    ],
    answer: 0,
    explain: "Inflation is the rate at which the general price level rises.",
  },
  {
    id: "m-gdp",
    category: "macro",
    difficulty: "beginner",
    prompt: "A country's GDP measures…",
    options: [
      "Total value of goods and services produced",
      "Total exports only",
      "Government spending only",
      "The stock index level",
    ],
    answer: 0,
    explain: "GDP is the total value of all goods and services produced in an economy.",
  },
  {
    id: "m-rupee",
    category: "macro",
    difficulty: "intermediate",
    prompt: "Rupee depreciation makes imports…",
    options: ["Cheaper", "More expensive", "Free", "Unaffected"],
    answer: 1,
    explain: "A weaker rupee means more rupees per dollar — imports cost more.",
  },

  // --- mutual funds ---
  {
    id: "mf-sip",
    category: "mutual-funds",
    difficulty: "beginner",
    prompt: "SIP stands for…",
    options: [
      "Single Investment Plan",
      "Systematic Investment Plan",
      "Secured Income Product",
      "Stock Index Portfolio",
    ],
    answer: 1,
    explain: "A SIP invests a fixed amount at regular intervals into a fund.",
  },
  {
    id: "mf-expense",
    category: "mutual-funds",
    difficulty: "intermediate",
    prompt: "A mutual fund's 'expense ratio' is…",
    options: [
      "A one-time entry fee",
      "The annual fee charged by the fund",
      "The fund's return",
      "A government tax",
    ],
    answer: 1,
    explain: "The expense ratio is the yearly cost of running the fund, as a % of assets.",
  },
  {
    id: "mf-index",
    category: "mutual-funds",
    difficulty: "beginner",
    prompt: "An index fund aims to…",
    options: [
      "Beat the market",
      "Track a market index",
      "Invest only in bonds",
      "Time the market",
    ],
    answer: 1,
    explain: "Index funds passively mirror an index like the NIFTY 50.",
  },

  // --- taxation ---
  {
    id: "tax-ltcg",
    category: "taxation",
    difficulty: "advanced",
    prompt: "In India, equity long-term capital gains apply after holding for…",
    options: [
      "More than 1 month",
      "More than 6 months",
      "More than 12 months",
      "More than 36 months",
    ],
    answer: 2,
    explain: "Listed equity held over 12 months qualifies for LTCG treatment.",
  },
  {
    id: "tax-stt",
    category: "taxation",
    difficulty: "advanced",
    prompt: "STT stands for…",
    options: [
      "Securities Transaction Tax",
      "Standard Trade Tariff",
      "Stock Transfer Toll",
      "Special Trading Term",
    ],
    answer: 0,
    explain: "STT is a tax levied on the value of securities traded on exchanges.",
  },

  // --- history ---
  {
    id: "h-2008",
    category: "history",
    difficulty: "intermediate",
    prompt: "The 2008 global financial crisis was largely triggered by…",
    options: [
      "US subprime mortgages",
      "Oil discovery",
      "A tech IPO bubble",
      "Indian monsoon failure",
    ],
    answer: 0,
    explain: "Defaults on US subprime mortgage-backed securities cascaded worldwide.",
  },
];

// Deterministic PRNG (mulberry32) so a given quiz code always yields the
// same question slice for every player.
function seedFromCode(code: string): number {
  let h = 1779033703 ^ code.length;
  for (let i = 0; i < code.length; i++) {
    h = Math.imul(h ^ code.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DEFAULT_QUIZ_LENGTH = 8;
export const MAX_QUIZ_LENGTH = 20;

/**
 * Resolve the ordered question set a player faces for a quiz.
 *
 * - Custom quizzes return their own stored questions (capped).
 * - System quizzes draw a deterministic slice of QUIZ_BANK seeded by the
 *   quiz code, preferring the quiz's difficulty and any matching
 *   categories, then back-filling so we always reach `count`.
 */
export function pickQuizQuestions(fest: Fest, count = DEFAULT_QUIZ_LENGTH): FestQuestion[] {
  if (fest.source === "custom" && fest.questions && fest.questions.length > 0) {
    return fest.questions.slice(0, MAX_QUIZ_LENGTH);
  }

  const rand = mulberry32(seedFromCode(fest.id));
  const wantCats = (fest.categories ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);

  const matchesDifficulty = (q: BankQuestion) =>
    !fest.difficulty || q.difficulty === fest.difficulty;
  const matchesCategory = (q: BankQuestion) =>
    wantCats.length === 0 || wantCats.some((c) => q.category.includes(c) || c.includes(q.category));

  // Tier the bank: best matches first, then progressively looser, so we
  // always fill `count` even for a narrow difficulty/category combo.
  const tier1 = QUIZ_BANK.filter((q) => matchesDifficulty(q) && matchesCategory(q));
  const tier2 = QUIZ_BANK.filter((q) => matchesDifficulty(q) && !matchesCategory(q));
  const tier3 = QUIZ_BANK.filter((q) => !matchesDifficulty(q));

  const ordered = [
    ...seededShuffle(tier1, rand),
    ...seededShuffle(tier2, rand),
    ...seededShuffle(tier3, rand),
  ];

  const seen = new Set<string>();
  const out: FestQuestion[] = [];
  for (const q of ordered) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push({ id: q.id, prompt: q.prompt, options: q.options, answer: q.answer, explain: q.explain });
    if (out.length >= count) break;
  }
  return out;
}
