export function ChartSvg({
  points,
  levels,
  className = "h-48 w-full",
}: {
  points: number[];
  levels?: number[];
  className?: string;
}) {
  if (points.length === 0) return null;

  const W = 100;
  const H = 50;
  const padY = 4;

  const min = Math.min(...points, ...(levels ?? []));
  const max = Math.max(...points, ...(levels ?? []));
  const range = max - min || 1;

  const scaleY = (v: number) =>
    H - padY - ((v - min) / range) * (H - padY * 2);
  const step = W / (points.length - 1);

  const d = points
    .map((y, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${scaleY(y).toFixed(2)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {levels?.map((lv, i) => {
        const y = scaleY(lv);
        return (
          <g key={i}>
            <line
              x1={0}
              x2={W}
              y1={y}
              y2={y}
              stroke="#64748b"
              strokeWidth={0.3}
              strokeDasharray="1.5 1.5"
            />
            <text
              x={W - 1}
              y={y - 0.6}
              textAnchor="end"
              fontSize={2.4}
              fill="#94a3b8"
            >
              {lv}
            </text>
          </g>
        );
      })}

      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill="url(#cg)" />
      <path
        d={d}
        fill="none"
        stroke="#10b981"
        strokeWidth={0.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
