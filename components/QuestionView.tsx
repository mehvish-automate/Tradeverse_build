"use client";

import { ChartSvg } from "@/components/ChartSvg";
import type { Question } from "@/lib/questions";

export function QuestionView({
  q,
  chosenIdx,
  onPick,
}: {
  q: Question;
  chosenIdx: number | null;
  onPick: (i: number) => void;
}) {
  return (
    <div>
      <Meta q={q} />
      <h2 className="mt-3 text-lg font-semibold text-ink-50 md:text-xl">
        {q.prompt}
      </h2>
      <Body q={q} chosenIdx={chosenIdx} onPick={onPick} />
    </div>
  );
}

function Meta({ q }: { q: Question }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
      <span className="rounded-md bg-brand-500/10 px-2 py-0.5 font-medium text-brand-300">
        {q.kind}
      </span>
      {"symbol" in q && <span>{q.symbol}</span>}
      {"interval" in q && <span>· {q.interval}</span>}
      {"date" in q && <span>· {q.date}</span>}
      {q.kind === "indicator" && <span>· {q.indicator}</span>}
    </div>
  );
}

function Body({
  q,
  chosenIdx,
  onPick,
}: {
  q: Question;
  chosenIdx: number | null;
  onPick: (i: number) => void;
}) {
  if (q.kind === "pattern" || q.kind === "level") {
    const options = q.options;
    return (
      <>
        <div className="mt-4 rounded-lg border border-ink-700/70 bg-ink-950 p-3">
          <ChartSvg
            points={q.series.points}
            levels={q.kind === "level" ? q.levels : undefined}
          />
        </div>
        <OptionsGrid
          options={options}
          chosenIdx={chosenIdx}
          correctIdx={q.answer}
          onPick={onPick}
        />
      </>
    );
  }

  if (q.kind === "fundamental") {
    return (
      <OptionsGrid
        options={q.options}
        chosenIdx={chosenIdx}
        correctIdx={q.answer}
        onPick={onPick}
      />
    );
  }

  if (q.kind === "match") {
    return (
      <div className="mt-5 grid grid-cols-2 gap-3">
        {q.charts.map((c, i) => {
          const picked = chosenIdx === i;
          const isCorrect = chosenIdx != null && i === q.answer;
          const isWrongPick = chosenIdx != null && picked && i !== q.answer;
          const locked = chosenIdx != null;
          return (
            <button
              key={c.label + i}
              onClick={() => onPick(i)}
              disabled={locked}
              className={
                "flex flex-col gap-2 rounded-lg border p-3 text-left transition " +
                (isCorrect
                  ? "border-brand-500 bg-brand-500/10"
                  : isWrongPick
                    ? "border-red-500/70 bg-red-500/10"
                    : picked
                      ? "border-ink-500 bg-ink-900"
                      : "border-ink-700 bg-ink-950 hover:border-ink-500")
              }
            >
              <div className="flex items-center justify-between text-xs text-ink-400">
                <span className="font-semibold text-ink-100">
                  {q.options[i]}
                </span>
              </div>
              <div className="rounded border border-ink-800 bg-ink-950 p-2">
                <ChartSvg points={c.points} className="h-20 w-full" />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (q.kind === "indicator") {
    return (
      <div className="mt-5 overflow-hidden rounded-lg border border-ink-700">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-ink-700 bg-ink-900/60 px-4 py-2 text-xs uppercase tracking-wider text-ink-400">
          <span>Symbol</span>
          <span>{q.indicator}</span>
          <span>Pick</span>
        </div>
        {q.rows.map((row, i) => {
          const picked = chosenIdx === i;
          const isCorrect = chosenIdx != null && i === q.answer;
          const isWrongPick = chosenIdx != null && picked && i !== q.answer;
          const locked = chosenIdx != null;
          return (
            <button
              key={row.symbol + i}
              onClick={() => onPick(i)}
              disabled={locked}
              className={
                "grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-ink-800 px-4 py-3 text-left transition last:border-b-0 " +
                (isCorrect
                  ? "bg-brand-500/10"
                  : isWrongPick
                    ? "bg-red-500/10"
                    : picked
                      ? "bg-ink-900"
                      : "hover:bg-ink-900/50")
              }
            >
              <span className="font-medium text-ink-100">{row.symbol}</span>
              <span className="font-mono text-ink-200">{row.value}</span>
              <span
                className={
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs " +
                  (isCorrect
                    ? "bg-brand-500 text-ink-950"
                    : picked
                      ? "bg-ink-700 text-ink-100"
                      : "bg-ink-900 text-ink-400")
                }
              >
                {isCorrect ? "✓" : picked ? "•" : ""}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}

function OptionsGrid({
  options,
  chosenIdx,
  correctIdx,
  onPick,
}: {
  options: string[];
  chosenIdx: number | null;
  correctIdx: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
      {options.map((label, i) => {
        const picked = chosenIdx === i;
        const isCorrect = chosenIdx != null && i === correctIdx;
        const isWrongPick = chosenIdx != null && picked && i !== correctIdx;
        const locked = chosenIdx != null;
        return (
          <button
            key={label + i}
            onClick={() => onPick(i)}
            disabled={locked}
            className={
              "rounded-lg border px-4 py-3 text-left text-sm transition " +
              (isCorrect
                ? "border-brand-500 bg-brand-500/10 text-ink-50"
                : isWrongPick
                  ? "border-red-500/70 bg-red-500/10 text-ink-50"
                  : picked
                    ? "border-ink-500 bg-ink-900 text-ink-50"
                    : "border-ink-700 text-ink-200 hover:border-ink-500")
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
