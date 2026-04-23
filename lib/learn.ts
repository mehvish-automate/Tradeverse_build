// Skill-tree content for the Learn mode. Purely static — a curated
// progression from "know nothing" to "read a chart with intent".
// Each unit has a short explainer (shown by the lesson player) plus a
// small practice bank (2–3 questions). Completing a unit unlocks the
// next one in the same track.

import type { Question } from "./questions";

export type Lesson = {
  id: string;
  title: string;
  minutes: number;
  summary: string;
  explainer: string[]; // paragraphs shown before practice
  practice: Question[];
};

export type Track = {
  id: string;
  title: string;
  blurb: string;
  accent: "basics" | "patterns" | "levels" | "fundamentals" | "indicators" | "matching";
  lessons: Lesson[];
};

export const TRACKS: Track[] = [
  {
    id: "basics",
    title: "Basics",
    blurb: "What you're actually looking at when you open a chart.",
    accent: "basics",
    lessons: [
      {
        id: "b-chart-anatomy",
        title: "Chart anatomy",
        minutes: 3,
        summary: "Axes, timeframe, and what a candle is really saying.",
        explainer: [
          "A chart has two axes: price on the vertical, time on the horizontal. Each dot (or candle) is a single time-slice — 1 minute, 5 minutes, 1 day.",
          "A candle shows four numbers for that slice: open, high, low, close. Green = price ended higher than it started. Red = ended lower.",
          "Changing the timeframe changes the story. The same stock can look like a freefall on 5-minute and a steady climb on daily.",
        ],
        practice: [
          {
            id: "b1-q1",
            kind: "fundamental",
            prompt: "On a candle chart, a green (or hollow) candle means…",
            options: [
              "The stock was bought by foreign investors",
              "Close price was higher than open price for that slice",
              "Dividend was paid that day",
              "Volume was above average",
            ],
            answer: 1,
            explain:
              "Green / hollow = the candle closed above where it opened. Colour has nothing to do with dividends, volume, or who traded it.",
          },
          {
            id: "b1-q2",
            kind: "fundamental",
            prompt: "If a chart's timeframe is switched from 1D to 5m, the candles…",
            options: [
              "Become more meaningful because they're smaller",
              "Each represent a shorter window — more noise, less signal",
              "Always look more bullish",
              "Show average prices instead of actual trades",
            ],
            answer: 1,
            explain:
              "Shorter timeframes show shorter windows. Price moves more, but most of that movement is noise that gets smoothed out on daily or weekly.",
          },
        ],
      },
      {
        id: "b-volume",
        title: "Volume, basically",
        minutes: 3,
        summary: "Why the same move can mean two very different things.",
        explainer: [
          "Volume = number of shares traded in that slice. It tells you how committed the move was.",
          "A 2% rally on 5x average volume is a very different signal than a 2% rally on half the usual volume.",
          "Rule of thumb: trust moves that come with volume. Fade moves that come without it.",
        ],
        practice: [
          {
            id: "b2-q1",
            kind: "fundamental",
            prompt:
              "A stock breaks to a new 3-month high on volume well below its 20-day average. The most reasonable read is…",
            options: [
              "Strong breakout — pile in",
              "Weak breakout — participation is low, treat with caution",
              "Insider buying",
              "Delisting risk",
            ],
            answer: 1,
            explain:
              "Breakouts without volume often fail. Low participation means few buyers are willing to step up at new highs.",
          },
        ],
      },
    ],
  },

  {
    id: "patterns",
    title: "Patterns",
    blurb: "The shapes that repeat because human behaviour repeats.",
    accent: "patterns",
    lessons: [
      {
        id: "p-flag",
        title: "Flags & pennants",
        minutes: 4,
        summary: "Continuation patterns after a sharp move.",
        explainer: [
          "After a sharp rally, price often pauses in a tight, downward-sloping range before continuing higher. That pause is a bull flag.",
          "Two ingredients: a strong pole (the initial move) and a tight, shallow consolidation (the flag). Volume usually dries up inside the flag.",
          "Bear flags mirror the same shape after a sharp drop.",
        ],
        practice: [
          {
            id: "p1-q1",
            kind: "pattern",
            symbol: "RELIANCE",
            interval: "15m",
            date: "yesterday",
            prompt: "RELIANCE, 15m. Sharp rally, then a tight downward drift. What is it?",
            series: {
              label: "RELIANCE",
              points: [8, 14, 22, 30, 40, 48, 54, 52, 50, 48, 46, 45, 44, 50, 58, 64],
            },
            options: ["Head & Shoulders", "Bull Flag", "Double Top", "Rising Wedge"],
            answer: 1,
            explain:
              "Strong pole, shallow downward drift on lower volume, break back up — textbook bull flag.",
          },
          {
            id: "p1-q2",
            kind: "pattern",
            symbol: "INFY",
            interval: "1h",
            date: "yesterday",
            prompt: "Sharp decline, then a tight sideways/slightly-up drift. This is most like…",
            series: {
              label: "INFY",
              points: [50, 44, 36, 28, 20, 22, 24, 22, 24, 22, 20, 14, 8],
            },
            options: ["Bull Flag", "Bear Flag", "Double Bottom", "Cup & Handle"],
            answer: 1,
            explain:
              "Sharp drop (bear pole), tight drift against the move, then continuation down — bear flag.",
          },
        ],
      },
      {
        id: "p-double",
        title: "Double tops & bottoms",
        minutes: 4,
        summary: "The market testing a level — twice.",
        explainer: [
          "A double bottom is two distinct lows at roughly the same price, separated by a rally. It says buyers defended the level the second time.",
          "The pattern only confirms when price breaks above the interim high — that's the neckline.",
          "Double tops are the mirror: two highs at the same zone, rejected both times, confirmed on a break below the interim low.",
        ],
        practice: [
          {
            id: "p2-q1",
            kind: "pattern",
            symbol: "TCS",
            interval: "1d",
            date: "yesterday",
            prompt: "Two distinct lows at similar prices with a rally in between. This is…",
            series: {
              label: "TCS",
              points: [40, 34, 28, 22, 20, 24, 30, 32, 28, 22, 20, 24, 32, 38, 42],
            },
            options: ["Ascending Triangle", "Double Bottom", "Bear Flag", "Head & Shoulders"],
            answer: 1,
            explain:
              "Two lows at ~20, a rally to ~32 in between, then a break above that 32 — double bottom confirmed.",
          },
        ],
      },
    ],
  },

  {
    id: "levels",
    title: "Levels",
    blurb: "Support, resistance, and why round numbers matter.",
    accent: "levels",
    lessons: [
      {
        id: "l-sr",
        title: "Support & resistance",
        minutes: 4,
        summary: "Price has memory. Here's where it remembers.",
        explainer: [
          "Support is a price zone where buyers have repeatedly stepped in. Resistance is where sellers have repeatedly stepped in.",
          "Levels matter because a lot of people are watching the same levels — a self-fulfilling coordination game.",
          "When support breaks, it often becomes resistance on the way back up. This is called a role-reversal.",
        ],
        practice: [
          {
            id: "l1-q1",
            kind: "level",
            symbol: "HDFCBANK",
            interval: "1h",
            date: "yesterday",
            prompt:
              "HDFCBANK, 1h. Which dashed level is acting as the clearest short-term support?",
            series: {
              label: "HDFCBANK",
              points: [40, 34, 30, 28, 34, 38, 32, 28, 30, 36, 40, 34, 30, 28, 32, 38, 42],
            },
            levels: [28, 35, 42],
            options: ["28 (lower dashed)", "35 (middle dashed)", "42 (upper dashed)"],
            answer: 0,
            explain:
              "Price bounced from ~28 three separate times without closing below — that's working support. 42 is resistance; 35 is a mid-range axis.",
          },
          {
            id: "l1-q2",
            kind: "fundamental",
            prompt: "A stock breaks below 500, then rallies back to 500. What often happens at 500?",
            options: [
              "It becomes new support",
              "It becomes new resistance (role reversal)",
              "It is no longer relevant",
              "The rally always continues past it",
            ],
            answer: 1,
            explain:
              "Former support often flips to resistance once broken. Lots of trapped longs are waiting to get out flat at that level.",
          },
        ],
      },
    ],
  },

  {
    id: "indicators",
    title: "Indicators",
    blurb: "When raw price isn't enough. RSI, the most-used oscillator.",
    accent: "indicators",
    lessons: [
      {
        id: "i-rsi",
        title: "RSI, from scratch",
        minutes: 3,
        summary: "Overbought, oversold, and why '50' is boring on purpose.",
        explainer: [
          "RSI (Relative Strength Index) is a 0–100 score that tries to measure how stretched the recent move has been, relative to itself.",
          "Rule of thumb: RSI > 70 = overbought (move is stretched, cool-off more likely). RSI < 30 = oversold (drop is stretched, bounce more likely). 30–70 is the normal middle.",
          "RSI is a context clue, not a signal. An overbought stock in a strong uptrend can stay overbought for weeks. Pair it with price action before you act.",
        ],
        practice: [
          {
            id: "i1-q1",
            kind: "indicator",
            indicator: "RSI",
            prompt: "Which stock here looks most overbought?",
            rows: [
              { symbol: "RELIANCE", value: 58 },
              { symbol: "TCS", value: 44 },
              { symbol: "ADANIENT", value: 76 },
              { symbol: "HDFCBANK", value: 61 },
            ],
            answer: 2,
            explain:
              "ADANIENT at 76 is the only reading above 70. Remember — overbought doesn't mean short, it means context.",
          },
          {
            id: "i1-q2",
            kind: "indicator",
            indicator: "RSI",
            prompt: "Which reading here is the textbook neutral mid-range?",
            rows: [
              { symbol: "INFY", value: 50 },
              { symbol: "WIPRO", value: 24 },
              { symbol: "SBIN", value: 82 },
              { symbol: "MARUTI", value: 68 },
            ],
            answer: 0,
            explain:
              "50 is the RSI midpoint. WIPRO is oversold; SBIN is strongly overbought; MARUTI is inside the normal range but leaning strong.",
          },
        ],
      },
    ],
  },

  {
    id: "matching",
    title: "Chart matching",
    blurb: "See it in the wild. Recognise the shape from 4 candidates.",
    accent: "matching",
    lessons: [
      {
        id: "m-shapes",
        title: "Shapes in the wild",
        minutes: 3,
        summary: "Four small charts, one right answer. Pattern-recognition reps.",
        explainer: [
          "Traders don't get a labelled chart in the real world. They get four ambiguous candidates and have to pick the one that fits the setup.",
          "This lesson is all reps — look at the 4 thumbnails, isolate the key structure (pole, base, bottom, wedge), and pick.",
        ],
        practice: [
          {
            id: "m1-q1",
            kind: "match",
            prompt: "Which of these is a clean double bottom?",
            charts: [
              { label: "A", points: [40, 36, 32, 30, 32, 34, 36, 38, 40, 42, 44, 46] },
              { label: "B", points: [40, 32, 24, 20, 24, 30, 28, 22, 20, 24, 32, 40] },
              { label: "C", points: [20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64] },
              { label: "D", points: [40, 38, 36, 38, 42, 44, 42, 44, 46, 44, 46, 48] },
            ],
            options: ["Chart A", "Chart B", "Chart C", "Chart D"],
            answer: 1,
            explain:
              "B prints two distinct lows at ~20 with an interim rally to ~30 — the defining shape.",
          },
          {
            id: "m1-q2",
            kind: "match",
            prompt:
              "Which is the morning-rally-fade (strong up, then gives it all back)?",
            charts: [
              { label: "A", points: [20, 24, 30, 36, 42, 44, 42, 38, 32, 28, 22, 18] },
              { label: "B", points: [20, 18, 16, 14, 14, 16, 20, 24, 28, 32, 36, 40] },
              { label: "C", points: [30, 30, 31, 30, 30, 31, 30, 30, 31, 30, 29, 30] },
              { label: "D", points: [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 44] },
            ],
            options: ["Chart A", "Chart B", "Chart C", "Chart D"],
            answer: 0,
            explain:
              "A rallies hard into the midday high and gives it all back by close — that's a morning-rally-fade profile.",
          },
        ],
      },
    ],
  },

  {
    id: "fundamentals",
    title: "Fundamentals",
    blurb: "The language of P/E, market cap, and what “cheap” means.",
    accent: "fundamentals",
    lessons: [
      {
        id: "f-marketcap",
        title: "Market cap & P/E",
        minutes: 3,
        summary: "Two numbers that do 80% of the comparison work.",
        explainer: [
          "Market capitalization = share price × shares outstanding. It tells you how big the company is in equity terms.",
          "P/E = price ÷ earnings per share. It tells you how much the market is paying today for every ₹1 of profit.",
          "A high P/E isn't “expensive” in isolation — it means the market is pricing in faster future growth. Comparing P/E vs. sector average is more useful than the absolute number.",
        ],
        practice: [
          {
            id: "f1-q1",
            kind: "fundamental",
            prompt: "Market cap is calculated as…",
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
          {
            id: "f1-q2",
            kind: "fundamental",
            prompt:
              "A P/E of 45 for a slow-growing FMCG large-cap, vs. sector average 28, most likely indicates…",
            options: [
              "The stock is undervalued",
              "The market is pricing in richer growth / quality premium than peers",
              "Dividend yield will be high",
              "Book value is above market price",
            ],
            answer: 1,
            explain:
              "Higher P/E vs. peers reflects expected growth or a quality premium — not undervaluation.",
          },
        ],
      },
    ],
  },
];

export function findLesson(
  id: string,
): { track: Track; lesson: Lesson; index: number } | null {
  for (const track of TRACKS) {
    const index = track.lessons.findIndex((l) => l.id === id);
    if (index >= 0) return { track, lesson: track.lessons[index], index };
  }
  return null;
}

export function totalLessonCount(): number {
  return TRACKS.reduce((n, t) => n + t.lessons.length, 0);
}
