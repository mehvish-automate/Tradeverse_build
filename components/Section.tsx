import { clsx } from "./clsx";

export function Section({
  id,
  eyebrow,
  title,
  kicker,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={clsx("mx-auto max-w-6xl px-6 py-20 md:py-28", className)}
    >
      <div className="max-w-3xl">
        {eyebrow && (
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            {eyebrow}
          </div>
        )}
        <h2 className="text-balance text-3xl font-semibold leading-tight md:text-5xl">
          {title}
        </h2>
        {kicker && (
          <p className="mt-4 max-w-2xl text-pretty text-lg text-ink-300">
            {kicker}
          </p>
        )}
      </div>
      <div className="mt-12">{children}</div>
    </section>
  );
}
