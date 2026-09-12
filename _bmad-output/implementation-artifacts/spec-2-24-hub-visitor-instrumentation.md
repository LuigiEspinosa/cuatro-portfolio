---
title: 'Story 2.24: Hub visitor instrumentation'
type: 'feature'
created: '2026-09-12'
status: 'done'
baseline_commit: 'ddfc134573f1018292065a9d8877499318d917f1'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent: do not modify unless human renegotiates">

## Intent

**Problem:** The Hub measures page views and nothing else, so SM-1 (suite reach, target 60%), SM-2
(live click-through, 35%) and SM-3 (source drill-through, the Marcus signal) are aspirational: a
session that loaded `/` and a session that scrolled to the Directory and opened an application are
the same row in Umami. The tracker itself has been wired and rendering since Story 1-21
(`app/layout.tsx:47-53`), collecting since 2026-08-17 (`ops/bot-mitigation.md:339-371`), so the
instrument exists and only the events are missing (FR-34, AD-18).

**Approach:** Three Umami custom events, and nothing else on the wire. The two link events cost two
attributes on the anchors `SuiteDirectory.tsx` already renders, because the deployed tracker fires a
custom event on any click inside `[data-umami-event]` and reads `data-umami-event-*` as the event's
data (`analytics.cuatro.dev/script.js`, fetched 2026-09-12), so the Directory stays a server
component. The reach event is one small client component rendered inside the Directory that watches
the `#suite` heading with `IntersectionObserver`, waits for the tracker to exist, and calls
`window.umami.track` once per browser session, on both front doors. A new record,
`ops/visitor-instrumentation.md`, fixes the names, how each metric is read, the SM-C1 statement, the
ceilings and the verification session; after the epic's merge to `main` the three events are fired
from a real browser on cuatro.dev and counted in `website_event` on the box.

## Boundaries & Constraints

**Always:**

- **Names are `suite-reach`, `live-open`, `source-open`**, exported as constants, distinct by
  construction (a standing case holds the set at size three) and under Umami's 50-character limit.
  Each link event carries `app: <entry.id>` as its data, so SM-2 and SM-3 read per application.
- **`SuiteDirectory` stays a server component** (`SuiteDirectory.tsx:13-17`). The reach component
  imports nothing from `@/lib/registry` (`lib/__tests__/registry.test.ts:760-809`), renders `null`,
  and takes the heading's id as a prop. It is the only new file under `components/`.
- **Reach means the heading entered the viewport or is already above it.** The observer's callback
  counts `isIntersecting || boundingClientRect.bottom < 0`, so a visitor who flicked past the heading
  before the tracker loaded still counts, and the non-3D path, which reaches the Directory in zero
  interactions, counts on its initial notification.
- **The send waits for the tracker rather than assuming it.** `afterInteractive` injects the script
  after hydration, so the reach effect runs before `window.umami` exists; the component polls for it
  (250 ms, at most 80 ticks) and only then observes, so the observer's initial notification covers a
  heading already in view. No tracker within 20 s means nothing is observed and nothing is sent.
- **Once per session is a `sessionStorage` flag** keyed on the event name, read and written inside
  `try`, set when the event is sent. A storage that throws never blocks the send.
- **No third party, no new script, no edit to `app/layout.tsx`** (NFR-8; the tracker's gating on
  both `NEXT_PUBLIC_UMAMI_*` values at `:47` stays as it is, and the e2e build has neither).
- **Playwright proves the mechanism with a stubbed `window.umami`** installed through
  `addInitScript`, the `tests/e2e/front-door.pw.ts:259-279` context shape, on the default door and
  one non-3D door: no event before the scroll, one after, none on a reload in the same context, one
  again in a fresh context, and one when the stub arrives after the heading is already in view.
  Every planted control is seen failing its clean counterpart.
