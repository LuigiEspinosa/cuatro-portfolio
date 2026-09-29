---
baseline_commit: fb02428cafc73b7e57404be2f763924682248001
---

# Story 5.7: Spanish mobile-first read-only viewer surfaces

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a viewer,
I want read-only Spanish, mobile-first surfaces reconstructable from published state,
so that I can follow the bracket, leaderboards, and player detail on my phone with no ability to mutate anything.

## ⚠ Read this first — the five things that will bite you

1. **The `match` table is NOT viewer-readable yet — you must add a migration.** `match` (migration `0010`) is admin/worker-only. It has **no anon SELECT grant and no viewer RLS policy** — the grant was *explicitly deferred to Epic 5, this story*: "the anon/authenticated SELECT grant + the viewer bracket policy → Epic 5 (the Spanish viewer surface)" (`0010:30,213-214`). The bracket surface cannot read a single row until you land `0022_match_viewer_read.sql`. Unlike `stat_row`, `match` has **no `status='approved'` column** — its states are an enum (`declared`/…/`resolved`/…), and the bracket *structure* is public, so the policy shape is a real design choice (see [AC1](#ac1) + the [flagged decision](#decision-match-policy)). Do **not** read `match` through the service-role client to "work around" the missing grant.

2. **This is a READ-ONLY story. A viewer must NEVER render a mutating affordance — not even disabled.** The mocks show admin controls (the `Admin · define al ganador` advance bar, `Avanzar a Dex/Theo` buttons, `Marcar W.O. ahora`) inline on the bracket screens. **Those are admin-only and MUST NOT render for viewers** — "no disabled-but-present Approve, no greyed Avanzar arrow" (`EXPERIENCE.md:29,134`; UX-DR4 `epics.md:117`; FR-34). Build the viewer surface; render none of the admin advance/forfeit UI. Server-side gating already exists (the command routes 403 non-admins, Story 2.4/4.9); your job is to not paint the button.

3. **Reuse the 5.6 foundations verbatim — do not re-establish them.** Story 5.6 (the first viewer UI, commit `fb02428`) already shipped: the `app/(viewer)/` route group + shared shell/nav (`layout.tsx` + `Nav.tsx`), the single Spanish i18n module `lib/i18n/es.ts`, the dark design tokens `app/globals.css`, CSS-Module conventions, the anon read client `createSupabaseServerClient()`, and the batched roster→player name resolver. **You extend these; you don't rebuild them.** The nav is already wired: `/bracket` (tab `Llave`) and `/leaderboards` (tab `Estadísticas`) exist today as `Placeholder` stubs (`app/(viewer)/bracket/page.tsx`, `.../leaderboards/page.tsx`) — you replace the stub bodies. No inline string literals: every new word goes through `es.ts`.

4. **The nav labels are already fixed — do NOT "correct" them to the mock.** The shipped nav is **Feed / Llave / Estadísticas / Ceremonia** (`es.nav`, `Nav.tsx`). `mock-bracket.html`/`mock-leaderboards.html` show a *divergent* bottom tab-bar (`Llave · Partidas · Premios · Estadísticas`) — 5.6's contract already ruled this the wrong one: "ignore the divergent bottom-tabbar in `mock-bracket.html`" (`5-6…md:43`, `EXPERIENCE.md:52` "spine wins on any mock conflict"). Keep the established four-up nav. Bracket = the `Llave` tab, leaderboards = the `Estadísticas` tab, player detail = a sub-route (no tab), reached from a leaderboard row or feed mention.

5. **Leaderboards read the ONE view — never re-aggregate; and the awards block is OUT (Epic 6).** All standings numbers come from the single `public.leaderboard` view (migration `0021`, AD-20). You **filter/order/hide client-side off that wide per-player row** — you never sum `stat_row` yourself and never re-derive the 24/20 floors (read the `meets_round_floor`/`eligible_rate` flags). And the `mock-leaderboards.html` **"Posiciones de premios / SE DESBLOQUEA EN LA CEREMONIA"** blurred block is **FR-24 awards = Epic 6**, not this story — do not build it (see [Scope boundaries](#scope-boundaries)).

## Acceptance Criteria

> Restated and made testable from `epics.md:947-967` (Story 5.7) + FR-23, FR-32, FR-34, AD-7, AD-11, AD-20, AD-24, and UX-DR2/3/4/6/8/13/14/37/39. Numbers/paths below are the dev-agent contract.

<a id="ac1"></a>**AC1 — `match` becomes viewer-readable via a new migration (the Epic-5 grant that 0010 deferred).** A new migration `supabase/migrations/0022_match_viewer_read.sql` (+ paired `supabase/tests/0022_match_viewer_read_test.sql`) adds a viewer SELECT path to `public.match`: a **read-only** RLS policy for `anon, authenticated` and `grant select on public.match to anon, authenticated`. No INSERT/UPDATE/DELETE grant is added (viewers never write; the admin/service-role path is untouched). The policy is **separate** from the existing admin policy (two policies, never one OR'd — AD-7 fail-closed). Because `match` carries no `status` column and the bracket structure is public state (mirroring the already-public `tournament`/`season`), the viewer policy is **`using (true)`** — the recommended shape (see [decision](#decision-match-policy)); a `pending`/unapproved score never leaks because **a score is only rendered for `state ∈ ('resolved','manual_resolved')`** (AC2), and stat rows remain gated at `stat_row` (AD-7). The pgTAP test asserts: anon can `select` from `match`; anon cannot `insert`/`update`/`delete`; the full prior suite stays green against the final schema (`epic-3-retro:52`).

<a id="ac2"></a>**AC2 — Bracket surface: seeded double-elimination, read-only, bracket-position labels (FR-6 read, FR-32, UX-DR3).** `/bracket` (replacing the `Placeholder`) renders the current tournament's `match` rows as the seeded double-elimination structure — **Winners**, **Losers**, **Grand final** — grouped by `bracket` and ordered by `bracket_slot` (index `match_tournament_bracket_idx`). Each node is **labeled by its `bracket_position`** text (`Winners R1`, `Losers R1`, `Grand final`) — **never a running match number** (UX-DR3). A node shows its two competitors' **display names** (resolved by the `roster_entry.id → steamid64 → player.display_name` join — AC7), each competitor's **seed** (`roster_entry.bracket_seed`), and — **only when `state ∈ ('resolved','manual_resolved')`** — the `score_a`/`score_b`, winner's number in `--win` green + winner name `--tp`, loser's number in `--loss` red + loser name `--tm` muted. Node chrome is monochrome + hairline; **the only gold on this screen** is a gold border (`--gold`) on the **resolved Grand-final champion** node (UX-DR6/16-18, `DESIGN.md:100-108,266`). Mobile-first, single-column, **no horizontal scroll** (stack the three brackets vertically; see [layout decision](#decision-bracket-layout)).

<a id="ac3"></a>**AC3 — Bracket per-state rendering, and NO admin affordance (FR-8/FR-9/FR-17, AD-9, AD-23, UX-DR4/28-31).** The node/detail render is a pure function of `match.state`:

| `match.state` | Viewer render | Score? |
|---|---|---|
| `declared`, `awaiting_grace`, `pending` | competitors + seeds; "por jugar" / awaiting; live pill context if applicable | **no** |
| `live` | competitors + a blue `en vivo` badge | **no** (unpublished — AD-7) |
| `bye` | neutral **`Pase directo`** badge (UX-DR29); advances; **`sin estadísticas`** | **no** |
| `forfeit` | **`W.O. / Ausente`** badge in `--loss` red (UX-DR30); **`sin estadísticas`** | **no** |
| `resolved`, `manual_resolved` | winner green / loser red, scores shown (AC2) | **yes** |
| `void` | structural-only; render nothing (or a muted placeholder) — never played, advances nobody | **no** |
| `rolled_back` | revert to the undecided display (an approved result was undone; rollback posts no feed entry, so the bracket reflects current state) | **no** |

The grace-timer no-show (FR-9) may render a static **`MM:SS`** countdown label in `--loss` tint near threshold *if* a grace deadline is exposed, but a live-ticking timer and the `Marcar W.O. ahora` action are **admin/Story-5.8 concerns — do not build them here**. **No `Avanzar` / advance / forfeit / drag-to-advance control renders for viewers** (UX-DR4, FR-34). A focused-match view (tapped from the map) shows the same data plus the provenance chip **`verificado desde el demo`** (blue) when the match has a bound demo — reuse `es.result.verified`.

<a id="ac4"></a>**AC4 — Leaderboards surface: Tasa/Volumen toggle over the single view, no horizontal scroll (FR-22, FR-23, AD-20, UX-DR39).** `/leaderboards` (replacing the `Placeholder`) reads the **`public.leaderboard`** view once (anon client) and renders a ranking with a **`Tasa` / `Volumen`** segmented toggle that re-ranks **in place** (a deliberate, reversible switch — not a hidden filter). The toggle reads by **tone + weight only — no blue fill, no gold** (`DESIGN.md:113-120`; note this differs from the bracket view-toggle, which *does* use a blue fill — do not unify them). Each class **states its class** (a short `segnote` line: `Volumen` = totales por rondas; `Tasa` = por oportunidad). The primary ranking has **no horizontal scroll** on a ~390px phone (fixed narrow columns: rank + name + one or two right-aligned numeric columns — the mock uses `rk 26px / v1 62px / v2 50px`). All numeric cells use **tabular lining numerals** (`--num`/`.num`, UX-DR8). The board set / stat columns are a [flagged decision](#decision-boards) — default: `Tasa` shows ADR (primary) + HS% + KAST; `Volumen` shows Kills (primary) + a weird total. Each row is a **≥44px tap target** routing to that player's detail (AC6).

<a id="ac5"></a>**AC5 — Leaderboards eligibility / anti-farm floors surface honestly (FR-21, FR-22).** Read the view's flags — never re-derive floors. On **rate (`Tasa`) boards**, players who fail the floor (`eligible_rate=false`, i.e. `meets_round_floor=false` or `meets_kill_floor=false`) are **hidden from the ranking** and surfaced separately as **`aún no elegible · Mín. 24 rondas`** (fixed phrasing family per `EXPERIENCE.md:117`, UX-DR39). An eligibility view/section may list who is/isn't eligible with their `rounds_played_total`/`kills_total`, DQ'd rows dimmed. The fixed callout copy is **`Mín. 24 rondas — partidas inactivas descalificadas de los premios`** (`EXPERIENCE.md:72`). On **volume (`Volumen`) boards** the floor does not hide players (volume is raw totals). A player with only idle-DQ'd contributions **does not appear at all** (they have no row in the view — AC7 of Story 5.5), which is correct, not a bug.

<a id="ac6"></a>**AC6 — Player stat detail: base + weird/derived stats with provenance (FR-23, AD-24).** A new route (default `app/(viewer)/jugador/[steamid64]/page.tsx` — [route naming flagged](#decision-route-name)) renders one player's detail, read-only, keyed by `steamid64` (the value the name-resolver already computes for routing). **Headline/aggregate numbers come from that player's `public.leaderboard` row** (AD-20 single site): base **K / D / A** (`kills_total`/`deaths_total`/`assists_total`), **ADR** (`adr`), **`% de cabeza`** (`hs_pct`), **KAST** (`kast_pct`); the **weird demo-only totals** (`knife_kills_total`, `wallbang_kills_total`, `through_smoke_kills_total`, `no_scope_kills_total`, `blind_kills_total`) in a `Estadísticas raras solo del demo` section. A **provenance line** reads the fixed **`Verificado desde el demo`** (`es`… add key; the module currently has the lowercase feed-chip `verificado desde el demo` — see [i18n note](#i18n-additions)), optionally with `· semilla publicada <hash>`. The **"matches behind them"** list (FR-23) reads the player's approved `stat_row` rows joined to `match` for context (bracket position, opponent, score) — this is a **raw per-match listing, not a re-aggregation**, so it does not violate AD-20. Rate values render as `sin datos` when the view returns NULL (0-opportunity denominator, AC9 of 5.5).

<a id="ac7"></a>**AC7 — Name resolution is the same batched join 5.6 built; reuse it (AD-4, degrade gracefully).** Bracket competitors and player-detail identity resolve `roster_entry.id → roster_entry.steamid64 → player.display_name` (leaderboard rows already carry `steamid64`+`display_name` from the view). Story 5.6 implemented this exact batched two-`in(...)`-query resolver inside `lib/feed/read.ts`; **extract it into a shared helper (e.g. `lib/roster/names.ts`) and reuse it in the bracket read** rather than copy-pasting (small refactor of `lib/feed/read.ts` to import the shared function — keep `fetchFeedSnapshot` behavior identical). A `roster_entry` hidden by the active-only viewer policy (a player **removed after playing**) does not resolve → fall back to **`Jugador retirado`** (`es.unknownPlayer`) or the steamid tail; never crash (mirror 5.6's degradation).

<a id="ac8"></a>**AC8 — Read-only, reconstructable-from-published-state, reusable snapshot reads (FR-34, AD-11).** Every surface renders from **one published-state read** through the **anon** `createSupabaseServerClient()` — never the service-role admin client, no client-derived/optimistic/wire-only state. Each read is a **self-contained function** taking `(client, tournamentId)` (bracket) / `(client)` (leaderboard, event-global view) / `(client, steamid64)` (player) so **Story 5.8 can re-invoke them verbatim on a realtime nudge/reconnect** (it must never replay events). Pages are Server Components with **`export const dynamic = 'force-dynamic'`** (per-request read; the stubs already declare it). No admin capability appears or succeeds on any surface (FR-34).

<a id="ac9"></a>**AC9 — Spanish from one module, dark, mobile-first, tabular, no admin, accessible (AD-24, UX-DR2/6/8/13/14/37).** All copy is Spanish resolved through `lib/i18n/es.ts` — **no inline literals** in any new component; new strings added to the module (fixed strings verbatim: `Verificado desde el demo`, `Pase directo`, `W.O. / Ausente`, `sin estadísticas`, `Mín. 24 rondas — …`, `aún no elegible · Mín. 24 rondas`). Dark-only tokens from `app/globals.css` (no new palette); Archivo display / system-ui body; **tabular lining numerals on every number** (scores, seeds, ADR/%, K/D/A, timers, hashes, ranks). Single-column ~390px, 16px side margins, **no horizontal scroll** anywhere. Gold appears **only** on the resolved champion node (nowhere else — "any gold pixel outside the reveal set is a bug"). A screen-reader `aria-live` line announces live/Final pill changes and (bracket) result posts (UX-DR37); focus order follows reading order; tap targets ≥44px.

<a id="ac10"></a>**AC10 — Tests + gates green.** Node-Vitest (`lib/**/*.test.ts`, the only tested layer) covers the **pure logic** with faked Supabase clients (mirror `lib/feed/read.test.ts` / `lib/roster.test.ts`): bracket read shaping (group by bracket, order by `bracket_slot`, score-only-when-resolved, champion detection, name-resolve fallback, empty→empty); leaderboard board model (Tasa/Volumen board definitions, sort, hide-below-floor on rate boards only, eligibility label mapping, `sin datos` on NULL); player-detail read shaping (pick the view row, matches-behind list, provenance). The pgTAP `0022` test (AC1). Full existing suite stays green (`npm test`, `supabase test db`), `npm run lint` clean, `npm run build` succeeds (new routes emit `ƒ` dynamic, none prerendered). A React component-render test env stays **optional** (Vitest is node-only; jsdom is net-new) — prefer pure-function tests + local live-QA for the render (worker convention).

## Tasks / Subtasks

- [x] **Task 1 — Migration: make `match` viewer-readable (AC1)** — `supabase/migrations/0022_match_viewer_read.sql` (+ `supabase/tests/0022_match_viewer_read_test.sql`)
  - [x] Open with the standing SCOPE / OUT-OF-SCOPE header comment (mirror `0021`/`0017` style): adds a viewer SELECT policy + anon/authenticated SELECT grant on `match`; OUT-OF-SCOPE = no write grant, no change to the admin policy, no other table.
  - [x] Add `create policy match_viewer_read on public.match for select to anon, authenticated using (true);` (separate from the admin policy — AD-7 two-policy, never OR'd). Confirm the existing admin SELECT policy + service-role grants are untouched.
  - [x] `grant select on public.match to anon, authenticated;` (SELECT only — no insert/update/delete).
  - [x] pgTAP: `set local role anon` can `select`; cannot `insert`/`update`/`delete`; policy + grant exist. Remember every pgTAP file runs against the **final** migrated schema — do not invalidate a prior suite.
- [x] **Task 2 — Shared name-resolver extraction (AC7)** — `lib/roster/names.ts`
  - [x] Extract 5.6's batched `roster_entry.id → steamid64 → player.display_name` resolver (currently inside `lib/feed/read.ts`) into a reusable `resolveNames(client, rosterIds)` (or similar), keeping the removed-player graceful fallback. Re-point `fetchFeedSnapshot` at it; run the feed tests to confirm identical behavior (no regression). Colocate `lib/roster/names.test.ts` if the shaping isn't already covered.
- [x] **Task 3 — Bracket read + model (AC2, AC3, AC7, AC8)** — `lib/bracket/read.ts` + `lib/bracket/model.ts`
  - [x] `fetchBracketSnapshot(client, tournamentId)`: select `match` where `tournament_id=$1` order by `bracket_slot`, via the anon client; resolve competitor/winner names via the shared resolver; resolve seeds from `roster_entry.bracket_seed`; determine the champion (`tournament.final_match_id`'s resolved GF winner). Return a fully-shaped, grouped snapshot. Hand-type the `match` row (no generated types — mirror the feed precedent).
  - [x] Pure `model.ts`: `groupBracket(matches)` → `{winners, losers, grandFinal}`; `matchNodeModel(match, names, seeds, championEntryId)` → the discriminated per-state view model (score present only for resolved/manual_resolved; badges per AC3 table; champion→gold). These are the node-testable units.
- [x] **Task 4 — Bracket surface (AC2, AC3, AC9)** — `app/(viewer)/bracket/page.tsx` (+ `bracket.module.css`, components)
  - [x] Replace the `Placeholder`. Server Component; `dynamic='force-dynamic'` (already declared). Render the three brackets stacked, nodes per the model, bracket-position labels, seeds, per-state badges, focused-match view on tap (or an expandable node). Lift card/node/badge CSS ~1:1 from `mock-bracket.html` (cite line ranges in comments). **Render no admin advance/forfeit controls.** Pre-bracket empty state: `El evento aún no empieza. Inscripciones abiertas.` (reuse `es.empty.body`) when no `match` rows exist.
- [x] **Task 5 — Leaderboard read + model (AC4, AC5, AC8)** — `lib/leaderboard/read.ts` + `lib/leaderboard/model.ts`
  - [x] `fetchLeaderboard(client)`: select all columns from `public.leaderboard` (event-global view; anon client). Hand-type the row.
  - [x] Pure `model.ts`: board definitions for `Tasa` (rate) and `Volumen` (volume), a `sortBoard(rows, board)` (desc by the board's stat, tabular values), `hideBelowFloor(rows, board)` (rate boards only — `eligible_rate`), and `eligibilityLabel`/`sin datos` mapping. No re-derivation of the 24/20 floors.
- [x] **Task 6 — Leaderboards surface (AC4, AC5, AC9)** — `app/(viewer)/leaderboards/page.tsx` (+ module CSS, a client toggle island)
  - [x] Replace the `Placeholder`. Server Component reads the view; a small `'use client'` segmented-toggle island switches `Tasa`/`Volumen` in place (URL param or client state — keep it a reversible toggle, tone+weight active, no blue fill). Fixed narrow columns → no horizontal scroll; tabular numerals; rows are ≥44px `Link`s to player detail. Eligibility section + the fixed floor callout. Empty state when the view is empty.
- [x] **Task 7 — Player detail read + model + surface (AC6, AC7, AC8, AC9)** — `lib/player/read.ts` + `lib/player/model.ts` + `app/(viewer)/jugador/[steamid64]/page.tsx`
  - [x] `fetchPlayerDetail(client, steamid64)`: the player's single `leaderboard` row (headline + weird totals) + their approved `stat_row` rows joined to `match` (bracket_position, opponent, score) for the matches-behind list. Hand-type rows. Return `{ok:false, reason:'not_found'}` when no row → render a graceful not-found (never blank).
  - [x] Pure `model.ts`: shape the base section, the weird-only section, the matches list, and the provenance line (`Verificado desde el demo` + optional hash). `sin datos` for NULL rate values.
  - [x] The route: Server Component, `dynamic='force-dynamic'`, back affordance to `/leaderboards`. Wire leaderboard rows (Task 6) + any feed player mention to it.
- [x] **Task 8 — i18n additions (AC9)** — `lib/i18n/es.ts`
  - [x] Add the new namespaces/keys (bracket labels + badges, leaderboard toggle/segnotes/eligibility, player-detail section headers, provenance). Fixed strings verbatim; add a capitalized `Verificado desde el demo` (distinct from the existing lowercase feed chip `verificado desde el demo`) — see [i18n note](#i18n-additions). No inline literals in any component.
- [x] **Task 9 — Unit tests (AC10)**
  - [x] Node-Vitest for the pure logic in Tasks 3/5/7 (faked clients à la `lib/feed/read.test.ts`), the shared resolver (Task 2), and the `0022` pgTAP (Task 1). Cover the edge cases named in AC10.
- [x] **Task 10 — Gate + local live-QA**
  - [x] `npm run lint`, `npm test`, `npm run build`, `supabase test db` all green. Live-QA (anon browser session, local Supabase — mind the **WinNAT / Kong@55321** env traps in memory): seed a small bracket (reuse `lib/bracket/generate.ts`) + approve a match or two so `match`/`leaderboard`/`stat_row` have real rows, then confirm on a 390px viewport: the bracket renders grouped with bracket-position labels + per-state badges + winner-green/loser-red on resolved nodes + **no admin buttons**; the leaderboards toggle re-ranks with no horizontal scroll + tabular alignment + below-floor hidden on rate; player detail shows base+weird+matches+provenance; and every read is the **anon** path (not service-role). Record the anon `match` readability result (as 5.5/5.6 did).

## Dev Notes

### The read model — exactly what each surface reads

**Bracket → `public.match` (migration `0010`), viewer-readable only after your `0022`.** Columns you use: `id`, `tournament_id`, `bracket` (`'winners'|'losers'|'grand_final'`), `bracket_position` (the human label — render this, never a running number), `bracket_slot` (order key), `gf_order` (1=GF, 2=GF-reset), `competitor_a`/`competitor_b`/`winner_entry` (**`roster_entry.id` bigint — NOT names, NOT steamid64**; composite-FK'd to the roster), `score_a`/`score_b` (render only when `state ∈ resolved/manual_resolved`), `score_source`, `state` (the enum driving AC3), `demo_id` (present → show the `verificado desde el demo` chip). Filter `where tournament_id=$1 order by bracket, bracket_slot` (index `match_tournament_bracket_idx`). **Champion** = the resolved `grand_final` winner (cross-check `tournament.final_match_id`) — only that node gets the gold border.

**Leaderboards + player headline → `public.leaderboard` view (migration `0021`, AD-20 single site).** Already anon-granted. One row per `steamid64`; columns: identity `steamid64`/`display_name`/`matches_played`/`rounds_played_total`/`kills_total`; **rate** `adr_damage_sum`+`adr`, `kast_rounds_sum`+`kast_pct`, `hs_kills_sum`+`hs_pct`, `entry_opportunities`+`entry_frags_total`/`opening_deaths_total`+`entry_success`; **volume totals** `deaths_total`, `assists_total`, `mvps_total`, `flash_assists_total`, `utility_damage_total`, `knife_kills_total`, `wallbang_kills_total`, `through_smoke_kills_total`, `no_scope_kills_total`, `blind_kills_total`, `entry_frags_total`, `opening_deaths_total`; **eligibility flags** `meets_round_floor` (≥24), `meets_kill_floor` (≥20), `eligible_rate`. Rate values can be **NULL** (0-opportunity denominator) → render `sin datos`, never crash. The view is **event-global** (not tournament-scoped) — correct for this single event; if a second tournament ever exists this needs a scope predicate (out of scope, single-event assumption — same posture as 5.6's `resolveCurrentTournament`). **No clutch board exists** (structurally `{}` over all-1v1 wingman — do not add one; `0021:34-35`).

**Player "matches behind them" → `stat_row` (approved, anon-readable via the `stat_view` policy + grant in `0009_stat_pending_visibility.sql`) joined to `match`.** This is a **raw per-match list** (bracket_position, opponent, score, provenance `demo_id`) — display only, **not a re-aggregation** (AD-20 governs *standings*, not a match list). `stat_row.match_id` → `match` (index `stat_row_bracket_match_idx`, `0010:200-201`). Note `idle_round_count` lives on `stat_row` (not in the view) — see the [idle-rounds decision](#decision-idle).

**Name resolution (bracket + identity).** `roster_entry.id → roster_entry.steamid64 → player.display_name`; `roster_entry.bracket_seed` for the seed chip. Anon can read `player` (`using(true)`, `0002:51,71`) and `roster_entry` **active-only** (`status='active'`, `0004:58-59`) → a removed-after-playing player won't resolve; degrade to `Jugador retirado`/steamid tail. Leaderboard rows already carry `display_name` from the view's own LEFT JOIN, so the leaderboard/player-headline needs no extra name query — only the bracket does.

### The app you're building into — stack + hard conventions (baseline `fb02428`)

- **Next.js 16.2.10 · React 19.2.7 · TS 5.9 (strict, `verbatimModuleSyntax` → `import type`) · `@supabase/ssr` 0.12.0 · `@supabase/supabase-js` 2.110.0 · Vitest 4.1.9 (node env, `include: lib/**/*.test.ts`) · ESLint 9.** No Prettier. Path alias `@/* → ./*`. App name `inclusivcup`. `npm test` = `vitest run`; `npm run build` = `next build`; `npm run lint` = `eslint .`.
- **Read client (use this): `createSupabaseServerClient()` (`lib/supabase/server.ts`)** — anon, RLS-respecting `@supabase/ssr`. **NEVER** `getAdminClient()` (`lib/supabase/admin.ts`, service-role) for a viewer read. Env only via `@/lib/env`.
- **House style to mirror:** Server Component with `await`-ed async params/`searchParams`; discriminated-union results `{ok:true…}|{ok:false,reason}`; `console.error('[label]', err)`; colocated `*.test.ts`; feature-organized `lib/`; hand-typed rows (no generated DB types); `import 'server-only'` on read modules; `test/stubs/server-only.ts` makes them unit-testable.
- **5.6 foundations to reuse:** `app/(viewer)/` route group + `layout.tsx` shell (topbar, live pill via `livePillState`, `<Nav>`), `Nav.tsx` (four-up, `ceremonyUnlocked`), `app/(viewer)/current-tournament.ts` `currentTournament()` (React `cache()` — one `tournament` read/request; reuse for your per-request tournament id), `app/globals.css` tokens + `.num`, `lib/i18n/es.ts`, CSS-Module convention, `Placeholder.tsx` (the stubs you replace).

### Design tokens (already in `app/globals.css` — do NOT redefine)

Dark-only: `--page #0F1419`, `--s1 #171E26`, `--s2 #1E2832`, `--line #232C36`, `--tp #F4F6F8`, `--ts #B7C2CE`, `--tm #8A97A6`, `--blue #2F81F7`, `--gold #FFB23E`, `--win #3FB950`, `--loss #F0556A`, `--ink-locked #5D6875`, `--node-muted #39434F`; radii `--r-sm/md/lg/pill` (6/12/16/pill); spacing `--sp-1..8` (4/8/12/16/24/32); `.num` = tabular lining numerals. **Gold discipline (UX-DR6):** gold is *only* the resolved champion node on these screens — never on wordmark, nav, ordinary node chrome, badges, links, or focus rings. Any other gold pixel is a bug.

<a id="i18n-additions"></a>### i18n additions — fixed strings verbatim (`lib/i18n/es.ts`)

Add (grouped): **bracket** — `Pase directo`, `W.O. / Ausente`, `sin estadísticas`, `en vivo` (reuse `es.live.on`? the bracket node badge is lowercase `en vivo` per mock — add a distinct key), `por jugar`, `Ganadores`/`Perdedores`/`Gran final` group labels, round labels come from the DB `bracket_position` (don't hardcode). **leaderboards** — `Tasa`/`Volumen`, segnotes (`totales · contados` / `por oportunidad`), `Estadísticas`, `Actualizado desde el último demo`, `aún no elegible · Mín. 24 rondas`, the fixed callout `Mín. 24 rondas — partidas inactivas descalificadas de los premios`, `Elegibilidad`, `Rondas`/`Muertes`, `DQ`. **player detail** — `Estadísticas base`, `Estadísticas raras solo del demo`, `% de cabeza`, `Muertes / Bajas / Asist.`, `sin datos`, and a **capitalized** `Verificado desde el demo` (the module today only has the lowercase feed chip `es.result.verified = 'verificado desde el demo'`; the player-detail provenance line is sentence-initial capitalized in the mock/`EXPERIENCE.md:60,75` — add `es.provenance.verified = 'Verificado desde el demo'`, keep both). Reuse `es.empty.body`, `es.unknownPlayer`, `es.ceremony.seededByDemo`.

### Scope boundaries — what is NOT in this story

- **Awards / the blurred `Posiciones de premios` block** (`mock-leaderboards.html` Estado B, `SE DESBLOQUEA EN LA CEREMONIA`, `12 categorías selladas`) = **FR-24 / Epic 6**. The `award` table doesn't exist. Do not build it. Leaderboards = stat rankings only.
- **Realtime nudge / ~2s live updates / `Reconectando…` / reconnect reconcile** = **Story 5.8** (AD-11 driver). You build the *snapshot reads* it re-invokes; you render the live pill states statically. No Supabase Realtime subscription, no browser client here.
- **Bracket-advance / rollback feed writers** = still deferred (`deferred-work.md:41,74`); not this story.
- **Admin advance/forfeit/approve UI** = admin console, server-gated; never rendered for viewers (the whole point of FR-34).
- **Ceremony surface** = the `Ceremonia` tab (Epic 6); the tab stays locked here.

### Decisions this story makes (defaults chosen — flagged ones repeated at the end)

<a id="decision-match-policy"></a>**`match` viewer policy shape.** Default: **`using (true)`** — the bracket structure is public state (like `tournament`/`season`), and no unapproved score leaks because a score renders only for `resolved`/`manual_resolved` states (AC2) while stat rows stay gated at `stat_row`. *Flagged — Cuatro may want a tighter predicate (e.g. hide `void`/`pending` rows at the DB), but `using(true)` + client-side state rendering is simpler and honest.*

<a id="decision-bracket-layout"></a>**Bracket mobile layout.** Default: **three vertically-stacked bracket sections** (Winners → Losers → Grand final), each a scannable column of nodes, plus a **focused-match** expand/route on tap. *Not* a literal pinch-zoom/pan canvas (the mock shows a zoom control + "pan/zoom") — real pan/zoom is heavy for an 8–16-player private event and fights the no-horizontal-scroll rule. *Flagged — if Cuatro wants the map/zoom UX, that's a bigger build; recommend the stacked layout for MVP.*

<a id="decision-boards"></a>**Leaderboard board set.** Default (lean): **`Tasa`** = ADR (primary sort) + HS% + KAST columns; **`Volumen`** = Kills (primary) + one weird total (e.g. knife). No per-stat sub-picker. *Flagged — Cuatro may want a stat selector or a specific set of boards (the mock foregrounds knife-kills as a "weird" headline). Given the casual/fun private scope, keep it lean unless asked.*

<a id="decision-route-name"></a>**Player-detail route path.** Default: **`app/(viewer)/jugador/[steamid64]`** (Spanish segment, matching the existing `/ceremonia`). *Flagged — the repo also has English segments (`/bracket`, `/leaderboards`); pick one convention. Recommend `/jugador` for user-facing Spanish consistency.*

<a id="decision-idle"></a>**Idle-rounds on player detail.** The mock shows `Rondas inactivo`. It is **not** in the leaderboard view (`idle_round_count` lives on `stat_row`). Default: **omit it from MVP** (or show it as a simple sum from the player's `stat_row` list already fetched — a raw count, not a normalized standing, so no AD-20 conflict). *Flagged minor.*

**Server vs client.** Server Components for the reads; a thin `'use client'` island only for the leaderboard `Tasa`/`Volumen` toggle. No browser Supabase client (5.8's concern).

### Previous-story intelligence

- **Story 5.6 (feed, done `fb02428`):** established every foundation you reuse; its review moved score rendering to **winner-first** (winner's number first/green) — mirror that on bracket nodes (winner name+score first). Its `resolveCurrentTournament`/`currentTournament()` binds "current" to `max(id)` (single-event assumption, Cuatro-accepted) — reuse it; don't re-solve.
- **Story 5.5 (leaderboard view, done):** the view emits **machine values only**; the app maps to Spanish labels and reads eligibility flags — never re-derives floors. Rate = Σnum/Σden (sum-then-divide), NULL on 0-opportunity → `sin datos`. Idle-only / forfeit / bye players **vanish** (zero rows) by design — not a bug.
- **Measure-don't-assume (5.2a / project-wide):** the bracket/leaderboards **will** look sparse until matches are approved. Prove at live-QA that real approved rows render — don't ship an empty surface that's empty for a *different* real reason (missing `0022` grant, wrong tournament id, a broken name join, or a service-role/anon mixup). Mutation-test the guards before review (the hard-won pre-review step).
- **AD-7 fail-closed:** two policies, never one OR'd. Your `0022` viewer policy is additive and separate from the admin policy.

### Project Structure Notes

- **New files:** `supabase/migrations/0022_match_viewer_read.sql` + `supabase/tests/0022_match_viewer_read_test.sql`; `lib/roster/names.ts` (+ test); `lib/bracket/{read,model}.ts` (+ tests); `lib/leaderboard/{read,model}.ts` (+ tests); `lib/player/{read,model}.ts` (+ tests); `app/(viewer)/jugador/[steamid64]/page.tsx`; bracket/leaderboard component files + `*.module.css`; new `es.ts` keys.
- **Modified:** `app/(viewer)/bracket/page.tsx` + `app/(viewer)/leaderboards/page.tsx` (replace `Placeholder`); `lib/feed/read.ts` (re-point at the extracted resolver); `lib/i18n/es.ts` (additions). Possibly `es.placeholder` shrinks (bracket/stats no longer placeholders; `ceremony` stays).
- **No conflict:** you add feature modules under `lib/` and routes under `app/(viewer)/`; the shell/nav/tokens are reused unchanged. Keep tests in `lib/` (Vitest node-only); render verification is live-QA.
- **Testing env:** Vitest `include: ['lib/**/*.test.ts']` — `app/` components are not unit-tested; test the pure `lib/` layer + faked clients. pgTAP for `0022` under `supabase/tests/`.

### References

- Story 5.7 ACs + traces: [epics.md](../planning-artifacts/epics.md) L947-967; epic intro L823-825; UX-DRs L114-131; FR map L159-172.
- FR-23 / FR-32 / FR-34 / FR-22 / NFR ~2s + mobile: `_bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md` L332-339, L419-425, L439-444, L325-330, L496-503, L530.
- AD-7 / AD-11 / AD-20 / AD-24 (+ capability map F5): `…/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md` L110-113, L130-133, L175-178, L195-198, L229, L462; read/realtime + leaderboard normalization: `…/SOLUTION-DESIGN.md` L264-268, L377-383, L449-464.
- **`match` table + the deferred viewer grant (your `0022`):** [0010_match.sql](../../supabase/migrations/0010_match.sql) L38-72 (columns), L64-65 (state enum), L59-63 (bye/void), L112-117 (indexes), L30 & L210-232 (the Epic-5 grant deferral — this story closes it).
- Leaderboard view columns/flags: [0021_leaderboard.sql](../../supabase/migrations/0021_leaderboard.sql) L49-56 (floors), L86-131 (columns), L124-128 (read-flags-don't-re-derive), L137 (grants); Story context [5-5-single-normalized-leaderboard-view-rpc.md](5-5-single-normalized-leaderboard-view-rpc.md).
- stat_row provenance + anon read: [0007_stat_row.sql](../../supabase/migrations/0007_stat_row.sql) L35-50; `stat_view` approved-only policy + anon grant [0009_stat_pending_visibility.sql](../../supabase/migrations/0009_stat_pending_visibility.sql); match_id FK + index [0010_match.sql](../../supabase/migrations/0010_match.sql) L173-201.
- Name resolution / roster: [0004_roster.sql](../../supabase/migrations/0004_roster.sql) L26-35, L58-59 (active-only); `player` anon read [0002_rls.sql](../../supabase/migrations/0002_rls.sql) L51,71.
- UX (authoritative): `…/ux-designs/ux-cs-tournament-2026-06-30/mockups/mock-bracket.html` (3 states: map L470-618, focused L621-720, W.O. L723-826), `…/mockups/mock-leaderboards.html` (Volumen L311-383, Tasa L386-458, awards-lock=**Epic 6** L461-515, eligibility L518-553, player detail L559-651); `DESIGN.md` L15-26 (tokens), L49-50/L236 (tabular), L100-108/L266 (bracket node), L113-120/L268 (segmented control), L176-185 (badges), L192-197/L281 (nav), L206-224 (dark-only + gold discipline), L242 (mobile-first); `EXPERIENCE.md` L29/L134 (read-only, no disabled controls), L38-41 (IA), L85-89/L102 (patterns), L108-120 (states), L137-145 (a11y), L189 (responsive). **Spine wins on any mock conflict** (`EXPERIENCE.md:52`); **ignore the divergent bottom tab-bar** in the bracket/leaderboard mocks — keep the 5.6 nav.
- 5.6 foundations (reuse): `app/(viewer)/layout.tsx`, `app/(viewer)/components/Nav.tsx`, `app/(viewer)/current-tournament.ts`, `app/globals.css`, `lib/i18n/es.ts`, `lib/feed/read.ts` (name resolver to extract), `lib/feed/read.test.ts` (faked-client precedent), `lib/supabase/server.ts` (anon client), `lib/supabase/admin.ts` (do-not-use). Prior story: [5-6-timeline-feed-read-read-side-of-fr-31.md](5-6-timeline-feed-read-read-side-of-fr-31.md).

## Dev Agent Record

### Agent Model Used

Opus 4.8 (claude-opus-4-8), bmad-dev-story workflow.

### Debug Log References

- `supabase test db` — full pgTAP suite **PASS** (23 files, 924+ assertions). New `0022` suite green; `0010`'s five post-viewer assertions updated to the final schema (the "prior suite green against final schema" gotcha) with `⚠ UPDATED BY STORY 5.7` annotations.
- `npm test` (Vitest) — **445 passed** (30 files). +53 new lib tests (roster names, bracket model/read, leaderboard model/read, player model/read).
- `npm run lint` — **clean**. `npm run build` — **OK**; `/bracket`, `/leaderboards`, `/jugador/[steamid64]` all emit `ƒ` (dynamic), none prerendered.
- Local live-QA (anon path, Kong@**55321** — the WinNAT/Kong remap trap from memory reconfirmed): seeded a `bracket_live` tournament (resolved + live + bye + resolved-GF-champion + reset matches; 4 approved stat rows). Anon REST returned all 6 `match` rows (0022 works end-to-end) + 4 `leaderboard` rows with correct `eligible_rate` flags. SSR of the three routes confirmed: bracket sections (Ganadores/Perdedores/Gran final), bracket-position labels, `en vivo`/`Pase directo` badges, gold `Campeón` node, resolved scores 16-13/16-14/16-9 (unscored states show none), **no admin affordance** (Avanzar/Marcar W.O/admintag all absent); leaderboards Tasa/Volumen toggle + `aún no elegible · Mín. 24 rondas` + DQ + player-detail links; player detail base stats + `Verificado desde el demo`. Seed cleaned up afterward.

### Completion Notes List

- **AC1 — `0022_match_viewer_read.sql` (+ pgTAP):** viewer SELECT policy `match_viewer_read using(true)` + `grant select on match to anon, authenticated`, SEPARATE from the untouched admin policy (AD-7 two-policy). Flagged decision confirmed at `using(true)` (Cuatro). No unapproved leak — score renders only for resolved states (AC2), stat rows stay gated at `stat_row` (0009).
- **AC2/AC3 — Bracket:** `lib/bracket/{read,model}.ts` shape the seeded double-elim into stacked Winners→Losers→Grand-final sections ordered by `bracket_slot`, labeled by `bracket_position` (never a running number), score ONLY for `resolved`/`manual_resolved`, per-state badges, `void` dropped, `rolled_back`→undecided. Champion (the only gold) detected across the AD-21 two-row GF (reset resolved → its winner; else GF1 resolved AND won by `competitor_a` = the WB champ outright). Winner-first ordering mirrors the 5.6 feed fix. Focused view (`?match=`) reuses the same model; **no admin advance/forfeit control rendered** (FR-34/UX-DR4).
- **AC4/AC5 — Leaderboards:** `lib/leaderboard/{read,model}.ts` read the ONE `public.leaderboard` view and filter/order/format client-side — never re-aggregate, never re-derive floors (read `eligible_rate`). Lean board set (flagged decision): Tasa = ADR+HS%+KAST, Volumen = Kills+knife. Tasa hides below-floor from the ranking (surfaced in the eligibility section with the fixed `aún no elegible · Mín. 24 rondas`); Volumen keeps everyone. Toggle is tone+weight only (no blue fill, no gold). `sin datos` on NULL rates.
- **AC6 — Player detail:** route `app/(viewer)/jugador/[steamid64]` (flagged decision → Spanish segment). Headline from the ONE leaderboard row (AD-20), weird demo-only totals, matches-behind = a RAW per-match listing of approved `stat_row`×`match` (not a re-aggregation). Provenance line uses the capitalized `Verificado desde el demo`. Idle-rounds omitted (flagged, MVP).
- **AC7 — Shared resolver:** extracted 5.6's batched roster→player resolver to `lib/roster/names.ts`; re-pointed `fetchFeedSnapshot` at it (feed tests unchanged/green); bracket + player reuse it. Removed-after-playing → `Jugador retirado`.
- **AC8 — Reconstructable:** every read is a self-contained `(client, …)` function through the anon `createSupabaseServerClient()` (never service-role); pages are `force-dynamic` Server Components — Story 5.8 re-invokes them verbatim.
- **AC9 — Spanish/dark/tabular/a11y:** all copy through `lib/i18n/es.ts` (new bracket/leaderboards/player/provenance namespaces; fixed strings verbatim); dark tokens reused; `.num` on every number; `aria-live` region on the bracket; gold ONLY on the champion node.
- **AC10 — Gates:** all green (see Debug Log).
- Flagged decisions (all confirmed by Cuatro at recommended defaults): match RLS `using(true)`; stacked bracket layout + focused-match on tap; lean board set; `/jugador/[steamid64]` route; idle-rounds omitted.

### File List

**New:**
- `supabase/migrations/0022_match_viewer_read.sql`
- `supabase/tests/0022_match_viewer_read_test.sql`
- `lib/roster/names.ts` + `lib/roster/names.test.ts`
- `lib/bracket/read.ts` + `lib/bracket/read.test.ts`
- `lib/bracket/model.ts` + `lib/bracket/model.test.ts`
- `lib/leaderboard/read.ts` + `lib/leaderboard/read.test.ts`
- `lib/leaderboard/model.ts` + `lib/leaderboard/model.test.ts`
- `lib/player/read.ts` + `lib/player/read.test.ts`
- `lib/player/model.ts` + `lib/player/model.test.ts`
- `app/(viewer)/bracket/BracketNode.tsx`
- `app/(viewer)/bracket/FocusedMatch.tsx`
- `app/(viewer)/bracket/bracket.module.css`
- `app/(viewer)/leaderboards/LeaderboardBoards.tsx`
- `app/(viewer)/leaderboards/leaderboards.module.css`
- `app/(viewer)/jugador/[steamid64]/page.tsx`
- `app/(viewer)/jugador/[steamid64]/player.module.css`

**Modified:**
- `app/(viewer)/bracket/page.tsx` (replaced Placeholder)
- `app/(viewer)/leaderboards/page.tsx` (replaced Placeholder)
- `lib/feed/read.ts` (re-pointed at the extracted resolver)
- `lib/i18n/es.ts` (bracket/leaderboards/player/provenance namespaces)
- `supabase/tests/0010_match_test.sql` (5 assertions updated to the final schema after 0022)

### Change Log

- 2026-07-28 — Story 5.7 implemented (bmad-dev-story, Opus 4.8). FR-23/FR-32/FR-34 read-only Spanish mobile-first viewer surfaces: migration `0022` makes `match` viewer-readable (using(true) + anon grant, +pgTAP); `/bracket` (stacked double-elim, per-state, champion-gold, no admin UI), `/leaderboards` (Tasa/Volumen toggle over the one view, eligibility + floors), `/jugador/[steamid64]` (base+weird+matches+provenance). Shared name resolver extracted to `lib/roster/names.ts`. i18n additions. Gates green (lint, 445 vitest, build, `supabase test db`); local anon live-QA passed. Status → review.

## Open Questions for Cuatro (flagged decisions — answer before or during dev-story)

1. **`match` viewer RLS policy** — OK with **`using(true)`** (whole bracket public; scores render only for resolved states so nothing unapproved leaks)? Or want a tighter DB predicate (hide `void`/`pending`)? *(Recommend `using(true)`.)*
2. **Bracket layout** — **stacked vertical sections + focused-match on tap** (recommended, lean, mobile-first, no h-scroll)? Or the mock's map/zoom-pan canvas (bigger build)?
3. **Leaderboard boards** — lean default (`Tasa`: ADR+HS%+KAST; `Volumen`: Kills + one weird total, no stat-picker)? Or a specific board set / a stat selector?
4. **Player-detail route** — **`/jugador/[steamid64]`** (Spanish, matches `/ceremonia`) or `/players/[steamid64]` (English, matches `/bracket`)? *(Recommend `/jugador`.)*
5. **Idle-rounds on player detail** — omit for MVP, or show a simple sum from the player's `stat_row` list? *(Recommend omit / trivial-sum.)*

Confirming the scope boundaries (awards = Epic 6; realtime = 5.8; no admin UI) — all excluded here, matching the epic's dual-ownership carve-outs.

## Review Findings

_Code review 2026-07-28 (bmad-code-review, Opus 4.8, 3 adversarial layers: Blind Hunter / Edge Case Hunter / Acceptance Auditor). 0 decision-needed · 7 patch · 0 defer · 7 dismissed. All findings verified against source before triage._

- [x] [Review][Patch] Anti-farm eligibility column mislabeled **"Muertes" (Deaths) over a kills value**; the same Deaths/Kills confusion recurs in the floor sub-copy `20 muertes` for a 20-**kills** floor. Codebase convention is Muertes=Deaths / Bajas=Kills (see `es.player.kda = 'Muertes / Bajas / Asist.'`). AC5 says surface `kills_total` (the value is right; the label is wrong). Fix: eligibility header → a kills label (`Bajas`/`Kills`); `floorSub` `20 muertes` → `20 bajas`. [app/(viewer)/leaderboards/LeaderboardBoards.tsx:94] + [lib/i18n/es.ts:140,149]
- [x] [Review][Patch] Grand-final section renders in **nondeterministic order** — both GF rows (game 1 `gf_order=1`, reset `gf_order=2`) are emitted at `bracket_slot=0` (`generate.ts:458-463`; uniqueness is on `(bracket,slot,coalesce(gf_order,0))`), but the read orders only by `bracket_slot` and `groupBracket` sorts the GF section on `bracket_slot` alone — the reset can render above the game it resets. Fix: add `gf_order` as a secondary sort in the read and a tiebreak in `groupBracket`. [lib/bracket/read.ts:46] + [lib/bracket/model.ts:232]
- [x] [Review][Patch] Removed-player (null roster id) **matches-behind list fabricates data**: when a player was removed after playing, the active-only `roster_entry` read returns nothing → `playerRosterId=null`, so every scored match renders as a `loss`, seat-B scores are swapped, and the opponent falls back to the player themselves ("Venció a `<self>`"). The player still has a `/jugador` page because the leaderboard view is keyed on `stat_row.steamid64`, not roster. Fix: when `playerRosterId==null`, do not assert win/loss or self-as-opponent (neutralize outcome + opponent, or omit the list). [lib/player/model.ts:70-99] (read anchor [lib/player/read.ts:64-72])
- [x] [Review][Patch] `FocusedMatch` **never renders `node.badge`** — the focused view shows `footNote` (noStats/awaiting/por_jugar) but no `live`/`bye`/`forfeit` badge. A `live` focused match (`/bracket?match=<liveId>`) shows two competitors, no score, and no `en vivo` — indistinguishable from an unplayed match; `bye`/`forfeit` lose their `Pase directo`/`W.O. / Ausente` labels. Fix: render the badge in the focused card. [app/(viewer)/bracket/FocusedMatch.tsx:32-68]
- [x] [Review][Patch] `nameOfRow` uses `??` (nullish), so an **empty-string `display_name` renders a blank name** (avatar collapses to `·`); the shared `resolveNames` uses a truthy check and falls back to the steamid tail — so the same player renders two ways. Fix: `row.display_name || \`#…tail\``. [lib/leaderboard/model.ts:86]
- [x] [Review][Patch] Seed chips in the focused-match and player-detail views **omit the `.num` tabular-numeral class** (the bracket-node seed carries it). AC9 requires tabular numerals on every number incl. seeds. [app/(viewer)/bracket/FocusedMatch.tsx:21] + [app/(viewer)/jugador/[steamid64]/page.tsx:53]
- [x] [Review][Patch] Migration `0022` header comment **overstates the `using(true)` guarantee** — it claims a provisional score "never leaks", but `score_a`/`score_b`/`state` are readable by any anon caller via raw PostgREST; the state-gated hiding is app-layer only (the accepted flagged decision). No leak today since scores are written only in the Aprobar/resolved tx, but the DB-level "never" is inaccurate. Fix: soften the comment to say the gate is app + write-path, not DB-enforced. [supabase/migrations/0022_match_viewer_read.sql]

**Regression tests added (lock patches 2/3/5 — the pure-logic fixes the 445-test suite was blind to):** `lib/bracket/model.test.ts` (grand-final rows order game-1-before-reset despite a shared `bracket_slot=0` + reversed input), `lib/player/model.test.ts` (a removed/null-roster player gets a neutral row — no fabricated loss/swapped-score/self-opponent), `lib/leaderboard/model.test.ts` (`nameOfRow` tails an empty-string `display_name`). Each was mutation-verified to fail against the pre-fix code. `npm test` → **448 passed** (445 + 3).

**Dismissed (7):** `detectChampion` two-row-GF assumption (the reset row is always generated — `generate.ts:463` — so it always holds); player-detail roster read `.limit(1)` unscoped (accepted single-event assumption, same posture as 5.6's `resolveCurrentTournament`); `?match=` on empty/void id shows generic empty/not-found copy (acceptable UX, void = never played); resolved match with NULL `winner_entry` colours both red (worker invariant — resolved always sets a winner; defensive-only); repeated `?match=` param → falls through to the map (benign); base K/D/A vs the fixed `Muertes / Bajas / Asist.` D/K/A order (spec-internal contradiction, but label+values are self-consistent and honest — no defect; flag for spec reconciliation if the order matters); `aria-live` announces only the champion, not live/Final transitions (those are Story 5.8 realtime; the static snapshot has none to announce).
