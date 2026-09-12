# Hub visitor instrumentation

The written record of Story 2.24's three Umami custom events: their names, what fires each, what
data each carries, how SM-1, SM-2 and SM-3 are read from them, the SM-C1 statement, the stated
limits, the monthly readings, the verification session and the work this file hands the Operator.

Written during Story 2.24 on **2026-09-12** (ISO 8601 UTC), against baseline commit `ddfc134`.

This file is a record, not Registry data, and nothing here is a published contract surface. It
follows the pattern `ops/monitoring.md`, `ops/bot-mitigation.md` and `ops/registry-verification.md`
set: every value is marked **Observed** with its method or **Decision** with its reason (NFR-9), and
every date is ISO 8601 UTC.

**This file is held equal to the tree by one reader.** `ops/__tests__/visitor-instrumentation.test.ts`
runs under the blocking `test` job and holds § The events equal to the names the components export
and to the attributes a rendered row carries, and every fenced SQL block to the same names and to
`visit_id`, so renaming an event is an edit to this file or it is red. The header rows of the events
and readings tables are therefore part of the contract of this file: keep them as they are.

**The instrument existed before the events.** The tracker at `analytics.cuatro.dev/script.js` has
been wired in `app/layout.tsx` since Story 1-21 and collecting since **2026-08-17**, the date
`ops/monitoring.md` § Which hosts are deliberately excluded records the previous database being
discarded. Nothing before that date exists, and every reading below describes the period from it
onward. Until this story the Hub measured page views and nothing else, so a session that loaded `/`
and a session that scrolled to the Directory and opened an application were the same row.

## The events

Three, and nothing else on the wire (FR-34, AD-18, `ARCHITECTURE-SPINE.md` § measurement). The two
link events are attributes on anchors the Directory already renders: the deployed tracker resolves
`closest('[data-umami-event]')` from any click, reads every `data-umami-event-<key>` as the event's
data and sends `{ name, data }` to `/api/send` with `keepalive`, without preventing a `_blank`
navigation. So the Directory stays a server component. The reach event has no click to hang on and
is `components/organisms/SuiteDirectory/SuiteReach.tsx`, a client component that renders nothing.

| Event | Fires when | Data | Nature |
|---|---|---|---|
| `suite-reach` | The `#suite` heading enters the viewport, or is already above it, once per browser session. The component checks for `window.umami.track` once at mount and then waits for it (250 ms, at most 80 ticks) and only then observes the heading with `IntersectionObserver`; the observer's initial notification answers "in view now" and "already past" (`boundingClientRect.bottom < 0`) at once. After attach, a jump past the heading between two frames (End, a scrollbar drag) never intersects and the observer does not notify it, so a `scroll` listener beside the observer reads the rect and sends on the next scroll event. Fires on both front doors: the non-3D path reaches the Directory in zero interactions and counts on its initial notification | none | **Decision.** The heading rather than the section, because `/#suite`, the skip control and the nav link all resolve to it; a section would count a one-pixel sliver. Once per session is a `sessionStorage` flag keyed on the name, set when sent, both accesses inside `try` |
| `live-open` | A click inside a Directory live link (`a.suite-directory__live`), by the tracker's own capture-phase listener | `app`: the Registry entry's `id` | **Decision.** Two attributes, no handler: a React `onClick` would re-implement the tracker's `_blank` and modifier-key handling and force a client boundary onto a component whose server-ness `lib/__tests__/registry.test.ts` asserts |
| `source-open` | A click inside a Directory Source link (`a.suite-directory__source`), the same way | `app`: the Registry entry's `id` | **Decision.** Same as above. The `You are here` row has no live link and keeps its Source link, so it carries this event and never `live-open` |

Umami truncates an event name at 50 characters; the suite holds all three under it and distinct.

## How each metric is read

Umami stores a custom event as one `website_event` row with `event_type = 2` and the name in
`event_name`, and each key of its data as one `event_data` row joined on `website_event_id`, with a
string value in `string_value`. A page view is `event_type = 1` with the path in `url_path`.

**Session, as the PRD uses the word, is Umami's visit: `visit_id`.** Umami's own `session_id` is
`uuid(website, address, user agent, salt)` with the salt rotating monthly by default
(`SALT_ROTATION`), so it names a visitor for a month, not a visit; `visit_id` is
`uuid(session_id, salt of the hour)`, carried across the hour boundary by the tracker's cache token,
which is one sitting. SM-1's "sessions" and SM-C1's ninety seconds are sittings, so every count below
is of distinct `visit_id`. **Observed 2026-09-12** in `umami-software/umami` `master`,
`src/app/api/send/route.ts` (`sessionSalt = getSalt(process.env.SALT_ROTATION || 'month', createdAt)`,
`visitSalt = hash(startOfHour(createdAt).toUTCString())`, `visitId = cache?.visitId || uuid(sessionId,
visitSalt)`) and `prisma/schema.prisma` (`website_event`: `event_id`, `session_id`, `visit_id`,
`created_at`, `url_path`, `event_type`, `event_name` at 50 characters; `event_data`:
`website_event_id`, `data_key`, `string_value`).