- **The real-session check is on cuatro.dev after the merge**, never against the production
  website id from `localhost`: the three events fired from an ordinary browser, then counted on the
  box with `docker exec cuatro-portfolio-anchor-db-1 psql -U umami -d umami` over
  `wsl -d Ubuntu-22.04 ssh deploy@177.7.52.248` (`ops/bot-mitigation.md:366-371`), one row each with
  the expected `event_name` and `app`. The dashboard confirmation is the Operator's
  (`ops/bot-mitigation.md:334-337`).
- **Every figure the record states has a standing case** under the blocking `test` job: the events
  table held equal to the exported names and to the attributes the rows render, in the
  `ops/__tests__/status-mark-axes.test.ts` shape with `ops/contract-adoption.mjs`'s parsers.

**Ask First:**

- Any event beyond the three, any event data beyond `app`, or carrying the narrative path on the
  reach event (the flat modifier is `HomeLayout`'s and Story 2-29 rewrites it).
- Moving the tracker to `beforeInteractive`, `data-auto-track="false"`, `data-domains`, or any
  other tracker attribute.
- Observing the whole section rather than the heading, or a `rootMargin`.

**Never:**

- No `ops/asset-budget.md` re-measure: `/` is dynamic since 2-13 and the tool cannot weigh it
  (DW-50). The `next build` route table's First Load JS for `/` before and after is quoted instead.
- No hash-only "reach" through the nav link's pageview: `/#suite` records a pageview on the click
  path alone and never on a scroll, which is the case the story exists for.
- No edit to `contracts/`, `ci.yml`, `deploy.yml` or the WAF rules; no bot commit; no dashboard
  automation (the managed challenge refuses it by design).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default door, scroll to the suite | Tracker present, heading below the fold, fresh session | Nothing sent on mount; one `suite-reach` when the heading enters the viewport; flag set; observer disconnected | none |
| Non-3D door | Same, on `reduced-motion` | Identical; the door changes nothing here | none |
| Heading in the first viewport | Tall viewport or flat hero, tracker arrives after paint | Poll finds the tracker, observes, the initial notification is intersecting, one event | none |
| Flicked past before the tracker loaded | `bottom < 0`, not intersecting | Counted as reached, one event | none |
| Reload, same tab | Flag present | Nothing observed, nothing sent | none |
| New tab or context | No flag | One event again | none |
| Tracker never loads | Ad blocker, or the e2e build with no `NEXT_PUBLIC_UMAMI_*` | 80 polls, then silence; no observer | none |
| `IntersectionObserver` absent | Old browser, jsdom | Effect returns at once | none |
| `sessionStorage` throws | Storage disabled | Event still sent | `try` around both accesses |
| Live link clicked | Anchor `data-umami-event="live-open"` `data-umami-event-app="<id>"` | The tracker sends `live-open` with `{ app }`, `target="_blank"` navigation untouched | tracker's own |
| Source link clicked | `data-umami-event="source-open"` | `source-open` with `{ app }` | tracker's own |
| `You are here` row | No live anchor | No `live-open` attribute anywhere on the row; the Source link keeps its own | none |
| Row body clicked | Not inside `[data-umami-event]` | Nothing sent; the row is never a target (`SuiteDirectory.test.tsx:194-206`) | none |

</frozen-after-approval>

## Code Map

**Governing text**

- `ARCHITECTURE-SPINE.md:255` the measurement convention: first-party, self-hosted, Hub events are
  Umami custom events distinguishable per SM-1 to SM-3; `:185-189` AD-18; `:404` FR-34 under AD-18.
- `prd.md:565-573` FR-34; `:737-739` SM-1, SM-2, SM-3; `:755` SM-C1 (the sentence the record must
  carry); `:637` NFR-8. `epics.md:2918-2953` the story. `epic-2-context.md:75-79,150-153`.

**The tracker as deployed (Observed 2026-09-12, `GET https://analytics.cuatro.dev/script.js`, 4,733
bytes, 200)**

- A capture-phase `click` listener resolves `e.target.closest('[data-umami-event]')`, collects every
  `data-umami-event-<key>` attribute into the event data, and sends `{ name, data }` to `/api/send`
  with `keepalive: true`. For an `<a href>` with `target="_blank"` (or a modifier key) it does not
  `preventDefault`; otherwise it sends, then navigates. `window.umami = { track, identify,
  getSession }` is set when the script evaluates, before the first pageview. `pushState` and
  `replaceState` are wrapped for pageviews; there is no `hashchange` listener. `exclude-hash` is not
  set, so the nav link's `/#suite` push is a pageview with the hash.
- `app/layout.tsx:47-53`: `<Script strategy='afterInteractive'>` gated on both env values; nothing
  else references the tracker. `docker-compose.yml:26-34` bakes both at image build;
  `.github/workflows/lighthouse.yml:29-30` sets both empty; `ci.yml:276-277` sets neither, so the
  e2e build renders no script.

**Where the events go**

- `components/organisms/SuiteDirectory/SuiteDirectory.tsx:29` `HEADING_ID = 'suite'` (the id the
  reach component takes); `:75-127` `SuiteDirectoryRow`; `:110` the live anchor, `:115-121` the
  source anchor (both `target='_blank' rel='noopener noreferrer'`); `:129-168` `SuiteDirectory`, the
  section, where the reach component mounts as the last child.
- `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx:60-62` `rows`, `nameOf`,
  `drawn`; `:129-139` source link case; `:141-170` live link case; `:194-206` two destinations, the
  row never one. The new attribute cases sit beside these, on `drawn()` and on the `Complete`
  fixture at `:257-266`.
- `hooks/useNarrativePath.ts:60-69` the `declare global` precedent for a browser API
  `lib.dom.d.ts` lacks; the `window.umami` declaration goes in the reach module the same way.
  `:99-108` `try` around a tidy that must not decide the outcome.

**Shapes to reuse**

- `tests/e2e/front-door.pw.ts:189-233` the doors; `:259-279` `onPath` (restate the context options,
  never inherit); `:287-294` `goTo`; `:311-331` `settled`; `:665-669` `scrollIntoView` on the
  heading then `toBeInViewport`. `tests/e2e/suite-directory.pw.ts:300-311` the heading sits below
  the fold at 360x800, so a scroll is real on both doors. `harness.ts:11` `RENDERED_VIEWPORT`.
- `ops/__tests__/status-mark-axes.test.ts:28-97` the record reader (`read` with CRLF normalised,
  `section`, `table`, `unticked` from `ops/contract-adoption.mjs:76-139`); `ops/registry-verification.md:1-31`
  the record head; `:42-45` the property table with a Nature column.
- `ops/monitoring.md:328-336` the empty-baseline statement the record cites, and where this story's
  dated pointer goes. `ops/bot-mitigation.md:47-49` rule 4 exempts `/api/` and `/script.js`;
  `:334-337` no agent can render the dashboard; `:366-371` the `psql` count that needs no credential.
- `.github/workflows/deploy.yml` deploys every push to `main`; `origin/main..dev` is 78 commits, 17
  Epic 2 features, so the merge that enables the real-session check is the epic going live.

**Pins a new file trips**

- None. `anchor-contract.test.ts:102` scans `components/` for token and family names only;
  `registry.test.ts:789` walks client files for Registry value imports; nothing enumerates
  `tests/e2e/*.pw.ts` or `ops/*.md`. `deferred-work.md`: next free id DW-88.

## Tasks & Acceptance

**Execution:**

- [x] `components/organisms/SuiteDirectory/SuiteReach.tsx`: new client component. Exports
      `REACH_EVENT`, `TRACKER_POLL_MS`, `TRACKER_POLL_LIMIT` and `SuiteReach({ target })`; declares
      `Window.umami`; effect per the Always rules; renders `null`.
- [x] `components/organisms/SuiteDirectory/SuiteDirectory.tsx`: export `LIVE_EVENT`, `SOURCE_EVENT`;
      the two attributes on each anchor; `<SuiteReach target={HEADING_ID} />` last inside the
      section; docblock lines on why the Directory still has no client boundary of its own.
- [x] `components/organisms/SuiteDirectory/__tests__/SuiteReach.test.tsx`: new. A fake
      `IntersectionObserver` the test drives and fake timers; every matrix row that is the
      component's; unmount clears the interval and disconnects.
- [x] `components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx`: the live and source
      attributes on every drawn row and on the `Complete` fixture; the `You are here` row carries the
      source attribute only; no element outside the two anchors carries `data-umami-event`; the
      three names form a set of three.
- [x] `tests/e2e/visitor-instrumentation.pw.ts`: new. Stubbed tracker recording `track` calls into
      `window.__umamiCalls`; the five Always cases on `default` and `reduced-motion`; the attributes
      present on rendered anchors; planted controls.
- [x] `ops/visitor-instrumentation.md`: new record. § The events (Event, Fires when, Data, Nature);
      § How each metric is read (SM-1, SM-2, SM-3 as SQL over `website_event` and `event_data`,
      distinct sessions, written after observing the schema on the box); § Time on site is not a
      target (SM-C1 verbatim: a fall alongside a rise in SM-2 is a good outcome); § Stated limits
      (ad blockers undercount, `sessionStorage` is per tab, middle-click fires no `click`, the
      2026-08-17 baseline, no dashboard automation); § Readings (month, sessions, reached, share,
      opened live, opened source, taken by); § Verification session; § Pending Operator actions.
      **Schema not observed on the box**: the SSH step was refused in the build session, so the SQL
      is written from Umami v2's published schema and its confirmation is the record's Pending
      Operator action 1.
- [x] `ops/__tests__/visitor-instrumentation.test.ts`: new. The events table held equal to the
      exported names; the parser seen firing on a planted table.
- [x] `ops/monitoring.md:333`: a dated line after the baseline paragraph pointing at the record.
- [x] `deferred-work.md`: file the ceilings that are not this story's to close (DW-88, DW-89).
- [ ] After the merge: the three events from an ordinary browser on cuatro.dev, the `psql` counts,
      the build's First Load JS for `/` before and after, all into the record's § Verification
      session and this spec's Verification. The build figure is taken (below); the rest waits on the
      merge.

**Acceptance Criteria:**

- Given `corepack pnpm test --run` and `corepack pnpm typecheck`, when they run, then both pass, and
  every planted control in the two new suites and the new cases has been observed failing its clean
  counterpart.
- Given `corepack pnpm test:e2e tests/e2e/visitor-instrumentation.pw.ts`, when it runs on this host
  and in the pinned container, then the stubbed tracker records exactly one `suite-reach` per
  context on both doors and zero before the scroll.
- Given the deployed Hub after the merge, when one ordinary-browser session scrolls to the suite and
  opens one live and one source link, then `website_event` holds one `suite-reach`, one `live-open`
  and one `source-open` for that session, each link event with the expected `app`, and the reload
  of the same tab adds no second `suite-reach`.
- Given the record, when the Operator reads it, then it names the three events, states how each of
  SM-1 to SM-3 is computed, carries the SM-C1 sentence, the baseline date, the ceilings and the
  verification session, each Observed with method or Decision with reason.

## Spec Change Log

**2026-09-12, review pass, all findings applied as patches.**

- **A `scroll` listener beside the observer.** An `IntersectionObserver` notifies on a change of
  intersection, so a jump past the heading between two frames (End, Ctrl+End, a scrollbar drag)
  goes from below to above with no crossing and the `bottom < 0` arm never runs after attach. The
  listener (`passive`) reads the rect on the next scroll and sends; one `send()` serves both paths
  and removes both.
- **The tracker is a `track` function, checked once at once.** `typeof window.umami?.track ===
  'function'` rather than truthiness, so a foreign `window.umami` keeps the poll going instead of
  throwing in the callback; the `track` call is inside `try`. The check runs synchronously before
  the interval, so a client navigation back to `/` observes at once; the bound stays 80 interval
  ticks.
- **The record's unit is `visit_id`, and the flag-versus-visit bias is stated.** Umami's
  `session_id` names a visitor for a month under `SALT_ROTATION`; `visit_id` is the sitting the PRD
  calls a session. `sessionStorage` outlives the visit in a tab kept open past the hour, so SM-1
  undercounts by those visits; stated as a limit with bots-in-the-denominator, not corrected.
  Readings gain `Live share` and `Source share`; the SQL literals are held to the exports by a case
  over every fenced block.
- **Deletions.** The two `Complete`-fixture attribute cases (the drawn rows prove the same path),
  the e2e's stub-recorder and planted-flag controls (every positive case sees the recorder record;
  the flag gate with no prior send is the unit suite's) and its attributes case (server markup,
  proved in jsdom); the ops suite's row-count case and second baseline read; two unit cases that
  restated the first case's positive path or asserted an empty container. The e2e asserts each
  context settled on its own door and that the late stub lands inside the poll bound.
