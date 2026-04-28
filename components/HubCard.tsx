import Link from "next/link";

/**
 * Card used by the section hub pages (Strategy Builder, Floors, Social).
 * Each card is a primary route entrypoint with an eyebrow, title, body
 * blurb, and a subtle hover affordance.
 */
export function HubCard({
  href,
  eyebrow,
  title,
  body,
  accent = "default",
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  accent?: "default" | "brand";
}) {
  const baseBorder =
    accent === "brand"
      ? "border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent hover:border-brand-500"
      : "border-ink-700 bg-ink-900/40 hover:border-ink-500";

  const eyebrowColor =
    accent === "brand" ? "text-brand-300" : "text-ink-400";
  const arrowColor =
    accent === "brand" ? "text-brand-300" : "text-ink-300";

  return (
    <Link
      href={href}
      className={
        "group block rounded-2xl border p-6 transition " + baseBorder
      }
    >
      <div
        className={
          "text-xs font-medium uppercase tracking-wider " + eyebrowColor
        }
      >
        {eyebrow}
      </div>
      <div className="mt-1 text-xl font-semibold text-ink-50">{title}</div>
      <p className="mt-2 text-sm text-ink-300">{body}</p>
      <div className={"mt-4 text-sm group-hover:underline " + arrowColor}>
        Open →
      </div>
    </Link>
  );
}
