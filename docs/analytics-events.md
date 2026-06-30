# TradeVerse analytics — events & screens

First-party event pipeline (Phase 65). `track(name, props)` in
`lib/analytics.ts` stamps each event with a device id, the signed-in
email (if any), the current path, and **first-touch attribution**, then
mirrors it to the Supabase `analytics_events` table (append-only,
own-rows RLS). A vendor sink (`registerAnalyticsSink`) can forward the
same events to PostHog / GA / Mixpanel later with zero call-site changes.

Every event automatically carries, when present:

| prop | meaning |
|---|---|
| `attr_ref` | `?ref=` / `?via=` value at first touch |
| `attr_utm_source` | `utm_source` at first touch |
| `attr_utm_campaign` | `utm_campaign` at first touch |

## Events

### Attribution — where users come from
| event | when | key props |
|---|---|---|
| `attribution_captured` | first load carrying ref/utm | `ref`, `utmSource`, `utmMedium`, `utmCampaign`, `landingPath` |
| `screen_view` | every route change | `screen`, `path` |
| `sign_up` | account created | `mode`, `referred` |
| `sign_in` | signed in | `mode` |

### Engagement — what users do
| event | when | key props |
|---|---|---|
| `daily_finish` | daily chart challenge completed | `correct`, `total`, `xp`, `streak` |
| `quiz_launch` | a Quiz Floor is launched | `festId`, `privacy`, `memberCap`, `source`, `needsApproval` |
| `quiz_start` | player starts a quiz run | `festId`, `questions`, `status` |
| `quiz_finish` | quiz run completed | `festId`, `score`, `correct`, `total`, `totalMs`, `improved` |
| `join_by_code` | joined a quiz/fest by invite code | `festId`, `eventType` |
| `share` | shared a result/invite | `kind`, `festId`, `channel` |
| `cta_click` | reserved for prominent CTA taps | `cta`, `screen` |

### Comms — how we reach users / what they open
| event | when | key props |
|---|---|---|
| `inbox_open` | inbox opened (reserved) | — |
| `notification_open` | a notification is clicked | `kind`, `hasHref` |

## Screen names

`screenName(pathname)` collapses dynamic segments to a stable name:

| path | screen |
|---|---|
| `/` | `landing` |
| `/signup` · `/signin` | `sign_up` · `sign_in` |
| `/learn` · `/learn/[id]` | `learn` · `lesson` |
| `/quests` | `quests` |
| `/play` | `daily_challenge` |
| `/quizzes` · `/quizzes/new` | `quiz_floor` · `quiz_launch` |
| `/fests/[code]` · `/fests/[code]/play` | `event_detail` · `quiz_play` |
| `/floors` · `/events` | `floors` · `market_events` |
| `/strategy` · `/trade` · `/portfolios` · `/watchlist` · `/charts` | `strategy_builder` · `paper_trading` · `portfolios` · `watchlist` · `multi_chart` |
| `/social` · `/clubs` · `/clubs/[id]` · `/marketplace` | `social` · `clubs` · `club_detail` · `events_marketplace` |
| `/leaderboards` · `/badges` · `/history` | `leaderboards` · `badges` · `history` |
| `/profile` · `/inbox` · `/alerts` · `/settings` | `profile` · `inbox` · `alerts` · `settings` |
| `/admin/fests` | `admin_approvals` |
| `/s/...` | `share_landing` |

## Querying (Supabase)

```sql
-- quiz funnel: starts vs finishes in the last 7 days
select name, count(*) from public.analytics_events
where name in ('quiz_start','quiz_finish')
  and occurred_at > now() - interval '7 days'
group by name;

-- signups by attribution source
select props->>'attr_utm_source' as source, count(*)
from public.analytics_events
where name = 'sign_up'
group by 1 order by 2 desc;

-- most-viewed screens
select props->>'screen' as screen, count(*)
from public.analytics_events
where name = 'screen_view'
group by 1 order by 2 desc;
```