- **KEEP.** Attributes, not handlers, for the two link events; observe after the tracker, not
  before; the heading, with the `bottom < 0` arm; the record parsed by a standing case under the
  blocking `test` job.

## Design Notes

**Why the attributes and not a client handler.** The tracker already owns a capture-phase click
listener that handles `_blank`, modifier keys and `keepalive`; a React `onClick` calling
`umami.track` would re-implement that on the client, force a boundary into a component whose
server-ness is asserted (`SuiteDirectory.tsx:13-17`), and race the navigation on a same-tab link.
Two attributes is the platform rung.

**Why observe after the tracker, not before.** Observing first and queueing the send needs a
"reached but unsendable" state and a second wait; observing after means the observer's initial
notification is the only path and it already answers "in view now" and "already past". The one
cost is the poll, bounded and cleared on unmount.

**Why the heading and not the section.** `#suite` is what `/#suite`, the skip control and the nav
link all resolve to, so every way of arriving is measured against one element; the `bottom < 0`
arm is what makes a flick past it count. Section-level observation would count a one-pixel sliver.

**Skipped: the narrative path as reach data.** It would split SM-1 by door, which is the diagnosis
SM-1 exists for, but reading it means coupling to `HomeLayout`'s flat modifier that 2-29 rewrites.
Add when a reading needs the split; the seam is one `data` argument.