**Read off the source, not yet off the box.** The deployed image is `postgresql-latest` as pulled
on 2026-08-17, and the story's own session could not run `psql` on the box (the SSH step was refused
by the tooling), so the columns above are the current published schema and are to be confirmed at the
verification session with `\d website_event` and `\d event_data` before the first reading is taken.
That confirmation is Pending Operator action 1, and the row in § Verification session says whether it
happened.

**A Hub session** is a visit with at least one page view of `/`. The hash is split off because
`exclude-hash` is not set on the tracker, so the nav link's `/#suite` push records a page view that
may carry the fragment. The window below is one month; substitute the month being read.

```
/* SM-1, suite reach: share of Hub sessions that reached the Directory. Target 60%. */
with hub as (
  select distinct visit_id from website_event
  where event_type = 1 and split_part(url_path, '#', 1) = '/'
    and created_at >= '2026-09-01' and created_at < '2026-10-01'
),
reached as (
  select distinct e.visit_id from website_event e join hub using (visit_id)
  where e.event_type = 2 and e.event_name = 'suite-reach'
    and e.created_at >= '2026-09-01' and e.created_at < '2026-10-01'
)
select (select count(*) from hub) as sessions,
       (select count(*) from reached) as reached,
       round(100.0 * (select count(*) from reached) / nullif((select count(*) from hub), 0), 1) as share;
```

```
/* SM-2, application click-through: share of sessions that reached the Directory and opened at
   least one live application. Target 35%. SM-3, source drill-through, is the same query with
   'source-open' and has no target: it is the Marcus signal. */
with reached as (
  select distinct visit_id from website_event
  where event_type = 2 and event_name = 'suite-reach'
    and created_at >= '2026-09-01' and created_at < '2026-10-01'
),
opened as (
  select distinct e.visit_id from website_event e join reached using (visit_id)
  where e.event_type = 2 and e.event_name = 'live-open'
    and e.created_at >= '2026-09-01' and e.created_at < '2026-10-01'
)
select (select count(*) from reached) as reached,
       (select count(*) from opened) as opened,
       round(100.0 * (select count(*) from opened) / nullif((select count(*) from reached), 0), 1) as share;
```

```
/* Per application, for either link event: which entries are opened, by distinct session. */
select d.string_value as app, count(distinct e.visit_id) as sessions
from website_event e join event_data d on d.website_event_id = e.event_id
where e.event_type = 2 and e.event_name = 'live-open' and d.data_key = 'app'
  and e.created_at >= '2026-09-01' and e.created_at < '2026-10-01'
group by 1 order by 2 desc, 1;
```

| Property | Value | Nature |
|---|---|---|
| Unit | Distinct `visit_id`, never event rows and never `session_id` | **Decision.** SM-1 to SM-3 are shares of sessions in the PRD's sense, which is a sitting. `session_id` would fold a visitor's whole month into one row and read a returning visitor who reached the suite once as reaching it every time. `sessionStorage` is per tab, so one sitting with two tabs sends `suite-reach` twice and opens a link from each; counting visits absorbs both |
| SM-2 and SM-3 denominators | Visits with a `suite-reach`, not all Hub visits | **Decision.** `prd.md` § SM-2: "share of sessions reaching the Suite Directory". A visit can open a link without a reach event in two real ways: the `sessionStorage` flag outlived an earlier visit in the same tab (§ Stated limits), or the click landed inside the poll interval between the tracker loading and the observer attaching. Either way the `reached` join leaves that visit out of both numerator and denominator, which keeps the share at or under 100% and biases it by the visits stated below |
| Where it runs | `docker exec cuatro-portfolio-anchor-db-1 psql -U umami -d umami` over `wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248`, no Umami credential | **Decision.** `ops/bot-mitigation.md` § Umami is still collecting is the same path. The dashboard cannot be rendered by an agent (managed challenge), so the box is the agent's reading and the dashboard the Operator's |

## Time on site is not a target

