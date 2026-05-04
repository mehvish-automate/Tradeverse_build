/**
 * Tiny skeleton primitive. `lines` renders N stacked rounded bars at
 * the given height. Use inline for simple page-load placeholders.
 */
export function Skeleton({
  lines = 3,
  className = "",
  height = "h-4",
}: {
  lines?: number;
  className?: string;
  height?: string;
}) {
  return (
    <div className={"space-y-3 " + className} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={
            `animate-pulse rounded-md bg-ink-900/60 ${height} ` +
            // Vary widths so the placeholder reads as content, not bars.
            (i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-5/6" : "w-2/3")
          }
        />
      ))}
    </div>
  );
}

/** Card-shaped skeleton — rounded box with stacked bars inside. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
      <Skeleton lines={lines} />
    </div>
  );
}
