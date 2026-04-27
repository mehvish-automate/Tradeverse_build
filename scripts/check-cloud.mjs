// Dev-only Supabase health probe.
//
// Usage (Node 20+):
//   node --env-file=.env.local scripts/check-cloud.mjs
//
// Reports:
//   1. Env vars present.
//   2. Auth state (anon vs signed-in via session in env, if any).
//   3. Per-table reachability: OK / missing / RLS-denied / other.
//
// Uses the anon key, so RLS is enforced — "RLS-denied" is the expected
// outcome for owner-scoped tables when running unauthenticated. The
// probe distinguishes that from "table doesn't exist" so you can tell
// whether the schema needs to be re-run.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error(
    "✗ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  console.error("  Run: node --env-file=.env.local scripts/check-cloud.mjs");
  process.exit(1);
}

const supabase = createClient(url, anon, { auth: { persistSession: false } });

const TABLES = [
  "profiles",
  "daily_results",
  "user_stats",
  "trade_floors",
  "trade_floor_members",
  "clubs",
  "club_members",
  "fests",
  "fest_participants",
  "floor_posts",
  "floor_reactions",
  "floor_comments",
  "portfolios",
  "portfolio_holdings",
  "paper_accounts",
  "paper_holdings",
  "orders",
  "watchlist_items",
  "quest_claims",
];

function classify(error) {
  if (!error) return { tag: "ok", note: "" };
  const code = error.code || "";
  const msg = error.message || "";
  if (code === "42P01" || /relation .* does not exist/i.test(msg)) {
    return { tag: "missing", note: "table not found — re-run schema.sql" };
  }
  if (code === "PGRST205") {
    return { tag: "missing", note: "table not in schema cache" };
  }
  if (code === "42501" || /permission denied/i.test(msg)) {
    return { tag: "rls", note: "RLS denied (expected when not signed in)" };
  }
  return { tag: "error", note: `${code || "?"}: ${msg}` };
}

async function probe(table) {
  const { error } = await supabase.from(table).select("*", {
    head: true,
    count: "exact",
  });
  return classify(error);
}

const ICON = { ok: "✓", rls: "·", missing: "✗", error: "!" };

(async () => {
  console.log(`Supabase: ${url}`);

  // Reachability check — bail fast if the host is unreachable so we
  // don't spew "fetch failed" 19 times.
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon },
    });
    if (!res.ok && res.status !== 404) {
      console.error(`✗ Health endpoint returned ${res.status}.`);
      process.exit(4);
    }
  } catch (e) {
    console.error(`✗ Cannot reach ${url} — ${e.message}`);
    console.error("  Project paused, wrong URL, or no network.");
    process.exit(4);
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    console.log("Auth: anonymous (no session in env)\n");
  } else {
    console.log(`Auth: signed in as ${userData.user.email}\n`);
  }

  const results = await Promise.all(
    TABLES.map(async (t) => [t, await probe(t)]),
  );

  let missing = 0;
  let errors = 0;
  for (const [t, r] of results) {
    const pad = t.padEnd(22);
    console.log(`${ICON[r.tag]} ${pad} ${r.note}`);
    if (r.tag === "missing") missing++;
    if (r.tag === "error") errors++;
  }

  console.log();
  if (missing > 0) {
    console.log(
      `✗ ${missing} table(s) missing — paste supabase/schema.sql into the Supabase SQL editor and re-run.`,
    );
    process.exit(2);
  }
  if (errors > 0) {
    console.log(`! ${errors} unexpected error(s) — see above.`);
    process.exit(3);
  }
  console.log("✓ All tables reachable. Cloud is up.");
})();