`prd.md` SM-C1, verbatim: **Time on site.** Counterbalances SM-1 and SM-2. Daniela forming a
correct positive opinion in ninety seconds is a **success**, not a bounce. Time-on-site must never
be optimized, and a fall in it alongside a rise in SM-2 is a good outcome.

So no reading here carries a duration, and a month whose time on site fell while SM-2 rose is a
good month. Umami shows a duration on its dashboard; it is not copied into § Readings.

## Stated limits

| Limit | Why it stands | Nature |
|---|---|---|
| **Ad blockers undercount everything, at a rate nothing measures** | A blocked `script.js` is no page view and no event, and there is no server-side count to compare against. Every share below is a share of sessions the tracker saw. The reach component polls 80 times and then stays silent, by design | **Decision.** Filed as deferred work; a server-side denominator is a different instrument |
| **`sessionStorage` is per tab** | A visitor with the Hub in two tabs sends `suite-reach` from each. The metrics count distinct visits, so the share is unaffected; the raw event count is not a session count | **Decision** |
| **A middle click fires no `click`** | The tracker listens for `click`; a middle click is `auxclick`, and "open in new tab" from the context menu is no event at all. Both undercount SM-2 and SM-3 for exactly the visitor most likely to use them. A modifier-key click is counted: the tracker sends and does not prevent the navigation | **Decision.** The tracker's own; an `auxclick` handler is an event beyond the three, Ask First. Filed as deferred work |
| **No history before 2026-08-17, and no events before this story's deploy** | `ops/monitoring.md` records the previous database discarded on 2026-08-17. The events begin at the epic's merge to `main`, whose date § Verification session records | **Observed 2026-09-12** in `ops/monitoring.md` |
| **No dashboard automation** | `analytics.cuatro.dev` sits behind a managed challenge that refuses an automation-controlled browser by design (`ops/bot-mitigation.md`). Every dashboard confirmation is the Operator's; the agent's reading is `psql` on the box | **Decision.** Recorded there on 2026-08-27 |
| **Reach is not split by front door** | The event carries no data, so SM-1 cannot be read per door, which is the diagnosis SM-1 exists for. Reading the door means coupling to `HomeLayout`'s flat modifier, which Story 2-29 rewrites | **Decision.** Filed as deferred work; the seam is one `data` argument |
| **A tracker that loads after 20 s is never joined** | The poll is bounded so a blocked tracker costs nothing after the bound. A tracker that genuinely arrives later, on a very slow connection, misses that session's reach | **Decision** |
| **The flag outlives the visit** | `sessionStorage` lives as long as the tab; `visit_id` is a new value in a later hour. A tab kept open past the hour and reloaded is a new visit with a `/` page view that can never send `suite-reach`, so SM-1 undercounts by those visits, and any link they open leaves SM-2 and SM-3 through the `reached` join | **Decision.** Once per tab is the story's rule (the spec's Always block); the bias is stated here, not corrected. Correcting it means keying the flag on the hour or on Umami's cache token, which is a different rule |
| **Bots are in the denominator** | Whatever `ops/bot-mitigation.md`'s rules and Umami's own server-side bot filter let through records a `/` page view and never scrolls, so SM-1's denominator carries every such visit as "loaded, never reached", and no reading corrects for it | **Decision.** The rules are recorded there and are not this record's to tune; a month with an unexplained fall in SM-1 reads that file first |

## Readings

One row per month, taken from the box with the queries above. **Sessions** is SM-1's denominator,
**Reached** its numerator and **Share** the one over the other (target 60%); **Opened live** and
**Opened source** are SM-2's and SM-3's numerators, and **Live share** (target 35%) and **Source
share** (no target, the Marcus signal) are each over **Reached**. Add a row beneath, never rewrite an
earlier one.

The table was created empty on 2026-09-12 with a `_none recorded_` placeholder, so that an absent
reading is visibly absent. The first row replaces the placeholder after the first full month of
collection following the merge.

| Month (ISO 8601) | Sessions | Reached | Share | Opened live | Live share | Opened source | Source share | Taken by |
|---|---|---|---|---|---|---|---|---|
| _none recorded_ | | | | | | | | |

## Verification session

The events are proved three ways, and only the third is on the real instrument.

