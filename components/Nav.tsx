"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { unreadCount } from "@/lib/notifications";
import { useSession } from "@/lib/session";

type NavLink = { href: string; label: string; matches?: string[] };

const APP_LINKS: NavLink[] = [
  { href: "/learn", label: "Learn" },
  {
    href: "/quests",
    label: "Quests",
    matches: ["/play"],
  },
  {
    href: "/floors",
    label: "Floors",
    matches: ["/events", "/trade-floors", "/fests", "/quizzes"],
  },
  {
    href: "/social",
    label: "Social",
    matches: ["/clubs", "/marketplace"],
  },
];

const MARKETING_LINKS: NavLink[] = [
  { href: "/#how", label: "How it works" },
  { href: "/#heroes", label: "Modes" },
  { href: "/#faq", label: "FAQ" },
];

const SECONDARY_AUTHED_LINKS: NavLink[] = [
  { href: "/quizzes", label: "Quiz Floor" },
  { href: "/alerts", label: "Alerts" },
  { href: "/badges", label: "Badges" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/history", label: "History" },
  { href: "/inbox", label: "Inbox" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const { user, loaded } = useSession();
  const pathname = usePathname() ?? "";
  const [unread, setUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUnread(unreadCount(user.email));
    const onFocus = () => setUnread(unreadCount(user.email));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const matchesPrefix = (prefix: string) =>
    pathname === prefix || pathname.startsWith(prefix + "/");

  const isActiveLink = (link: NavLink) => {
    if (link.href.startsWith("/#")) return false;
    if (link.href === "/") return pathname === "/";
    if (matchesPrefix(link.href)) return true;
    return (link.matches ?? []).some(matchesPrefix);
  };

  const authed = loaded && !!user;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/80 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
          TradeVerse
        </Link>

        {/* Desktop primary nav */}
        <nav className="hidden flex-1 items-center justify-center gap-1 text-sm md:flex">
          {(authed ? APP_LINKS : MARKETING_LINKS).map((l) => (
            <NavItem key={l.href} link={l} active={isActiveLink(l)} />
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {authed ? (
            <>
              <Link
                href="/inbox"
                aria-label="Inbox"
                className="relative rounded-md border border-ink-700 p-2 text-ink-200 transition hover:border-ink-500 hover:bg-ink-900 hover:text-ink-50"
              >
                <BellIcon />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-ink-950">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link
                href="/profile"
                className="hidden items-center gap-2 rounded-md border border-ink-700 px-2.5 py-1.5 text-xs font-medium text-ink-100 transition hover:border-ink-500 hover:bg-ink-900 sm:inline-flex"
              >
                <Avatar name={user!.displayName} />
                <span className="max-w-[120px] truncate">@{user!.displayName}</span>
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                aria-label="Open menu"
                aria-expanded={drawerOpen}
                className="rounded-md border border-ink-700 p-2 text-ink-200 transition hover:border-ink-500 hover:bg-ink-900 md:hidden"
              >
                {drawerOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-100 transition hover:border-ink-500 hover:bg-ink-900 sm:inline-block"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-300"
              >
                Sign up
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                aria-label="Open menu"
                aria-expanded={drawerOpen}
                className="rounded-md border border-ink-700 p-2 text-ink-200 transition hover:border-ink-500 hover:bg-ink-900 md:hidden"
              >
                {drawerOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="border-t border-ink-900 bg-ink-950 md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <nav className="grid gap-1">
              {(authed ? APP_LINKS : MARKETING_LINKS).map((l) => (
                <DrawerLink key={l.href} link={l} active={isActiveLink(l)} />
              ))}
              {authed && (
                <>
                  <div className="mt-2 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    More
                  </div>
                  {SECONDARY_AUTHED_LINKS.map((l) => (
                    <DrawerLink key={l.href} link={l} active={isActiveLink(l)} />
                  ))}
                  <DrawerLink
                    link={{ href: "/profile", label: `@${user!.displayName}` }}
                    active={isActiveLink({ href: "/profile", label: "" })}
                  />
                </>
              )}
              {!authed && (
                <Link
                  href="/signin"
                  className="mt-1 rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-100 hover:bg-ink-900"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className={
        "rounded-md px-3 py-1.5 text-sm transition " +
        (active
          ? "bg-ink-900 text-ink-50"
          : "text-ink-300 hover:bg-ink-900 hover:text-ink-50")
      }
    >
      {link.label}
    </Link>
  );
}

function DrawerLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className={
        "rounded-md px-3 py-2 text-sm transition " +
        (active
          ? "bg-ink-900 text-ink-50"
          : "text-ink-200 hover:bg-ink-900 hover:text-ink-50")
      }
    >
      {link.label}
    </Link>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("") || "?";
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-semibold text-brand-300">
      {initials}
    </span>
  );
}

function BellIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