## Verification

**Commands:**

- `corepack pnpm test --run`: expected all files pass, the two new suites and the new cases among them.
- `corepack pnpm typecheck`: expected exit 0.
- `corepack pnpm test:e2e tests/e2e/visitor-instrumentation.pw.ts`: expected green on this host
  (functional cases only, no screenshot); the pinned container run is CI's.
- `corepack pnpm build`: the route table's `ƒ /` First Load JS, before and after, quoted.

**Manual checks:**

- After the merge and the deploy: cuatro.dev in an ordinary browser, scroll to the suite, click one
  live and one source link, reload; then over SSH `psql -U umami -d umami -c "select event_name,
  count(*) from website_event where event_type = 2 group by 1"` and the `event_data` rows for the
  two clicks. The Operator confirms the same three in the dashboard.

**Observed 2026-09-12, build session:**

- `corepack pnpm test --run`: 53 files, 1297 tests, all passed in 105 s. `corepack pnpm typecheck`:
  exit 0.
- Planted defects, each seen failing its case and nothing else, then restored: in `SuiteReach.tsx`
  the `bottom < 0` arm, the poll bound, the flag write, the flag read, the cleanup, the disconnect
  on send, the `IntersectionObserver` guard; in `SuiteDirectory.tsx` the source anchor's `app`, the
  attribute planted on the row, `SOURCE_EVENT` set equal to `LIVE_EVENT`. In the record: an event
  renamed, reach given data, the SM-C1 sentence altered, the monitoring pointer dropped.
