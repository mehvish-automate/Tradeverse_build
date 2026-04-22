import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-brand-300">
        404
      </div>
      <h1 className="mt-2 text-3xl font-semibold">
        This page isn&apos;t on the chart.
      </h1>
      <p className="mt-3 text-sm text-ink-400">
        The link may be broken, or you&apos;re looking at a draft route that
        hasn&apos;t shipped yet.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
      >
        Back to home
      </Link>
    </main>
  );
}