| Check | Where | Result | Nature |
|---|---|---|---|
| The component's logic: observes at once with the tracker present and waits for it otherwise, takes only a `track` function for a tracker, counts in view and already past, catches a jump past the heading on the next scroll, sends once and flags it, stops at the bound, survives a storage or a tracker that throws, clears up on unmount | `components/organisms/SuiteDirectory/__tests__/SuiteReach.test.tsx`, a driven fake observer, a stubbed heading rect and fake timers | 14 cases green; twelve planted defects in `SuiteReach.tsx` each seen failing the case written for it (the `bottom < 0` arm, the poll bound, the flag write, the flag read, the cleanup, the disconnect on send, the observer guard, the scroll listener's send, the listener's removal on send, the immediate check, the `typeof track` test, the `try` around `track`) | **Observed 2026-09-12**, `corepack pnpm vitest --run components/organisms/SuiteDirectory` |
| The attributes on every rendered row, the `You are here` row carrying the source event only, the attribute on the two anchors and nothing else, three distinct names, and the reach component mounted on the heading | `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx` | Green; four planted defects in `SuiteDirectory.tsx` each seen failing its case (the source anchor's `app` dropped, the attribute planted on the row, `SOURCE_EVENT` set equal to `LIVE_EVENT`, the reach component unmounted) | **Observed 2026-09-12** |
| The mechanism in a browser, with a stubbed `window.umami` installed through `addInitScript`: nothing before the scroll, one after, none on a reload in the same context, one again in a fresh context, one when the stub arrives after the heading is in view; on the default door and the reduced-motion door, each context asserted to have settled on its own door, and the late stub asserted to arrive inside the poll bound | `tests/e2e/visitor-instrumentation.pw.ts` | 6 cases green on this host in 55 s. Two planted defects seen failing their cases: the flag read removed fails exactly the reload case on both doors (2 failed, 4 passed); the send removed fails all six, every case carrying a positive reading. The pinned container run is CI's | **Observed 2026-09-12**, `corepack pnpm test:e2e tests/e2e/visitor-instrumentation.pw.ts` |
| The real instrument: one ordinary-browser session on cuatro.dev after the merge, scroll to the suite, one live and one source click, a reload; then `psql` on the box counting `website_event` rows with `event_type = 2` and the `event_data` rows for the two clicks; the Operator confirms the same three in the dashboard | cuatro.dev, the box, the dashboard | _not yet performed_: the events reach production when Epic 2 merges to `main` | Pending Operator actions 1 to 3 |
| What the change costs the visitor | `corepack pnpm build`, the client chunk carrying the home route's client code, before and after | 15,767 to 16,481 bytes, minified and uncompressed, +714; every other chunk byte-identical, 21 files, 2,013,004 to 2,013,718 in total. Next 16's route table no longer prints a First Load JS column, so the chunk is what was weighed; `ops/asset-budget.md` is not re-measured (DW-50) | **Observed 2026-09-12**, `.next/static/chunks/*.js` sizes at `ddfc134` and after; the new chunk is the one containing `suite-reach` |

## Pending Operator actions

This file hands the Operator work Story 2.24 may not do: reaching the box, browsing cuatro.dev as a
person, and reading the dashboard behind the managed challenge.

| # | Action | Owner | Note | Completed (UTC) |
|---|---|---|---|---|
| 1 | **Confirm the schema on the box**: `\d website_event` and `\d event_data` in `psql`, and correct § How each metric is read if a column differs | Operator, or the story's agent from a session that can reach the box | The queries were written from Umami v2's published schema, the SSH step having been refused in the story's session | _not done_ |
| 2 | **Fire the three events from an ordinary browser** on cuatro.dev after the epic merges: scroll to the suite, open one live and one source link, reload the tab | Operator | The reload is the once-per-session check: it must add no second `suite-reach` | _not done_ |
| 3 | **Count them on the box** with `select event_name, count(*) from website_event where event_type = 2 group by 1` and the `event_data` rows for the two clicks, then **run the three queries of § How each metric is read once** for the current month and paste their rows here; record the result and the merge date in § Verification session; confirm the same three in the dashboard | Operator | One row each with the expected `event_name` and `app` is the pass. The three queries are seen returning before any reading depends on them: a column that differs from the published schema fails here, not in a month's reading | _not done_ |
| 4 | **Keep the Operator's own visits out of the readings**: after the verification session, in the Operator's own browser on cuatro.dev, run `localStorage.setItem('umami.disabled', '1')` once in the console | Operator | The deployed tracker honours that key and sends nothing while it is set (the story's review read it in the fetched `script.js`, 2026-09-12). Per browser and per profile; a cleared site storage needs it again | _not done_ |
| 5 | **Take the first reading** into § Readings after the first full month | Operator | Replace the placeholder; later months go beneath | _not done_ |

**Maintaining this file.** When an action is performed, replace its `_not done_` cell with the ISO
8601 UTC completion date and leave the row in place. Renaming an event is an edit to § The events
and to the component that exports it, in one commit, or the suite is red. Keep the header row of
§ The events as it is: the suite parses it.