- `corepack pnpm test:e2e tests/e2e/visitor-instrumentation.pw.ts`: 9 passed in 1.3 min on this
  host. Against the flag read removed: exactly the two silence cases red on both doors (3 failed, 6
  passed); against the send removed: all six positive cases red, both silences and the attributes
  green (6 failed, 3 passed). The pinned container run is CI's.
- The build: Next 16's route table prints no First Load JS column, so the client chunk carrying the
  home route's client code was weighed instead: 15,767 to 16,481 bytes minified and uncompressed
  (+714), the only chunk that changed, 2,013,004 to 2,013,718 across 21 files. Recorded in the
  record's § Verification session.
- Not performed: the schema read on the box (SSH refused by the session's tooling) and the
  real-session check, which waits on the epic's merge. Both are the record's Pending Operator
  actions 1 to 3.

**Observed 2026-09-12, after the build session, by the orchestrating session:**

- The record's unit corrected from `session_id` to `visit_id` before review. Umami's `session_id`
  is `uuid(website, address, user agent, salt)` with `SALT_ROTATION` defaulting to `month`, so it
  names a visitor for a month; `visit_id` is `uuid(session_id, salt of the hour)` carried by the
  tracker's cache token, which is the PRD's session. Read 2026-09-12 from `umami-software/umami`
  `master`, `src/app/api/send/route.ts` and `prisma/schema.prisma` (`gh api`, raw); the column
  names the record's SQL uses are the ones that schema maps. The ops suite's pin moved with it.
- `corepack pnpm test --run` over the corrected record: `Test Files  53 passed (53)`,
  `Tests  1297 passed (1297)`, `Duration  113.89s`. `corepack pnpm typecheck`: exit 0.

**Observed 2026-09-12, after the review pass (Spec Change Log above), build session:**

- `corepack pnpm typecheck`: exit 0. `corepack pnpm test --run`: `Test Files  53 passed (53)`,
  `Tests  1297 passed (1297)`, `Duration  104.91s` (one reach case added, one Directory mount case
  added, two fixture cases and one ops case removed, one ops case added: the count is unchanged).
- `corepack pnpm test:e2e tests/e2e/visitor-instrumentation.pw.ts`: `6 passed (54.8s)` on this
  host, each context asserted on its own door.
- Planted defects against the reviewed code, each seen failing its case and nothing else, then
  restored. `SuiteReach.tsx`, twelve: the seven from the first pass re-planted (the `bottom < 0`
  arm, the poll bound, the flag write, the flag read, the cleanup, the disconnect on send, the
  observer guard) and five new: the scroll listener's send removed (fails "catches a jump past the
  heading on the next scroll" alone), the listener not removed on send (the same case, on its
  second scroll), the immediate check removed (eight cases, every one that mounts with the tracker
  present), truthiness in place of `typeof track` (fails the no-`track` case alone), `track` left
  outside `try` (fails the throwing-tracker case alone). `SuiteDirectory.tsx`, four: the source
  anchor's `app`, the attribute on the row, `SOURCE_EVENT` equal to `LIVE_EVENT`, and the reach
  component unmounted (fails the new mount case alone). The record: the event renamed in every
  SQL block (fails the fenced-block case alone; renamed in one block only it passes, by design),
  `count(distinct e.session_id)` planted (two cases), a readings column dropped (one case).
