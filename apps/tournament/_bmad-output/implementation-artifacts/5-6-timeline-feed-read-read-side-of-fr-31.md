---
baseline_commit: f0673624732a79b8799b7c221d1645cd7e10806d
---

# Story 5.6: Timeline feed read (read side of FR-31)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want a chronological feed of approved-only events as the single source of truth,
so that I follow the whole event from one place without seeing anything unpublished.

## ⚠ Read this first — the two things that will bite you

1. **This is a READ story. Do NOT build feed writers.** The epic AC is explicit: *"posting an entry is owned by Story 4.6's Aprobar transaction."* The `timeline_feed` table already exists (migration `0017`) and today **only `match_result` rows are ever written to it**. `bracket_advance` and `award_reveal` are provisioned in the `entry_type` enum but **have no writer anywhere** (bracket-advance writer is deferred; awards are Epic 6). Your surface must render all three card types *by construction* (so it is forward-compatible), but you will only ever see `match_result` rows at read time. Building the missing writers is **out of scope** — see [Dev Notes → Scope boundary](#scope-boundary-the-writer-gap-is-not-yours) and the flagged decision at the end. Do not "fix" the empty feed by adding an INSERT.

2. **This is the FIRST viewer UI in the repo. There is no styling system, no i18n module, no component directory, no browser Supabase client, no generated DB types.** You are laying the foundations Story 5.7 and 5.8 build on. Everything you establish here (design tokens, the single Spanish i18n module, viewer component location, the reusable snapshot-read function) is a convention the next two stories inherit — get it right, keep it small.

## Acceptance Criteria

> Restated and made testable from `epics.md:925-945` (Story 5.6) + FR-31, FR-32, AD-7, AD-11, AD-24, UX-DR1. Numbers/paths below are the dev-agent contract.

**AC1 — Chronological approved-only feed (FR-31, AD-7).** A viewer surface renders `public.timeline_feed` rows for the current tournament, **newest-first**, ordered by **`id desc`** (the identity PK — **NOT `occurred_at`**; an atomic Aprobar stamps every row with the same `now()`, so `occurred_at` sorts nondeterministically — `0017:107,110,115,117`). The read goes through the **anon/RLS client** (`createSupabaseServerClient()`), never the service-role client. A `Pending` event never appears: the feed carries **no status column** — AD-7 is satisfied *by construction* because `timeline_feed` rows are only ever written post-approval inside `approve_match` (`0017:129-135`). No client-side filtering makes an unpublished row appear.

**AC2 — All three entry types render by construction; only `match_result` populates today (FR-31).** The card renderer switches on `entry_type ∈ ('match_result','bracket_advance','award_reveal')` and renders each per the mock (see AC5). Because only `match_result` has a writer, the live feed shows result cards only — this is correct, not a bug. Do not add a writer. Do not hide the `bracket_advance`/`award_reveal` branches (5.8 and Epic 6 will populate them; the renderer must already handle them).

**AC3 — Rail-node color is a pure function of `entry_type` (UX MUST).** Each entry is anchored to a vertical timeline rail with a circular node whose color encodes the type: **blue** (`#2F81F7`) = `bracket_advance`; **green** (`#3FB950`) = `match_result`; **gold** (`#FFB23E`) = `award_reveal` **only** (gold is the single sanctioned gold-in-feed leak — gold on any non-reveal entry is a bug). Node coloring is a pure `entryType → color` map, reused verbatim by 5.8 for streamed entries (`mock-home.html:218-229`, `DESIGN.md:99,265`).

**AC4 — Match-result card content + provenance (FR-31, AD-24).** A `match_result` card renders, from the row + its `detail` jsonb (`0017:392-405`):
- timestamp line `HH:MM · <bracket_position>` (24-hour, tabular numerals; `occurred_at` for the time, `detail->>'bracket_position'` for the suffix);
- title `«{winner} venció a {loser}»` — winner bold, "venció a" muted;
- score `{score_a}–{score_b}` with the winner's number green, loser's red (tabular);
- a provenance meta-row of chips: `✓ aprobado`, `✓ verificado desde el demo`, and a truncated `demo_sha256` hash chip (all Spanish copy from the i18n module).

⚠ **Name resolution is a required join, not a given.** `detail.winner_entry`/`detail.loser_entry` are **`roster_entry.id` (bigint), NOT steamid64 and NOT names** (`0017` writes `match.winner_entry`/competitor ids). To render "Dex venció a Theo" you MUST join `roster_entry.id → roster_entry.steamid64 → player.display_name`. See [Dev Notes → Name resolution](#name-resolution-the-feed-carries-roster-ids-not-names).

**AC5 — Empty + cold-load states, never a blank screen (UX MUST).** When the tournament has zero feed rows, render the pre-event empty state (dashed ring, headline `El feed está en silencio — por ahora`, the canonical fixed body `El evento aún no empieza. Inscripciones abiertas.`, registration pill). The first load must never flash blank — render the feed if present, else a skeleton/loading state (`Cargando el evento…`). Copy is exact/fixed per the i18n module (`EXPERIENCE.md:108,110`; `mock-home.html:505-510`).

**AC6 — Four-up navigation shell (FR-32, UX-DR1).** A mobile-first four-up nav reaches **Feed / Llave / Estadísticas / Ceremonia** (in that order), active tab = blue underline, **Ceremonia locked** (dimmed `#5d6875` + lock glyph) until the ceremony is started. Follow the `mock-home.html` top-row nav + the spine as authoritative — **ignore** the divergent bottom-tabbar in `mock-bracket.html` (`EXPERIENCE.md:52,102`; `mock-home.html:161-181,498-503`). The Feed tab is active on this surface. Sibling routes (bracket/leaderboards/ceremony) are **Story 5.7's** content — 5.6 establishes the nav + the route targets; those pages may be stubs/placeholders until 5.7 (see [Project Structure Notes](#project-structure-notes)).

**AC7 — Tap-to-route-to-subject (FR-32, UX-DR1).** The whole card is a ≥44px tap target that routes to its subject, read-only, no mutation: `match_result` / `bracket_advance` → the bracket (focused match via `target_match_id`, nullable — tolerate a null link); award/player mentions → leaderboard/player detail. Destinations are 5.7 surfaces; 5.6 wires the links to their intended routes (a link to a not-yet-built 5.7 page is acceptable — do not build the destination here).

**AC8 — Reconstructable-from-published-read; a reusable snapshot fetch (AD-11).** The entire feed renders from **one published-state read** — no client-derived, wire-only, or optimistic state. Extract the read into a single reusable function (e.g. `lib/feed/read.ts` → `fetchFeedSnapshot(client, tournamentId)`) that returns the fully-resolved, ordered, name-joined feed. **Story 5.8 re-invokes this exact function** on realtime nudge/reconnect (it must never replay events). Build the render as a stable, keyed list (stable identity per `id`) so 5.8 can prepend without wiping scroll position (`EXPERIENCE.md:109,134`).

**AC9 — Spanish from one i18n module, machine values → labels (AD-24).** Establish the project's **single Spanish i18n copy module** (the first one — none exists). **No inline English or Spanish string literals in the viewer components** — every viewer-facing string resolves through the module. Load-bearing fixed strings are verbatim and must not be paraphrased: `Verificado desde el demo`, `aprobado`/`Aprobado`, `El evento aún no empieza. Inscripciones abiertas.`, nav labels `Feed`/`Llave`/`Estadísticas`/`Ceremonia`. DB emits machine values only; the module maps them to labels. Full copy inventory in [Dev Notes → i18n copy inventory](#i18n-copy-inventory-establish-the-module-here).

**AC10 — Mobile-first, dark, tabular, no horizontal scroll (AD-24, UX-DR2/6/8/13/14).** Single-column ~390px, 16px side margins, dark tokens (see [Dev Notes → design tokens](#design-tokens-lift-from-the-mock-verbatim)), **tabular lining numerals on every numeric value** (scores, times, hash, counters), Archivo for display / system-ui for body. The feed must **never** scroll horizontally (long names/scores `flex-wrap`, `box-sizing:border-box`, `max-width:100%`). A screen-reader `aria-live` line announces new results: `Resultado aprobado: Dex venció a Theo 16-13` (`EXPERIENCE.md:145`).

**AC11 — Tests + gates green.** Unit-test the **pure logic** you can test in the existing node-only Vitest without a new browser env: `entryType → node-color`, the `HH:MM · <position>` timestamp formatter, the `detail`-payload → card-model mapping, and the name-resolution/join shaping (with a faked Supabase client, mirroring `lib/**/*.test.ts` precedent). Full existing suite stays green (`npm test`), `npm run lint` clean, `npm run build` succeeds (the new page must compile and not statically prerender a per-request read). A React component-render test env is **optional** — if you add jsdom it's net-new config (Vitest is node-only today); prefer testing the extracted pure functions and verifying the rendered surface by local live-QA (Task 8), matching the worker's fakes-plus-live-QA convention.

## Tasks / Subtasks

- [x] **Task 1 — Establish the viewer design-token foundation (AC3, AC10)**
  - [x] Add a single global stylesheet exposing the dark design tokens as CSS custom properties, lifted **verbatim** from `mock-home.html:11-25` / `DESIGN.md:15-26` (page `#0F1419`, s1 `#171E26`, s2 `#1E2832`, line `#232C36`, tp `#F4F6F8`, ts `#B7C2CE`, tm `#8A97A6`, blue `#2F81F7`, gold `#FFB23E`, win `#3FB950`, loss `#F0556A`, plus radii 6/12/16/pill and the 4/8/12/16/24/32 spacing scale). Import it once in `app/layout.tsx`. Load Archivo (display) — self-host or `next/font`; do NOT hotlink Google Fonts in production (the mock's `<link>` is mock-only). See [decision on styling approach](#decision-styling-approach). — `app/globals.css`; Archivo via `next/font/google` (self-hosted at build).
  - [x] Keep the existing `app/layout.tsx` inline body palette consistent with the tokens (currently `#0e1015`/`#e8e8ea` — reconcile to `#0F1419`/`#F4F6F8`). — body now driven by `var(--page)`/`var(--tp)` from the token sheet.
- [x] **Task 2 — Establish the single Spanish i18n copy module (AC9)**
  - [x] Create the one copy module (e.g. `lib/i18n/es.ts` + a tiny typed accessor). Populate every feed/nav/state string from the [copy inventory](#i18n-copy-inventory-establish-the-module-here), fixed strings verbatim. Add the machine-value→label maps (`entry_type`, `status`). No English/Spanish literals anywhere in the components. — `lib/i18n/es.ts` (`es` const + `resultadoAprobado`, `entryTypeLabel`, `statusLabel`).
- [x] **Task 3 — The reusable snapshot read (AC1, AC4, AC8)** — `lib/feed/read.ts`
  - [x] `fetchFeedSnapshot(client, tournamentId)`: select `timeline_feed` where `tournament_id = $1` order by `id desc`, via the passed **anon** client. Hand-type the row + the `detail` payload (no generated types exist — mirror the hand-typed RPC-reply precedent, e.g. `lib/match/approve.ts:33-40`). — types in `lib/feed/types.ts`.
  - [x] Resolve display names: join/lookup `roster_entry.id → steamid64 → player.display_name` for `detail.winner_entry`/`loser_entry` (batch the roster ids in one `in(...)` query; see [name resolution](#name-resolution-the-feed-carries-roster-ids-not-names)). Return a fully-shaped, ordered card-model array — the surface does no further data work. — two batched `.in(...)` queries; removed-player id degrades to a neutral label.
  - [x] Resolve the current tournament id (see [decision](#decision-current-tournament-resolution)); keep it a small, replaceable helper. — `resolveCurrentTournament(client)` (newest row → `{id, state}`).
- [x] **Task 4 — Pure card-model + presentation helpers (AC3, AC4, AC11)** — `lib/feed/model.ts`
  - [x] `entryTypeNode(entryType) → 'blue'|'green'|'gold'|'muted'` pure map. — unknown → `muted` (never gold).
  - [x] `formatFeedTime(occurredAt, bracketPosition) → "HH:MM · <pos>"` (24h, no relative "hace X" — the artifacts use absolute `HH:MM · context`). — UTC-based for determinism; degrades on a bad timestamp.
  - [x] `toCardModel(row, names) → {kind, node, title, score, provenance, href, aria}` mapping the `detail` payload per entry type. These are the node-testable units for Task 7. — a discriminated union per kind (house `{ok}` style); winner is the higher score, so seat-order coloring needs no seat→entry map.
- [x] **Task 5 — The feed surface + nav shell (AC1–AC7, AC10)** — the viewer page
  - [x] Server Component that calls `fetchFeedSnapshot` via `createSupabaseServerClient()` and renders the timeline (rail + nodes + cards), day-group header, empty/cold-load states, and the four-up nav. Establish where viewer components live (e.g. `app/(viewer)/` route group + a colocated `components/` — see [Project Structure Notes](#project-structure-notes)). Lift the card/rail/chip/nav CSS from `mock-home.html` (CSS Modules or the global sheet). — `app/(viewer)/` route group; shell in `layout.tsx`, feed in `page.tsx`, CSS Modules.
  - [x] Wire the feed as the tournament **home** (`/`) — see [decision on routing](#decision-route--home-placement). Mark `export const dynamic = 'force-dynamic'` (per-request read; mirror the route-handler precedent) so the page is not statically prerendered. — old `app/page.tsx` removed; `/` is now the feed (`ƒ` dynamic in the build).
  - [x] Card = full-card `<a>`/`Link` tap target (≥44px) to its subject route (AC7). Ceremonia nav tab locked. — each item is a `<Link>`; Ceremonia a non-link locked span until ceremony/closed.
  - [x] `aria-live` region for the newest result (AC10). — sr-only `aria-live="polite"` with the newest result's aria line.
- [x] **Task 6 — Route targets / nav destinations (AC6, AC7)**
  - [x] Ensure the nav + card links point at the intended 5.7 routes. Provide minimal placeholder routes ONLY if a hard 404 would break the nav shell's usability; otherwise leave the destinations to 5.7 and note the coupling. Do not build bracket/leaderboard/player-detail content here. — `/bracket`, `/leaderboards`, `/ceremonia` are minimal `Placeholder` stubs under the shared shell (a bare 404 would break the nav).
- [x] **Task 7 — Unit tests (AC11)**
  - [x] Node-Vitest tests for `entryTypeNode`, `formatFeedTime`, `toCardModel`, and `fetchFeedSnapshot` name-resolution shaping (faked Supabase client à la `lib/roster.test.ts`). Cover: ordering by `id desc`; a null `target_match_id` (tolerated); a `roster_entry` id that doesn't resolve (graceful fallback, not a crash — see the removed-player edge); empty feed → empty array. — `lib/feed/model.test.ts` + `lib/feed/read.test.ts` (all four cases covered, incl. the steamid-tail fallback and a name-join error path).
- [x] **Task 8 — Gate + local live-QA**
  - [x] `npm run lint`, `npm test`, `npm run build` all green. Live-QA: seed/approve at least one match so a real `match_result` row exists (or hand-insert a row as service_role in a throwaway), load the home surface as an anonymous browser session, confirm: the card renders with resolved names + score colors + provenance chips, newest-first, no horizontal scroll at 390px, the empty state shows on a fresh tournament, and the anon read does not leak (there is nothing pending to leak, but confirm the anon client — not service-role — is the read path). Record the anon `player`/`roster_entry` readability result (both grant anon SELECT — `player` 0002:71, `roster_entry` 0004 active-only) as 5.5 did for `display_name`. — see [live-QA in Completion Notes](#completion-notes-list).

## Dev Notes

### The feed data contract (what you read) — `timeline_feed`, created in `0017_aprobar_publish.sql:106-113`

The feed is a real **append-only table** (no view over it exists; read the base table directly). One row per posted event.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `bigint gen always as identity` | not null | **PK and the sort key — `order by id desc`.** Never sort by `occurred_at`. |
| `tournament_id` | `bigint` | not null | FK → `tournament(id)`. Filter the read on this (AD-18 scope). |
| `entry_type` | `text` | not null | `check in ('match_result','bracket_advance','award_reveal')`. Only `match_result` is written today. |
| `occurred_at` | `timestamptz` | not null | **display only** (the `HH:MM`), never the sort key. |
| `target_match_id` | `bigint` | **nullable** | FK → `match(id) ON DELETE SET NULL`. Route handle for the bracket; tolerate NULL. |
| `detail` | `jsonb` | not null | the card payload (below). |

**`detail` payload for a `match_result` row** (`0017:392-405`, and `0019_manual_score.sql:354-369` for manual rows):
`{ winner_entry, loser_entry, score_a, score_b, bracket_position, demo_sha256 }` — plus `score_source` + `manual_override` on manual rows, and `demo_sha256` present only when a demo is bound. **`winner_entry`/`loser_entry` are `roster_entry.id` (bigint), not steamid64/names.**

**Index for your read** (already exists): `timeline_feed_tournament_idx on (tournament_id, id desc)` (`0017:117-118`) — your `where tournament_id=$1 order by id desc` uses it directly.

**RLS / grants** (`0017:125-144`): RLS enabled+forced; policy `timeline_view … for select to anon, authenticated using (true)`; `grant select to anon, authenticated`. There is **no `status='approved'` predicate** because the table has no status — AD-7 is satisfied by construction (rows are written only post-approval, inside `approve_match`, after stat rows are already `approved`). **You therefore trust every persisted row is public** and simply read them all for the tournament. Do not attempt a status filter; there is no column.

### Scope boundary — the writer gap is NOT yours

The feed will look sparse because **only `match_result` rows exist**. This is a known, deliberate deferral, not a defect to fix here:
- **`bracket_advance` has no writer.** Forfeit/bye advances (Story 4.5), walkover cascades (4.3), and Aprobar advances post nothing. Deferred at 4.6b DECISION D; `deferred-work.md:74` homes the *uniform* bracket-advance writer at "Story 5.6 **or a small Epic-5 slice**" and notes it must cover 4.3/4.5/4.6 in one place and may widen the enum.
- **Rollback posts no correcting entry** (`0018:56-59`); `deferred-work.md:41` homes it with the same uniform writer and would widen `entry_type` with a rollback value.
- **`award_reveal` has no writer and no `award` table** — Epic 6.

**Default for this story: read-only, faithful to the epic AC's dual-ownership carve-out** ("posting an entry is owned by Story 4.6's Aprobar transaction"). Render all three types by construction; build none of the writers. Whether to fold the uniform bracket-advance/rollback writer into 5.6 is a **flagged decision for Cuatro** (see the questions at the end) — my recommendation is to keep it a separate small DB slice so the first-UI story stays focused and the Epic-4 RPCs are touched deliberately, not as a side effect of a viewer story.

### Name resolution — the feed carries roster ids, not names

`detail.winner_entry`/`loser_entry` = `roster_entry.id`. Resolve in `fetchFeedSnapshot`:
`roster_entry.id → roster_entry.steamid64 → player.display_name` (`0004_roster.sql:26-29`; `player` from Epic 1/2). Batch: collect all winner/loser ids across the snapshot, one `.in('id', ids)` on `roster_entry`, one `.in('steamid64', …)` on `player`, build a lookup, shape the cards. **The `steamid64` is also what you need to route to a player-detail page (AC7).**
- **Anon readability:** `player` grants anon SELECT under RLS `using(true)` (`0002:71`, `0002:51`); `roster_entry` grants anon SELECT but its viewer policy is **active-only** (`status='active'`, `0004:32`). Edge: a player **removed after playing** has a `removed` roster row hidden from anon → name won't resolve. Degrade gracefully (fall back to a neutral label or the steamid64 tail), never crash — mirror the 5.5 `display_name` degradation posture. Test this fallback (Task 7).

### The app you're building into — stack + hard conventions (baseline `f067362`)

- **Next.js 16.2.10 · React 19.2.7 · TypeScript 5.9 (strict, `verbatimModuleSyntax` → use `import type`) · `@supabase/ssr` 0.12.0 · `@supabase/supabase-js` 2.110.0 · Vitest 4.1.9 (node env only) · ESLint 9 (`eslint-config-next`).** No Prettier. Node ≥20.9. Path alias `@/* → ./*`.
- **Read client (use this): `createSupabaseServerClient()` from `lib/supabase/server.ts`** — the anon, RLS-respecting `@supabase/ssr` server client; its `setAll` safely no-ops during a Server Component render. **NEVER** `getAdminClient()` (`lib/supabase/admin.ts`, service-role/BYPASSRLS) for the feed.
- **Env** only through `@/lib/env` getters (`publicSupabaseUrl()`, `supabaseAnonKey()`); `assertNoLeakedSecrets()` fails the build if a secret is mirrored under `NEXT_PUBLIC_`.
- **House style to mirror:** server component with `await`-ed async params (`app/page.tsx`); discriminated-union results `{ok:true…}|{ok:false,reason}`; `console.error('[label]', err)`; colocated `*.test.ts`; feature-organized `lib/` (not `src/`).
- **What does NOT exist and you must establish (small, once):** any CSS/Tailwind (none — inline styles only today), the i18n module, a viewer component/layout location, hand-typed `timeline_feed` types (no generated DB types), a browser Supabase client (not needed for 5.6's server-rendered read — leave it for 5.8). No `middleware.ts`.

### Design tokens — lift from the mock verbatim

Palette (dark, MUST) — `DESIGN.md:15-26` / `mock-home.html:11-25`: page `#0F1419`, `--s1 #171E26`, `--s2 #1E2832`, `--line #232C36`, `--tp #F4F6F8`, `--ts #B7C2CE`, `--tm #8A97A6`, `--blue #2F81F7`, `--gold #FFB23E`, `--win #3FB950`, `--loss #F0556A`; locked-nav ink `#5d6875`; teaser node border `#39434f`. Radii sm6/md12(card)/lg16/pill. Spacing 4/8/12/16/24/32. Card = `--s1`, `border-radius:12px`, `padding:11–12px`; headline result card = `--s2` raised. Rail = 1px `--line`; node = 13px circle, 1.5px border, page-fill + colored inner dot; last item hides its rail tail. **Directly liftable CSS blocks** in `mock-home.html`: `.card`/`.card.raised` (233-239), `.item`/`.node.*` (196-230), `.time` (240-245), `.matchline`/`.score` (247-264), `.chip`/`.chip.ok`/`.tick` (272-290), `.advance` (293-300), `.feed-day` (188-194), `.navitem`/`.active`/`.locked` (161-181), `.empty`/`.reg` (394-420). Typography: **Archivo** (display, 600–800), system-ui (body); **tabular lining numerals on every number** (`font-variant-numeric: tabular-nums lining-nums`).

### i18n copy inventory — establish the module here (Spanish, fixed strings verbatim)

Nav: `Feed` / `Llave` / `Estadísticas` / `Ceremonia`. Status/live pill: `En vivo`, `sin transmisión`, `final`, `Reconectando…`, `Cargando el evento…`. Day header: `Hoy · llave de ganadores`, `Esta noche · la llave está cerrada`. Result card: title pattern `{winner} venció a {loser}`, chips `aprobado` / **`verificado desde el demo`** (fixed) / hash. Advance body pattern `{player} avanza a {round}`. Award teaser (locked, no writer yet — provide strings so the branch renders if a row ever appears): `Las carreras de premios se aprietan`, `Se revela en la ceremonia`. Empty state: `El feed está en silencio — por ahora`, **`El evento aún no empieza. Inscripciones abiertas.`** (fixed), `Resultados, avances y carreras de premios aterrizan aquí, lo más reciente primero.`, reg pill `{n} de {n} inscritos · …`. Ceremony banner (end state): `La ceremonia está en vivo`, `Entrar a la ceremonia`, **`Sembrado por el demo final · reproducible`** (fixed). SR: `Resultado aprobado: {winner} venció a {loser} {a}-{b}`. Full table with citations lives in the UX mock (`mock-home.html`) + `EXPERIENCE.md`; the personal "hook" card (UJ-1, `para ti…`) is designer flavor — **out of MVP scope** for 5.6.

### AD-11 boundary with Story 5.8 (build the seam, not the realtime)

5.6 = the initial, published-state snapshot render. 5.8 adds the `tournament:<id>` Supabase Realtime subscription that, on a post-commit nudge, **re-invokes your `fetchFeedSnapshot`** and re-renders — it never carries feed state on the wire and never replays events (AD-11, `SOLUTION-DESIGN:381-383`). So: (a) keep the snapshot read a self-contained reusable function (AC8); (b) render a stable, `id`-keyed list so a prepend doesn't wipe scroll; (c) render all three live-pill states (`En vivo`/`final`/`sin transmisión`) statically — 5.8 drives the transitions; (d) no optimistic/client-derived state. The ~2s target is 5.8's, not yours.

### Decisions this story makes (defaults chosen — flagged ones repeated at the end)

<a id="decision-styling-approach"></a>**Styling approach.** Default: a **global CSS token stylesheet (CSS custom properties)** imported in `app/layout.tsx` + **CSS Modules** per viewer component, lifting the mock CSS almost 1:1. Rationale: the mock is pure CSS with a `:root` token block; inline React style objects (today's only precedent) would be painful for rails/nodes/chips and hostile to 5.7's reuse. Not Tailwind (not installed; adding it is a bigger foundational bet than this story should make). *Flagged — Cuatro may prefer inline-styles-only or Tailwind.*

<a id="decision-route--home-placement"></a>**Route / home placement.** Default: the feed **is** the tournament home at **`/`**, replacing the current placeholder `app/page.tsx` (a login-landing stub). Login stays at `/auth/steam/login`; viewing is public/read-only (per `app/page.tsx:4-6`). Rationale: PRD calls the feed "the tournament home … where everyone lives during the event" (`prd.md:406-408,118`). *Flagged — confirm replacing the current landing page.*

<a id="decision-current-tournament-resolution"></a>**Current-tournament resolution.** Default: resolve the single active tournament (the sole row, or the one whose `state` is live/ceremony) in a small replaceable helper. Existing code always passes `tournamentId` in explicitly (`lib/roster.ts`, `lib/bracket/generate.ts`) — there is no "current tournament" helper yet; 5.6 introduces the minimal one. *Flag if multi-tournament is ever expected — it isn't for this single private event.*

**Server vs client component.** Default: **Server Component** initial render (SSR via the anon `@supabase/ssr` server client), `dynamic = 'force-dynamic'`. 5.8 later adds a thin client subscriber that reuses `fetchFeedSnapshot`. No browser Supabase client needed in 5.6.

**DB typing.** Default: **hand-type** the `timeline_feed` row + `detail` payload in `lib/feed/` (precedent: hand-typed RPC replies). Not `supabase gen types` (net-new tooling, scope creep).

### Previous-story intelligence

- **Story 5.5 (leaderboard view, done 2026-07-27):** the sibling read surface's data source is the `public.leaderboard` view — 5.7's leaderboards consume it, and your player/leaderboard tap-targets (AC7) point at 5.7 pages built on it. It coalesces NULLs + gates floors in SQL; the app only reads flags. Same posture you want: **the DB emits machine values, the app maps to Spanish labels** (AD-20/AD-24). It also confirmed anon `player` readability (names resolve for viewers).
- **Story 5.2a / measure-don't-assume:** the project's hard-won lesson — never explain away a "reads 0/empty" by argument. Your feed *will* read near-empty (only `match_result` rows). That is **verified** here (no writer for the other two types), not assumed — but confirm at live-QA that real `match_result` rows do render, so you don't ship a feed that's empty for a *different*, real reason (e.g. wrong tournament id, a broken name join dropping every card, or the service-role/anon mixup).
- **Deferred-work you are the flagged home for:** `deferred-work.md:41,74` (uniform bracket-advance + rollback-correction feed writer). Not building it is the default; see the scope boundary + end questions.

### Git intelligence

Recent commits are all Epic-5 worker/DB (`5.1`–`5.5`) and Epic-4 admin routes. **This is the first `app/` viewer surface since the auth/admin scaffolding** (last `app/` touch: `cc63e7a` Story 4.9 admin routes). No recent frontend precedent to mirror beyond `app/page.tsx`/`app/layout.tsx` and the route-handler conventions — hence the foundation work in Tasks 1–2.

### Project Structure Notes

- **New (viewer) location to establish:** put viewer pages under a route group, e.g. `app/(viewer)/page.tsx` (the feed/home) with a colocated `app/(viewer)/components/` for the feed card/rail/nav, or a top-level `components/` — pick one and make it the convention 5.7 follows. `lib/feed/` holds the read + pure helpers (with colocated `*.test.ts`). The i18n module in `lib/i18n/`. Global tokens stylesheet in `app/` (imported by the root layout).
- **Touching `app/page.tsx`:** the feed-as-home decision replaces/absorbs the current placeholder landing. Preserve the login affordance (link to `/auth/steam/login`) and the `?login=failed` alert behavior it renders, or relocate them — don't silently drop the auth entry point.
- **No conflict with existing structure:** you are adding, not modifying, the `lib/` feature modules and the admin/auth routes. The only existing file materially changed is `app/layout.tsx` (import the stylesheet, reconcile palette) and possibly `app/page.tsx` (become the feed).
- **Testing env:** Vitest is node-only (`vitest.config.ts:16-17`, `include: ['lib/**/*.test.ts']`). Keep tests in `lib/` (pure functions + faked client). Adding a jsdom component-test env is optional and net-new — prefer live-QA for the React render (worker-convention analogue).

### References

- Story 5.6 ACs: [epics.md](../planning-artifacts/epics.md) L925-945; epic intro L823-825; dual-ownership L941-943.
- Feed table + writers: [0017_aprobar_publish.sql](../../supabase/migrations/0017_aprobar_publish.sql#L106) L106-144 (DDL/index/RLS/grants), L392-405 (the `match_result` insert); [0019_manual_score.sql](../../supabase/migrations/0019_manual_score.sql#L354) L354-369; rollback non-write [0018_rollback_match.sql](../../supabase/migrations/0018_rollback_match.sql#L56) L56-59.
- Name-resolution join: [0004_roster.sql](../../supabase/migrations/0004_roster.sql#L26) L26-34 (roster_entry), L32 (active-only viewer policy); `player` anon read [0002_rls.sql](../../supabase/migrations/0002_rls.sql) L51,71.
- FR-31 / FR-32 / NFR ~2s: `_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md` L410-425, L118, L406-408, L498, L530.
- AD-7 / AD-11 / AD-24 / AD-6 / AD-20: `_bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md` L110-113, L130-133, L195-198, L106-108, L175-178; CQRS-lite read/write split L33-34,233.
- Read path / realtime / channels: `…/SOLUTION-DESIGN.md` L264-296, L374, L381-383.
- UX (authoritative): `…/ux-designs/ux-cs-tournament-2026-06-30/mockups/mock-home.html` (feed/nav/empty/tokens — cited inline above); `EXPERIENCE.md` L37-42,50,52,85,102,108-111,120,129,134,141-145,159-160; `DESIGN.md` L15-26,27-56,99,192-197,240-265. Spine wins on any mock conflict (`EXPERIENCE.md:52`); ignore `mock-bracket.html`'s bottom tabbar.
- App conventions: `app/layout.tsx`, `app/page.tsx`, `lib/supabase/server.ts` (anon client), `lib/supabase/admin.ts` (do-not-use), `lib/env.ts`, `lib/match/approve.ts:33-40` (hand-typed reply precedent), `lib/roster.test.ts` (faked-client test precedent), `vitest.config.ts`, `tsconfig.json`, `package.json`.
- Deferred (writer gap, your flagged home): [deferred-work.md](deferred-work.md) L41, L74.
- Prior story: [5-5-single-normalized-leaderboard-view-rpc.md](5-5-single-normalized-leaderboard-view-rpc.md).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8) — bmad-dev-story workflow.

### Debug Log References

- `npm test` → **392 passed / 23 files** (23 new feed tests across `lib/feed/model.test.ts` + `lib/feed/read.test.ts`).
- `npm run lint` → clean (exit 0). One transient warning (unused `Link` import in `page.tsx`) fixed before the final run.
- `npm run build` → success; `/`, `/bracket`, `/ceremonia`, `/leaderboards` all emit as `ƒ` (dynamic, per-request) — none statically prerendered. Required one `.next` cache clear: the stale dev-types validator still referenced the deleted `app/page.js` until the cache was removed.

### Completion Notes List

**Flagged decisions — confirmed by Cuatro (all three defaults):**
1. **Scope = read-only.** No feed writer built. `bracket_advance`/`award_reveal` render by construction but have no writer (deferred at `deferred-work.md:41,74`; award = Epic 6). The uniform writer stays a separate future DB slice.
2. **Feed IS home at `/`.** Replaced the old Steam-login landing (`app/page.tsx` deleted). The login affordance + `?login=error` alert were relocated into the feed page (a discrete `Iniciar sesión` footer link + a Spanish alert), so the auth entry point is preserved, not dropped.
3. **Styling = global CSS tokens + CSS Modules.** `app/globals.css` `:root` token block (imported once in the root layout) + per-component `*.module.css`, lifting the mock CSS ~1:1. Not Tailwind, not inline styles.

**Foundations established (the conventions 5.7/5.8 inherit):**
- Design tokens → `app/globals.css`; Archivo via `next/font/google` (self-hosted at build, never hotlinked).
- Single Spanish i18n module → `lib/i18n/es.ts` (fixed strings verbatim; machine-value→label maps). No inline string literals in any viewer component.
- Viewer location → `app/(viewer)/` route group with a shared server `layout.tsx` (topbar + live pill + four-up nav) and a client `Nav` island (pathname-driven active tab, Ceremonia lock).
- Reusable snapshot read → `lib/feed/read.ts` `fetchFeedSnapshot(client, tournamentId)` — the AD-11 seam Story 5.8 re-invokes on nudge/reconnect. Self-contained, anon-client only, returns a fully-shaped `CardModel[]`. The list renders `id`-keyed so 5.8 can prepend without wiping scroll.

**Implementation notes:**
- **Ordering** is `id desc` (identity PK), never `occurred_at` — asserted in the read test.
- **Name resolution** is `roster_entry.id → steamid64 → player.display_name`, two batched `.in(...)` queries. A player removed after playing is hidden by the roster active-only policy → its id is absent → the card shows `Jugador retirado`. A player row missing a `display_name` falls back to the `#<steamid tail>`. A name-join read error is non-fatal (neutral labels, feed still renders).
- **Winner-green score coloring without a seat→entry map:** the winner always has the higher score (ties never reach the feed), so `toCardModel` colors the greater of `score_a`/`score_b` green in seat order — no extra join needed.
- **Provenance chips:** `aprobado` always; `verificado desde el demo` + the truncated hash only when `demo_sha256` is present (manual rows may have none) — honest to the data, not assumed.

**Local live-QA (against local Supabase; anon key = the exact `createSupabaseServerClient()` read path):**
- Env traps hit as memory warned: Kong is remapped to host **55321** (`supabase status` reports 54321); DB on 54322 via psql.
- Hand-seeded a throwaway `bracket_live` tournament (900) with Dex/Theo/Mara, one active-active `match_result` (demo-bound, Winners R1) + one active→**removed**-loser `match_result` (no demo, Winners R2, winner in seat B). Cleaned up after (DB back to empty).
- **Anon REST read confirmed:** `timeline_feed` returns both rows newest-first; `roster_entry` returns only the two **active** rows (the removed 9033 is hidden — the real degradation edge); `player` resolves all three names. Records the anon `player`/`roster_entry` readability result (as 5.5 did for `display_name`): `player` anon-readable; `roster_entry` anon-readable **active-only**.
- **SSR render confirmed** (dev server, anonymous session): live pill `En vivo`, nav `Feed/Llave/Estadísticas/Ceremonia`, day header `Hoy · llave de ganadores`, both cards newest-first, resolved names incl. `Jugador retirado` for the removed player, `venció a`, scores, **2× `aprobado` chip** + **1× `verificado desde el demo` chip** (only the demo-bound row) + truncated hash `a3f1c9e2…7b40`, the `aria-live` region, and the relocated `Iniciar sesión` link.

### File List

**Added:**
- `app/globals.css`
- `app/(viewer)/layout.tsx`
- `app/(viewer)/viewer.module.css`
- `app/(viewer)/page.tsx`
- `app/(viewer)/feed.module.css`
- `app/(viewer)/components/Nav.tsx`
- `app/(viewer)/components/Nav.module.css`
- `app/(viewer)/components/TimelineFeed.tsx`
- `app/(viewer)/components/EmptyState.tsx`
- `app/(viewer)/components/Placeholder.tsx`
- `app/(viewer)/bracket/page.tsx`
- `app/(viewer)/leaderboards/page.tsx`
- `app/(viewer)/ceremonia/page.tsx`
- `lib/i18n/es.ts`
- `lib/feed/types.ts`
- `lib/feed/model.ts`
- `lib/feed/read.ts`
- `lib/feed/model.test.ts`
- `lib/feed/read.test.ts`

**Modified:**
- `app/layout.tsx` (import the global token sheet + Archivo font; body palette reconciled to the tokens)

**Deleted:**
- `app/page.tsx` (the feed becomes the home at `/`; login affordance relocated into the feed page)

### Change Log

| Date | Change |
|---|---|
| 2026-07-28 | Story 5.6 implemented — read-only timeline feed as the tournament home (`/`), the first viewer UI. Established the viewer foundations (design tokens, Archivo, single Spanish i18n module, `app/(viewer)/` route group, reusable `fetchFeedSnapshot` AD-11 seam). All three flagged decisions taken at their recommended defaults (read-only / feed-as-home / CSS tokens+Modules) per Cuatro. Gates green (lint, 392 tests, build); local live-QA passed (anon read path + SSR render). Status → review. |

## Review Findings

_Code review 2026-07-28 (baseline `f067362`; layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor, all Opus 4.8, + reviewer verification against the mock/migrations). 2 decision-needed, 3 patch, 2 deferred, 8 dismissed as noise/unreachable. Top finding (P1) confirmed against the authoritative `mock-home.html:582-583`._

- [x] [Review][Patch] Localize feed timestamps to **Colombia time (America/Bogota)** — `formatFeedTime` rendered UTC (`getUTCHours/getUTCMinutes`), so times read ~5h ahead of the room. _(Resolved from decision 2026-07-28: Cuatro chose localize over keep-UTC.)_ ✅ **Fixed 2026-07-28** — `formatFeedTime` now uses a fixed `Intl.DateTimeFormat` (`America/Bogota`, `hourCycle: 'h23'`) in `lib/feed/model.ts`; tests updated (21:12Z → 16:12).
- [x] [Review][Dismiss] Registration pill copy `{n} inscritos` vs the mock's `{n} de {cap} inscritos · {clause}` — _dismissed 2026-07-28: Cuatro chose to keep the simplified count (empty-state-only; avoids wiring a capacity + seeding-status source for a private event). No change._
- [x] [Review][Patch] Match-result score rendered in **seat order, not winner-first** — deviated from the mock and contradicted the card's own title + aria-live when the winner is competitor B (~half of matches). The mock always shows the winner's (green) number FIRST (`16–13`), matching the winner-first title + aria. ✅ **Fixed 2026-07-28** — `toCardModel` now returns `winnerScore`/`loserScore` (`Math.max/min`), `TimelineFeed` renders `winnerScore`(green)`–`loserScore`(red); dropped `scoreA/scoreB/aWins`. `lib/feed/model.ts` + `app/(viewer)/components/TimelineFeed.tsx`; seat-B test now asserts winner-first.
- [x] [Review][Patch] `<nav>` landmark was mislabeled "Feed" — `aria-label` named the navigation region after one of its own tabs. ✅ **Fixed 2026-07-28** — added `es.nav.landmark = 'Navegación principal'` (`lib/i18n/es.ts`); `Nav.tsx` uses it.
- [x] [Review][Patch] Tournament resolved twice per page load — layout + page each called `resolveCurrentTournament`, two identical reads + within-render drift risk. ✅ **Fixed 2026-07-28** — new `app/(viewer)/current-tournament.ts` wraps a client-creating resolver in React `cache()`; layout + page share it (one `tournament` read/request). `resolveCurrentTournament(client)` stays the pure, faked-client-tested primitive.
- [x] [Review][Defer] `resolveCurrentTournament` binds "current" to `max(id)`, not `state` [`lib/feed/read.ts:44-49`] — deferred, accepted single-tournament v1 assumption (dev-flagged, Cuatro-confirmed); a second `tournament` row would shadow the live one. Revisit only if multi-tournament is ever introduced.
- [x] [Review][Defer] A transient `roster_entry`/`player` read outage is indistinguishable from "all players removed" [`lib/feed/read.ts:144-146`] — deferred, soft-fail is by design (feed must not blank an approved result); only a `console.error` distinguishes the two. Consider a distinct degraded signal when the read layer is next touched.
