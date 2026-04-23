"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Bar,
  Timeframe,
  bollinger,
  generateBars,
  macd,
  rsi,
  vwapSeries,
} from "@/lib/marketData";
import { actionsInWindow, CorporateAction } from "@/lib/corporate";

type DrawingKind = "hline" | "trendline";
type Drawing =
  | { id: string; kind: "hline"; price: number }
  | { id: string; kind: "trendline"; x1: number; y1: number; x2: number; y2: number };

const TIMEFRAMES: { id: Timeframe; label: string; count: number }[] = [
  { id: "1m", label: "1m", count: 120 },
  { id: "5m", label: "5m", count: 120 },
  { id: "15m", label: "15m", count: 120 },
  { id: "1h", label: "1h", count: 120 },
  { id: "1d", label: "1D", count: 120 },
  { id: "1w", label: "1W", count: 60 },
];

export function AdvancedChart({ symbol }: { symbol: string }) {
  const [tf, setTf] = useState<Timeframe>("1d");
  const [showBB, setShowBB] = useState(true);
  const [showVWAP, setShowVWAP] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showActions, setShowActions] = useState(true);
  const [chartType, setChartType] = useState<"candle" | "line">("candle");
  const [drawMode, setDrawMode] = useState<null | DrawingKind>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);

  const count = TIMEFRAMES.find((t) => t.id === tf)?.count ?? 120;
  const bars = useMemo(() => generateBars(symbol, tf, count), [symbol, tf, count]);

  // Drawing persistence: scoped per symbol.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(`tv.drawings.${symbol}`);
      setDrawings(raw ? (JSON.parse(raw) as Drawing[]) : []);
    } catch {
      setDrawings([]);
    }
  }, [symbol]);

  function saveDrawings(next: Drawing[]) {
    setDrawings(next);
    try {
      localStorage.setItem(`tv.drawings.${symbol}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  // Indicators
  const bb = useMemo(() => bollinger(bars, 20, 2), [bars]);
  const rsiVals = useMemo(() => rsi(bars, 14), [bars]);
  const macdVals = useMemo(() => macd(bars), [bars]);
  const vw = useMemo(() => vwapSeries(bars), [bars]);

  const actions = useMemo(() => {
    if (bars.length === 0) return [];
    return actionsInWindow(symbol, bars[0].t, bars[bars.length - 1].t);
  }, [symbol, bars]);

  if (bars.length === 0) return null;

  // Layout
  const W = 1000;
  const mainH = 240;
  const rsiH = showRSI ? 60 : 0;
  const macdH = showMACD ? 60 : 0;
  const padX = 56;
  const padY = 14;

  const allHighs = [...bars.map((b) => b.h)];
  if (showBB) allHighs.push(...bb.upper.filter(Number.isFinite));
  const allLows = [...bars.map((b) => b.l)];
  if (showBB) allLows.push(...bb.lower.filter(Number.isFinite));
  const yMax = Math.max(...allHighs);
  const yMin = Math.min(...allLows);
  const yRange = yMax - yMin || 1;
  const step = (W - padX - 10) / bars.length;
  const xAt = (i: number) => padX + i * step + step / 2;
  const yPrice = (p: number) => padY + ((yMax - p) / yRange) * (mainH - 2 * padY);
  const yInv = (y: number) => yMax - ((y - padY) / (mainH - 2 * padY)) * yRange;

  function onSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawMode) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * (mainH + rsiH + macdH + 30);
    if (sy > mainH) return; // only on main pane

    if (drawMode === "hline") {
      const p = yInv(sy);
      saveDrawings([
        ...drawings,
        { id: crypto.randomUUID?.() ?? String(Date.now()), kind: "hline", price: p },
      ]);
      setDrawMode(null);
      return;
    }
    if (drawMode === "trendline") {
      if (!pending) {
        setPending({ x: sx, y: sy });
      } else {
        saveDrawings([
          ...drawings,
          {
            id: crypto.randomUUID?.() ?? String(Date.now()),
            kind: "trendline",
            x1: pending.x,
            y1: pending.y,
            x2: sx,
            y2: sy,
          },
        ]);
        setPending(null);
        setDrawMode(null);
      }
    }
  }

  // RSI pane
  const rsiPaneY = mainH + 14;
  const rsiYAt = (v: number) =>
    rsiPaneY + ((100 - v) / 100) * (rsiH - 2 * padY) + padY;

  // MACD pane
  const macdPaneY = mainH + 14 + rsiH + (showRSI ? 10 : 0);
  const macdAll = [
    ...macdVals.macd.filter(Number.isFinite),
    ...macdVals.signal.filter(Number.isFinite),
  ];
  const macdHist = macdVals.hist.filter(Number.isFinite);
  const mMax = Math.max(0, ...macdAll, ...macdHist);
  const mMin = Math.min(0, ...macdAll, ...macdHist);
  const mRange = mMax - mMin || 1;
  const macdYAt = (v: number) =>
    macdPaneY + padY + ((mMax - v) / mRange) * (macdH - 2 * padY);

  const totalH = mainH + (showRSI ? rsiH + 10 : 0) + (showMACD ? macdH + 10 : 0) + 20;

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((x) => (
            <button
              key={x.id}
              onClick={() => setTf(x.id)}
              className={
                "rounded-md border px-2 py-1 text-xs transition " +
                (tf === x.id
                  ? "border-brand-500 bg-brand-500/10 text-brand-200"
                  : "border-ink-700 text-ink-300 hover:border-ink-500")
              }
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="ml-2 flex gap-1">
          {(["candle", "line"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setChartType(k)}
              className={
                "rounded-md border px-2 py-1 text-xs transition capitalize " +
                (chartType === k
                  ? "border-ink-400 text-ink-100"
                  : "border-ink-700 text-ink-400 hover:border-ink-500")
              }
            >
              {k}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
          <Toggle label="BB(20)" on={showBB} onToggle={() => setShowBB(!showBB)} />
          <Toggle label="VWAP" on={showVWAP} onToggle={() => setShowVWAP(!showVWAP)} />
          <Toggle label="RSI(14)" on={showRSI} onToggle={() => setShowRSI(!showRSI)} />
          <Toggle label="MACD" on={showMACD} onToggle={() => setShowMACD(!showMACD)} />
          <Toggle
            label="Corp actions"
            on={showActions}
            onToggle={() => setShowActions(!showActions)}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">Draw:</span>
        <button
          onClick={() => {
            setDrawMode(drawMode === "hline" ? null : "hline");
            setPending(null);
          }}
          className={
            "rounded-md border px-2 py-1 text-xs transition " +
            (drawMode === "hline"
              ? "border-brand-500 bg-brand-500/10 text-brand-200"
              : "border-ink-700 text-ink-300 hover:border-ink-500")
          }
        >
          H-line
        </button>
        <button
          onClick={() => {
            setDrawMode(drawMode === "trendline" ? null : "trendline");
            setPending(null);
          }}
          className={
            "rounded-md border px-2 py-1 text-xs transition " +
            (drawMode === "trendline"
              ? "border-brand-500 bg-brand-500/10 text-brand-200"
              : "border-ink-700 text-ink-300 hover:border-ink-500")
          }
        >
          Trendline {pending ? "· click endpoint" : ""}
        </button>
        {drawings.length > 0 && (
          <button
            onClick={() => saveDrawings([])}
            className="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-400 hover:bg-ink-900"
          >
            Clear all
          </button>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${totalH}`}
        className={"w-full " + (drawMode ? "cursor-crosshair" : "")}
        onClick={onSvgClick}
      >
        {/* Grid + price axis */}
        {Array.from({ length: 4 }).map((_, i) => {
          const p = yMax - (yRange * (i + 1)) / 5;
          const y = yPrice(p);
          return (
            <g key={"g" + i}>
              <line
                x1={padX}
                x2={W}
                y1={y}
                y2={y}
                stroke="#1e293b"
                strokeWidth={0.5}
              />
              <text x={8} y={y + 3} fontSize={9} fill="#64748b">
                {p.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Candles or line */}
        {chartType === "candle"
          ? bars.map((b, i) => {
              const x = xAt(i);
              const up = b.c >= b.o;
              const color = up ? "#10b981" : "#f87171";
              const openY = yPrice(b.o);
              const closeY = yPrice(b.c);
              const highY = yPrice(b.h);
              const lowY = yPrice(b.l);
              const bodyH = Math.max(1, Math.abs(closeY - openY));
              const bodyY = Math.min(openY, closeY);
              const bw = Math.max(1, step * 0.7);
              return (
                <g key={i}>
                  <line
                    x1={x}
                    x2={x}
                    y1={highY}
                    y2={lowY}
                    stroke={color}
                    strokeWidth={0.8}
                  />
                  <rect
                    x={x - bw / 2}
                    y={bodyY}
                    width={bw}
                    height={bodyH}
                    fill={color}
                    opacity={up ? 0.85 : 0.75}
                  />
                </g>
              );
            })
          : (() => {
              const d = bars
                .map((b, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yPrice(b.c)}`)
                .join(" ");
              return (
                <path d={d} stroke="#10b981" strokeWidth={1.2} fill="none" />
              );
            })()}

        {/* Bollinger overlay */}
        {showBB && (
          <>
            <path
              d={bb.upper
                .map((v, i) =>
                  Number.isFinite(v) ? `${i === 0 ? "M" : "L"} ${xAt(i)} ${yPrice(v)}` : "",
                )
                .filter(Boolean)
                .join(" ")
                .replace(/^L /, "M ")}
              stroke="#a78bfa"
              strokeWidth={0.6}
              fill="none"
              strokeDasharray="2 2"
            />
            <path
              d={bb.mid
                .map((v, i) =>
                  Number.isFinite(v) ? `${i === 0 ? "M" : "L"} ${xAt(i)} ${yPrice(v)}` : "",
                )
                .filter(Boolean)
                .join(" ")
                .replace(/^L /, "M ")}
              stroke="#a78bfa"
              strokeWidth={0.5}
              fill="none"
              opacity={0.6}
            />
            <path
              d={bb.lower
                .map((v, i) =>
                  Number.isFinite(v) ? `${i === 0 ? "M" : "L"} ${xAt(i)} ${yPrice(v)}` : "",
                )
                .filter(Boolean)
                .join(" ")
                .replace(/^L /, "M ")}
              stroke="#a78bfa"
              strokeWidth={0.6}
              fill="none"
              strokeDasharray="2 2"
            />
          </>
        )}

        {/* VWAP */}
        {showVWAP && (
          <path
            d={vw
              .map((v, i) =>
                Number.isFinite(v) ? `${i === 0 ? "M" : "L"} ${xAt(i)} ${yPrice(v)}` : "",
              )
              .filter(Boolean)
              .join(" ")
              .replace(/^L /, "M ")}
            stroke="#fbbf24"
            strokeWidth={0.9}
            fill="none"
          />
        )}

        {/* Corporate actions */}
        {showActions &&
          actions.map((a: CorporateAction, i: number) => {
            const t = new Date(a.date).getTime();
            const idx = bars.findIndex((b) => b.t >= t);
            if (idx < 0) return null;
            const x = xAt(idx);
            const tone =
              a.kind === "split"
                ? "#a78bfa"
                : a.kind === "dividend"
                  ? "#10b981"
                  : "#fbbf24";
            return (
              <g key={"ca" + i}>
                <line
                  x1={x}
                  x2={x}
                  y1={padY}
                  y2={mainH - padY}
                  stroke={tone}
                  strokeWidth={0.5}
                  strokeDasharray="2 3"
                />
                <circle cx={x} cy={padY} r={3} fill={tone} />
                <text
                  x={x + 4}
                  y={padY + 4}
                  fontSize={8}
                  fill={tone}
                >
                  {a.kind[0].toUpperCase()}
                </text>
              </g>
            );
          })}

        {/* Drawings */}
        {drawings.map((d) => {
          if (d.kind === "hline") {
            const y = yPrice(d.price);
            return (
              <g key={d.id}>
                <line
                  x1={padX}
                  x2={W}
                  y1={y}
                  y2={y}
                  stroke="#f472b6"
                  strokeWidth={0.8}
                  strokeDasharray="4 2"
                />
                <text x={W - 30} y={y - 3} fontSize={8} fill="#f472b6">
                  {d.price.toFixed(1)}
                </text>
              </g>
            );
          }
          return (
            <line
              key={d.id}
              x1={d.x1}
              y1={d.y1}
              x2={d.x2}
              y2={d.y2}
              stroke="#f472b6"
              strokeWidth={0.9}
            />
          );
        })}

        {/* RSI pane */}
        {showRSI && (
          <g>
            <rect
              x={padX}
              y={rsiPaneY + padY - 2}
              width={W - padX - 10}
              height={rsiH - 2 * padY + 4}
              fill="#020617"
              opacity={0.2}
            />
            <line
              x1={padX}
              x2={W}
              y1={rsiYAt(70)}
              y2={rsiYAt(70)}
              stroke="#f87171"
              strokeWidth={0.4}
              strokeDasharray="2 2"
            />
            <line
              x1={padX}
              x2={W}
              y1={rsiYAt(30)}
              y2={rsiYAt(30)}
              stroke="#10b981"
              strokeWidth={0.4}
              strokeDasharray="2 2"
            />
            <path
              d={rsiVals
                .map((v, i) =>
                  Number.isFinite(v) ? `${i === 0 ? "M" : "L"} ${xAt(i)} ${rsiYAt(v)}` : "",
                )
                .filter(Boolean)
                .join(" ")
                .replace(/^L /, "M ")}
              stroke="#38bdf8"
              strokeWidth={1}
              fill="none"
            />
            <text x={8} y={rsiPaneY + 10} fontSize={9} fill="#64748b">
              RSI
            </text>
          </g>
        )}

        {/* MACD pane */}
        {showMACD && (
          <g>
            <rect
              x={padX}
              y={macdPaneY + padY - 2}
              width={W - padX - 10}
              height={macdH - 2 * padY + 4}
              fill="#020617"
              opacity={0.2}
            />
            {macdVals.hist.map((v, i) =>
              Number.isFinite(v) ? (
                <rect
                  key={"h" + i}
                  x={xAt(i) - step * 0.3}
                  y={Math.min(macdYAt(0), macdYAt(v))}
                  width={Math.max(1, step * 0.6)}
                  height={Math.abs(macdYAt(v) - macdYAt(0))}
                  fill={v >= 0 ? "#10b981" : "#f87171"}
                  opacity={0.5}
                />
              ) : null,
            )}
            <path
              d={macdVals.macd
                .map((v, i) =>
                  Number.isFinite(v) ? `${i === 0 ? "M" : "L"} ${xAt(i)} ${macdYAt(v)}` : "",
                )
                .filter(Boolean)
                .join(" ")
                .replace(/^L /, "M ")}
              stroke="#38bdf8"
              strokeWidth={1}
              fill="none"
            />
            <path
              d={macdVals.signal
                .map((v, i) =>
                  Number.isFinite(v) ? `${i === 0 ? "M" : "L"} ${xAt(i)} ${macdYAt(v)}` : "",
                )
                .filter(Boolean)
                .join(" ")
                .replace(/^L /, "M ")}
              stroke="#fbbf24"
              strokeWidth={1}
              fill="none"
            />
            <text x={8} y={macdPaneY + 10} fontSize={9} fill="#64748b">
              MACD
            </text>
          </g>
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-ink-500">
        <LegendDot color="#10b981" label="Up candle" />
        <LegendDot color="#f87171" label="Down candle" />
        <LegendDot color="#a78bfa" label="Bollinger" />
        <LegendDot color="#fbbf24" label="VWAP / MACD signal" />
        <LegendDot color="#38bdf8" label="RSI / MACD line" />
        <LegendDot color="#f472b6" label="Your drawings" />
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={
        "rounded-md border px-2 py-0.5 transition " +
        (on
          ? "border-brand-500 bg-brand-500/10 text-brand-200"
          : "border-ink-700 text-ink-400 hover:border-ink-500")
      }
    >
      {label}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-1.5 w-4 rounded-sm"
        style={{ background: color }}
      />
      <span>{label}</span>
    </span>
  );
}