- The browser suite against the flag read removed: `2 failed`, `4 passed`, the reload case on both
  doors; against the send removed: `6 failed`, every case carrying a positive reading.
- Still not performed: the schema read on the box and the real-session check, which wait on
  reachable SSH and on the epic's merge; the record's Pending Operator actions 1 to 4.

**Observed 2026-09-12, after the review pass, by the orchestrating session:**

- `corepack pnpm test --run`: `Test Files  53 passed (53)`, `Tests  1297 passed (1297)`,
  `Duration  109.93s`. `corepack pnpm typecheck`: exit 0.
- `corepack pnpm test:e2e tests/e2e/visitor-instrumentation.pw.ts`: `6 passed (1.0m)`, three cases
  on each door, run on this host.

## Suggested Review Order

**The reach event, the one that needs script**

- Start here: the tracker is a `track` function, checked once at mount, then polled and only then observed.
  [`SuiteReach.tsx:58`](../../components/organisms/SuiteDirectory/SuiteReach.tsx#L58)

- One `send()` for both paths: disconnects, drops the listener, tracks and remembers, each inside `try`.
  [`SuiteReach.tsx:72`](../../components/organisms/SuiteDirectory/SuiteReach.tsx#L72)

- The observer's callback: in view, or already above (`bottom < 0`), on its initial notification.
  [`SuiteReach.tsx:96`](../../components/organisms/SuiteDirectory/SuiteReach.tsx#L96)

- The scroll listener beside it: a jump past the heading between frames never intersects.
  [`SuiteReach.tsx:87`](../../components/organisms/SuiteDirectory/SuiteReach.tsx#L87)

- The bounded poll, collapsed to one clearing branch; 80 ticks after the immediate check.
  [`SuiteReach.tsx:103`](../../components/organisms/SuiteDirectory/SuiteReach.tsx#L103)

- Mounted last in the section as a reading choice; the effect runs after commit either way.
  [`SuiteDirectory.tsx:194`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L194)

**The two link events, which cost two attributes**

- Why the Directory keeps no client boundary of its own.
  [`SuiteDirectory.tsx:20`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L20)

- The names, exported so the record and the suite hold them.
  [`SuiteDirectory.tsx:44`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L44)

- The live anchor: `data-umami-event` and the entry id as `app`; the tracker does the rest.
  [`SuiteDirectory.tsx:131`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L131)

- The Source anchor, on every row including `You are here`.
  [`SuiteDirectory.tsx:144`](../../components/organisms/SuiteDirectory/SuiteDirectory.tsx#L144)

**What the record fixes**

- The three events, what fires each, and the decisions behind the heading and the flag.
  [`visitor-instrumentation.md:38`](../../ops/visitor-instrumentation.md#L38)

- Session is Umami's visit, not its monthly `session_id`; read off the source, to confirm on the box.
  [`visitor-instrumentation.md:50`](../../ops/visitor-instrumentation.md#L50)

- SM-1 to SM-3 as SQL over distinct `visit_id`, and why the denominators are what they are.
  [`visitor-instrumentation.md:120`](../../ops/visitor-instrumentation.md#L120)

- SM-C1 verbatim: a fall in time on site beside a rise in SM-2 is a good month.
  [`visitor-instrumentation.md:124`](../../ops/visitor-instrumentation.md#L124)

- The flag outlives the visit, and bots sit in the denominator: stated, not corrected.
  [`visitor-instrumentation.md:144`](../../ops/visitor-instrumentation.md#L144)

- What the Operator is handed: the schema, the real session, their own browser, the first reading.
  [`visitor-instrumentation.md:182`](../../ops/visitor-instrumentation.md#L182)

**The suites**

- The reach component on a driven fake observer: the jump caught on the next scroll, once.
  [`SuiteReach.test.tsx:122`](../../components/organisms/SuiteDirectory/__tests__/SuiteReach.test.tsx#L122)

- The tracker arriving late, and the initial notification covering a heading already in view.
  [`SuiteReach.test.tsx:143`](../../components/organisms/SuiteDirectory/__tests__/SuiteReach.test.tsx#L143)

- The attribute on the two anchors and on nothing else, so no row is ever a target.
  [`SuiteDirectory.test.tsx:304`](../../components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx#L304)

- The Directory seen mounting the reach component on its own heading.
  [`SuiteDirectory.test.tsx:319`](../../components/organisms/SuiteDirectory/__tests__/SuiteDirectory.test.tsx#L319)

- The browser: each context asserted on its own door before anything is read.
  [`visitor-instrumentation.pw.ts:118`](../../tests/e2e/visitor-instrumentation.pw.ts#L118)

- The late stub, with the time it took measured against the poll bound.
  [`visitor-instrumentation.pw.ts:266`](../../tests/e2e/visitor-instrumentation.pw.ts#L266)

- The record held to the exports: the table, the rendered attributes, and every SQL block.
  [`visitor-instrumentation.test.ts:113`](../../ops/__tests__/visitor-instrumentation.test.ts#L113)

**Peripherals**

- The baseline paragraph the record cites, now pointing back.
  [`monitoring.md:338`](../../ops/monitoring.md#L338)

- DW-88 (reach not split by door) and DW-89 (the undercount nothing measures).
  [`deferred-work.md:4317`](deferred-work.md#L4317)
