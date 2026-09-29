---
baseline_commit: e9d93f7294540765e4b338061a1216f1b80c528a
---

# Story 4.5: Bye and forfeit walkover with grace timer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want byes and forfeits to advance a player with zero stats and only after a grace timer,
so that no-shows are handled cleanly without phantom stat wins.

## Acceptance Criteria

**AC1 — zero-stats bye/forfeit (AD-9, FR-8, FR-17).**
**Given** the zero-stats rule, **When** a match resolves as `Bye` or `Forfeit`, **Then** there is no reachable stat-write path; the present player advances with a structural badge and no stat rows are created.

**AC2 — grace timer (FR-9, AD-9).**
**Given** the grace-timer rule, **When** one player is absent, **Then** the match sits in `AwaitingGrace` and the admin can mark `Forfeit` only after the grace timer (default 10 min, configurable) elapses, **And** the forfeit is logged with actor + timestamp.

**AC3 — single-writer precedence (AD-23).**
**Given** single-writer precedence, **When** a demo later arrives for a committed forfeit/bye, **Then** it is archived for evidence but never flips the match.

_Traces: FR-8, FR-9 · AD-9, AD-23_

---

## THE ONE-PARAGRAPH HEADLINE

**The bye half of this story already ships; the forfeit half does not.** Story 4.1's generation seats and *pre-advances* Winners-R1 structural byes (`generate.ts:493-497` — `state='bye'`, `winner_entry=entryA`, and the winner is `place()`d into the next round at generation), and 4.3's `advance_match` walkover cascade (D3) walks every Losers `bye` node straight through (proven at 4.3 live-QA: "0 byes left un-walked"). `advance_match` **already accepts** `state in ('bye','forfeit', …)` as an advanceable result (`0014_grand_final_reset.sql:417`). So AC1's bye path is a *proof obligation*, not new code. What 4.5 actually builds is the **no-show forfeit path with a server-enforced grace clock** (AC2) and the **AD-23 terminal-state guard** that makes a committed `forfeit`/`bye` un-flippable by a later demo/Aprobar (AC3). The forfeit is a normal double-elim loss driven through the *existing* `advance_match` — mark the present player the winner, transition `awaiting_grace → forfeit`, and let `advance_match` route the winner forward and drop the absent loser exactly as it does for a played result. The one hard correctness point, flagged to this story BY NAME in three prior code reviews: **`mark_walkover` calls `advance_match`, and a returned `{ok:false}` MUST roll the forfeit back** — a forfeit committed with no advance is the exact partial state the whole two-pass design exists to prevent.

---

## Developer Context — READ THIS BEFORE YOU TOUCH ANYTHING

### What already exists (do NOT rebuild it)

1. **The `match.state` enum already carries `awaiting_grace`, `forfeit`, `bye`, `void`** (`0010_match.sql:64-65`). No new state values. No enum migration.
2. **Structural byes are fully handled end-to-end.** Generation seats Winners-R1 byes (`winner_entry`, `state='bye'`) and pre-advances them (`generate.ts:493-497`); Losers `bye` nodes are marked at generation (competitors NULL) and walked through by 4.3's cascade when a player arrives (`0014:544-571`). `advance_match` treats `state='bye'` as advanceable and seats+crowns the walkover winner in one statement via `match_place_competitor(p_walkover => true)` (`0013:447-509`). **4.5 adds no bye code** — it proves the AD-9 zero-stats invariant and installs the AD-23 guard.
3. **`advance_match` already accepts `forfeit`** as an advanceable result and drops the loser (D2) uniformly (`0014:417,430`). 4.5's `mark_walkover` seats the winner + sets `state='forfeit'` and *calls* it — it does not re-implement advancement.
4. **`audit_log.action = 'mark_walkover'` is already the enumerated vocabulary** (`0003:25`, SOLUTION-DESIGN:251, AD-17). Like `advance`/`declare_format`, it needs NO migration — `action` is uncapped text.
5. **`match_live_requires_locked_format` already EXCLUDES `awaiting_grace`/`forfeit`/`bye`/`void`** (`0012:117-126`), by name, "would block Story 4.5's forfeit path, for no benefit." So the format lock does not fight the forfeit path — verify, don't re-touch that CHECK.
6. **The lib+route+RPC pattern is established** by 4.2: a `security invoker` plpgsql RPC with typed refusals RETURNED (never raised), every guard before any write, service-role-only EXECUTE grant (`0012:268-487`); a thin `lib/match/*.ts` wrapper that validates shape then calls the RPC and classifies the reply (`lib/match/format.ts`); a thin `app/api/admin/**/route.ts` that `requireAdmin`s + `parseBody`s + maps typed reasons to HTTP status (`app/api/admin/match/format/route.ts`). **Mirror 4.2 exactly.** Unlike 4.3/4.4, this story HAS a production caller: "mark `W.O.`" is a direct admin action (EXPERIENCE:45), so it ships the lib + route, not just SQL.

### The hand-offs three prior code reviews left this story, BY NAME (in `deferred-work.md`)

1. **⭐⭐ THE LOAD-BEARING ONE — "a returned `{ok:false}` does NOT roll back the CALLER's transaction" (4.3 review, `deferred-work.md:137`).** Intended home: **"Stories 4.5 / 4.6 (the first callers)."** `mark_walkover` writes `state='forfeit'` + `winner_entry`, then calls `advance_match` in the SAME transaction. `advance_match` RETURNS `{ok:false, reason:'slot_taken'}` (it does not raise) when the winner's destination seat is held by a different player — and if `mark_walkover` commits anyway, the result is a forfeit with no advance: **the precise partial state the two-pass design set out to prevent.** So `mark_walkover` MUST abort (RAISE, with a distinct SQLSTATE — see #2) when `advance_match` returns `{ok:false}`, rolling the forfeit back. The review even suggests the alternative — have `advance_match` itself raise on `slot_taken`; do NOT change `advance_match`'s contract here (4.6 depends on the RETURN semantics), handle it in `mark_walkover`.
2. **`P0001` is PL/pgSQL's GENERIC exception code (4.2 review, `deferred-work.md:127`).** Intended home: **"Story 4.5 (the first story likely to add a second `BEFORE UPDATE` trigger on `match`)."** `lib/match/format.ts:106` maps *any* `P0001` from `declare_match_format` to `already_locked`. So **4.5's new trigger and RPC raises MUST use a DISTINCT custom SQLSTATE, never bare `P0001`** — then format.ts stays unambiguous and 4.5's own lib can classify its refusals precisely (DECISION D). Do not raise `P0001` anywhere in this story.
3. **`declared → live` + the `23514` mapping (4.2 review, `deferred-work.md:128`).** Intended home: 4.5 / 4.6 / Epic-5. **4.5 deliberately does NOT claim `declared → live`** — its `resume` transition returns `awaiting_grace → declared` (DECISION C), so it never lands a "played" state, never trips `match_live_requires_locked_format`, and does not inherit the `23514` obligation. State this explicitly so a reviewer knows the omission is deliberate, not missed.
4. **Five bare `P0001` raises in `advance_match` (4.3 review, `deferred-work.md:139`).** Intended home: "Story 4.5, joining the P0001-ambiguity item." These live in `advance_match`, which 4.5 CALLS but should not rewrite. Leave them; the central SQLSTATE mapping is 4.9's. 4.5 only owes its OWN raises a distinct code (#2). Note the item; do not widen scope into `advance_match`'s guts.

### The mechanism, precisely

`match` carries `competitor_a` (side a) and `competitor_b` (side b). A no-show is a match where BOTH seats are filled (both players are determined) but one player is physically absent. The forfeit is a **normal double-elim loss**:
- the **present** player is the winner (`winner_entry`), advances via the `winner_to_*` edge;
- the **absent** player is the loser (`v_loser = the competitor who is not winner_entry`, computed inside `advance_match`), drops via the `loser_to_*` edge if there is one (Winners → Losers; a Losers no-show is eliminated — the two-loss rule, DERIVED from edges).

So `advance_match` needs **zero changes**: `mark_walkover` seats the winner and sets `state='forfeit'`, then calls `advance_match(match_id, actor)` which does the routing (and the `bracket.advanced` broadcast — AD-11's single emitter; do NOT build a second one). The grace clock is a server timestamp (`match.awaiting_grace_since`) + a per-tournament period (`tournament.grace_period_seconds`), and the elapsed check is enforced in the DB, never trusted from the client (the UX `{components.grace-timer}` MM:SS countdown is a client render of the same server timestamp — EXPERIENCE:98,115).

---

## Tasks / Subtasks

### Task 0 — Re-read the load-bearing code before editing (do not skip) (AC: all)
- [x] Read `supabase/migrations/0014_grand_final_reset.sql` `advance_match` end to end — the result gate (`:417-425`), the loser computation (`:430`), `match_place_competitor` semantics (`0013:447-509`), and the RETURN-not-raise refusals (`0013:731-735,538-541`). **Confirm** `state='forfeit'` with a `winner_entry` is advanceable and drops the loser with no change.
- [x] Read `supabase/migrations/0012_format_lock.sql` in full — the CONSTRAINT-TRIGGER pattern (`match_format_lock_guard` latch + `match_format_audit_guard`), the RPC's guards-before-writes discipline, the `~ '[^[:space:]]'` non-blank idiom, and the service-role-only grant block (`:480-487`). This is the migration 0015 mirrors.
- [x] Read `lib/match/format.ts` + `app/api/admin/match/format/route.ts` end to end — the exact lib (validate → `admin.rpc` → classify by reason set + SQLSTATE) and route (`requireAdmin` → `parseBody`/`isPositiveInt` → `STATUS_FOR` map) shapes to copy.
- [x] Read `lib/bracket/generate.ts:485-501,527-557` — how byes are seated/pre-advanced and how Losers walkover states are derived. Confirm no stat_row is ever written for a bye (there is no demo, and stat rows come only from the worker's parse).
- [x] Read `ARCHITECTURE-SPINE.md:120-123` (AD-9), `:190-193` (AD-23), the Match-lifecycle diagram (`:299-317`), and `SOLUTION-DESIGN.md:352-366` (§7 Bracket & match). Confirm the lifecycle edges 4.5 owns: `Declared → AwaitingGrace` (one player absent), `AwaitingGrace → Forfeit` (grace elapsed + admin W.O.), `AwaitingGrace → Declared` (absent player arrives — DECISION C).

### Task 1 — Schema: grace config + grace clock + the AD-23 terminal guard (migration `0015_walkover_grace.sql`) (AC: 2, 3)
- [x] New migration `supabase/migrations/0015_walkover_grace.sql`. Header in the 0012/0013/0014 house style: state the ONE concern, SCOPE, and OUT-OF-SCOPE (each with its owning story).
- [x] **Grace config (DECISION A):** `alter table public.tournament add column grace_period_seconds int not null default 600 check (grace_period_seconds > 0);` — 10 min default, per-tournament configurable (FR-9 "Admin-configurable"; SPINE:471 "grace timer … tournament config"). Comment it. Existing tournament INSERTs are unaffected (the column defaults).
- [x] **Grace clock:** `alter table public.match add column awaiting_grace_since timestamptz;` — nullable; stamped `now()` when a match enters `awaiting_grace`, read by the forfeit gate. Comment: "AD-9 grace clock: when the no-show grace period started. The `mark_walkover` elapsed-check is `now() >= awaiting_grace_since + grace_period_seconds` — server-enforced, never client-trusted."
- [x] **AC3's teeth — the AD-23 terminal-state guard (`BEFORE UPDATE` trigger `match_terminal_state_guard`).** Once `state in ('bye','forfeit','void')`, the STATE is terminal (SPINE lifecycle: `Bye → [*]`, `Forfeit → [*]`; `void` is never played). The trigger REJECTS any UPDATE that changes `state` **out of** a terminal value, so a later Aprobar (4.6) physically cannot flip a committed forfeit/bye to `resolved`/`pending` — "`Resolved` and `Forfeit` cannot coexist" becomes true by construction (AD-23). Shape:
  ```sql
  create function public.match_terminal_state_guard() returns trigger
    language plpgsql security invoker set search_path = '' as $$
  begin
    if old.state in ('bye','forfeit','void') and new.state is distinct from old.state then
      raise exception
        'match %: state % is TERMINAL (AD-23) — a committed bye/forfeit/void is the single arbiter and cannot be flipped by a later demo/result', old.id, old.state
        using errcode = '<DISTINCT SQLSTATE — see DECISION D>',
              hint = 'A late demo for a committed forfeit/bye is archived for evidence (AD-1) but never changes the match.';
    end if;
    return new;
  end; $$;
  create trigger match_terminal_state_guard before update on public.match
    for each row execute function public.match_terminal_state_guard();
  ```
  - ⚠ **Fire only on STATE CHANGE out of terminal.** `match_place_competitor` UPDATEs a `bye` DESTINATION row (seats `competitor_*` + `winner_entry`, `state` stays `'bye'`) during 4.3's walkover cascade — that write MUST pass. `new.state is distinct from old.state` is the discriminator: a walkover seat leaves `state` unchanged, so it is allowed; only a *transition away from* terminal is rejected.
  - ⚠ Use a **distinct custom SQLSTATE**, never bare `P0001` (DECISION D + hand-off #2), so `lib/match/format.ts`'s `P0001 → already_locked` mapping stays unambiguous and 4.5's own lib can classify this refusal.
  - Note for the reviewer + `deferred-work.md`: like 0013's competitor-write item (`deferred-work.md:136`), this guard binds the *flip* but Story 4.7 (rollback / un-advance) will need an audited-override seam to legitimately leave a terminal state; flag, do not build it now.

### Task 2 — `begin_match_grace` + `resume_match`: the AwaitingGrace transitions (same migration 0015) (AC: 2)
- [x] **`begin_match_grace(p_match_id bigint, p_actor_steamid64 text) returns jsonb`** — `declared → awaiting_grace`, stamp `awaiting_grace_since = now()`. Typed refusals RETURNED (0012 convention), every guard before the write:
  - `bad_match` — no such match.
  - `not_startable` — match is not `declared` (already awaiting_grace / a played/terminal state). Idempotency: a re-call on an already-`awaiting_grace` match is a typed refusal, never a silent re-stamp (re-stamping would reset the clock — a foot-gun). *Decide:* either refuse `already_awaiting`, or make it idempotent by NOT re-stamping; recommend refuse.
  - both competitors must be seated (`competitor_a is not null and competitor_b is not null`) — a grace timer is for a determined matchup with one absentee, not an unfilled slot (that shape is a structural `bye`). Refusal `not_ready`.
  - **~~UN-AUDITED (DECISION E)~~ → AUDITED (DECISION E OVERRULED at code review 2026-07-15).** Originally un-audited on the reasoning that `begin_match_grace` is reversible and not in AD-17's enumerated action set, with only the forfeit logged (FR-9 "logged who/when"). Flagged for review — and **overruled by Cuatro**: the grace clock is the countdown to a forfeit, so who started it is logged. Writes a `begin_grace` audit row (actor + `awaiting_grace_since` + the `grace_period_seconds` live at start). No migration needed: `audit_log.action` is uncapped `text` with NO CHECK (0003:25 is a documentation comment, not a constraint), so `begin_grace`/`resume_match` simply extend that vocabulary.
- [x] **`resume_match(p_match_id bigint, p_actor_steamid64 text) returns jsonb`** — `awaiting_grace → declared` (DECISION C: back to the pre-grace state, NOT `live` — 4.5 does not claim `declared → live`). Clear `awaiting_grace_since = null`. Refusals: `bad_match`, `not_awaiting` (state is not `awaiting_grace`). **AUDITED (DECISION E overruled at code review)** — writes a `resume_match` audit row carrying the `grace_started_at` the UPDATE cleared, so `(grace_started_at, occurred_at)` bounds the whole no-show episode.
- [x] Both are `security invoker`, `set search_path = ''`, service-role-only EXECUTE (revoke public, grant service_role) — mirror 0012:480-487.

### Task 3 — `mark_walkover`: the forfeit (same migration 0015) (AC: 1, 2, 3)
- [x] **`mark_walkover(p_match_id bigint, p_actor_steamid64 text, p_winner_entry bigint) returns jsonb`** — `awaiting_grace → forfeit`; seat the present player as winner; advance; audit; broadcast (via `advance_match`). `security invoker`, `set search_path = ''`.
- [x] **Guards, every one before any write (0012 convention), typed refusals RETURNED except the advance-failure RAISE (below):**
  - `bad_match` — no such match.
  - `not_awaiting` — state is not `awaiting_grace` (you may only forfeit a match on the grace clock — this is what makes the timer un-bypassable; a `declared` match must go through `begin_match_grace` first).
  - **the grace GATE (AC2):** `if now() < m.awaiting_grace_since + (t.grace_period_seconds || ' seconds')::interval then return {ok:false, reason:'grace_active', grace_ends_at: …}`. This is the "only after the grace timer elapses" teeth — server-side, reading the tournament's configured period. Join `tournament` for `grace_period_seconds`.
  - `bad_winner` — `p_winner_entry` must be one of this match's two seated competitors (the PRESENT player). The loser (absent player) is the OTHER competitor, computed the same way `advance_match` does.
- [x] **The write, then the advance, then the audit — order is load-bearing:**
  1. `update match set state='forfeit', winner_entry=p_winner_entry where id=p_match_id`. (`match_terminal_state_guard` allows `awaiting_grace → forfeit`; it only blocks leaving a terminal state. `match_winner_is_competitor` (0010:94-98) requires the winner already be a competitor — it is, both seats are filled.)
  2. **`v_adv := public.advance_match(p_match_id, p_actor_steamid64);`** — routes the present winner forward and drops the absent loser (D2), and emits the `bracket.advanced` broadcast (AD-11 single emitter — do NOT add a second `realtime.send`).
  3. **⭐ HONOR `{ok:false}` — THE 4.3 HAND-OFF (#1):** `if not coalesce((v_adv->>'ok')::boolean, false) then raise exception '…forfeit advance refused: %', v_adv->>'reason' using errcode='<DISTINCT SQLSTATE>'; end if;` — a refused advance (e.g. `slot_taken`) RAISES, rolling the whole forfeit back. A forfeit that did not advance must not commit. The lib maps this SQLSTATE to a typed `advance_refused` (409/500 — decide).
  4. **the audit row (AD-17, FR-9 "logged who + when"):** `insert into audit_log (tournament_id, actor_steamid64, action, target_match_id, detail) values (…, 'mark_walkover', p_match_id, jsonb_build_object('winner_entry', p_winner_entry, 'forfeiting_entry', v_loser, 'grace_started_at', m.awaiting_grace_since, 'grace_period_seconds', t.grace_period_seconds))`. `occurred_at` (the "when") defaults to `now()`. Note a forfeit therefore writes **TWO** audit rows — `mark_walkover` (this) + `advance` (from `advance_match`) — two distinct admin consequences; assert both.
- [x] Return `{ok:true, forfeiting_entry, winner_entry, advanced: v_adv->'advanced', champion: v_adv->'champion'}`.
- [x] Service-role-only EXECUTE grant (revoke public, grant service_role).

### Task 4 — lib wrapper `lib/match/walkover.ts` (AC: 1, 2)
- [x] New `lib/match/walkover.ts` (mirror `lib/match/format.ts`): `import 'server-only'`. Export `beginMatchGrace`, `resumeMatch`, `markWalkover` — each validates shape, calls `admin.rpc(...)`, and classifies the reply against a `Set` of the RPC's typed reasons, with a distinct-SQLSTATE branch mapping the terminal-guard / advance-refused raises to typed reasons (NOT `write_failed`, NOT a swallowed 500). Typed result unions per function (`{ok:true,…} | {ok:false, reason}`), same as `FormatCommandResult`.
  - Map the DISTINCT SQLSTATE (DECISION D) → `terminal` / `advance_refused` typed reasons. Do NOT map `P0001` (that stays format.ts's).
  - Fail closed: an unrecognised RPC reason → `write_failed` (the format.ts precedent, `:161-168`).
- [x] Vitest `lib/match/walkover.test.ts`: mock the `admin.rpc` seam; assert each function's payload shape (`p_*` names), each typed reason maps through, the distinct-SQLSTATE branch classifies, and an unknown reason fails closed. Mirror `lib/match/format.test.ts` structure.

### Task 5 — routes under `app/api/admin/match/` (AC: 2)
- [x] **`app/api/admin/match/walkover/route.ts`** — `POST` = mark W.O. Mirror `app/api/admin/match/format/route.ts`: `runtime='nodejs'`, `dynamic='force-dynamic'`, `requireAdmin`, `parseBody` (`{ match_id, winner_entry }`, both `isPositiveInt`), `STATUS_FOR` map (`bad_match:404`, `not_awaiting:409`, `grace_active:409`, `bad_winner:422`, `terminal:409`, `advance_refused:409`, `write_failed:500`). Actor = `gate.steamid64`. JSON reply, no i18n (Epic 5 owns Spanish; the precedent is registration/format routes).
- [x] **`app/api/admin/match/grace/route.ts`** — `POST` = begin grace (`{ match_id }`), `DELETE` = resume (`{ match_id }`). Or two routes; **route shape is a minor decision (DECISION F)** — collapse or split as you prefer, but keep them thin and `requireAdmin`-gated.
- [x] CSRF is deferred to Epic 7 uniformly (the standing note in every admin route); the unbounded-integer `isPositiveInt` guard is already correct — reuse it, do not re-derive.

### Task 6 — pgTAP: new `0015` suite (AC: 1, 2, 3) — with EXACT `plan(N)`
- [x] **New `supabase/tests/0015_walkover_grace_test.sql`.** Fixtures need a real `player` for the audit FK (`audit_log.actor_steamid64 → player`, NOT NULL, 0003:24) and a small bracket (reuse the `0013`/`0014` fixture idiom — a generated bracket or a hand-built determined matchup with both seats filled). Cover, with EXACT plan accounting:
  - **AC2 grace GATE (the flagship):** `begin_match_grace` → `awaiting_grace` + `awaiting_grace_since` stamped; `mark_walkover` BEFORE the period elapses → `{ok:false, reason:'grace_active'}` and the match is UNCHANGED (still `awaiting_grace`, no advance, no audit); then set `awaiting_grace_since` back in time (or set `grace_period_seconds` small) so the period has elapsed → `mark_walkover` succeeds → `state='forfeit'`, `winner_entry` = present, the winner ADVANCED (assert the destination seat now holds the winner), and TWO audit rows exist (`mark_walkover` + `advance`), the `mark_walkover` row carrying `forfeiting_entry` + `winner_entry` + `occurred_at`.
  - **AC3 terminal guard (the teeth):** `throws_ok` that `update match set state='resolved' where <a forfeit row>` is REFUSED with the DISTINCT SQLSTATE; likewise for a `bye` and a `void` row; and `lives_ok` that `match_place_competitor` seating a `bye` destination (state stays `bye`) is ALLOWED. Prove "Resolved and Forfeit cannot coexist."
  - **AC1 zero-stats:** assert that after a forfeit/bye there is NO `stat_row` for that match (`select is empty`), and that the guard makes a flip to a stats-bearing state impossible. (The full "a late demo is archived but doesn't flip" round-trip needs 4.6's demo→match binding; 4.5 proves the invariant the binding will hit — the terminal guard — and that no stat path exists.)
  - **`begin_match_grace` guards:** `not_startable` on a non-`declared` match; `not_ready` when a seat is empty; **`resume_match`** returns `awaiting_grace → declared` and clears `awaiting_grace_since`.
  - **⭐ THE {ok:false} ROLLBACK (hand-off #1):** construct a forfeit whose winner's destination seat is already held by a DIFFERENT player (so `advance_match` returns `slot_taken`), call `mark_walkover`, and assert it RAISES (the DISTINCT SQLSTATE) AND the source match is STILL `awaiting_grace` with no `winner_entry` and no audit rows — the forfeit rolled back entirely. This is the single most important assertion in the suite.
  - **`bad_winner`:** a `p_winner_entry` that is not a competitor of the match → refused.
- [x] **⭐ MUTATION-TEST the suite (the standing 4.1/4.2/4.3 lesson — each found "the suite proved less than it claimed"):**
  - Neuter the grace gate (`if false and now() < …`) → the "forfeit before elapse is refused" assertion MUST go RED.
  - Neuter the terminal guard (`if false and old.state in …`) → the "forfeit cannot be flipped to resolved" `throws_ok` MUST go RED.
  - Change the `{ok:false}` RAISE to a swallow (proceed) → the rollback assertion MUST go RED (a partial forfeit would commit).
  A green suite after any mutation is a blind suite — fix the test, not the mutation.

### Task 7 — Regression sweep (AC: all)
- [x] Run the FULL pgTAP suite (`supabase test db`). The new `match_terminal_state_guard` fires on every `match` UPDATE — confirm it does NOT break 0011/0013/0014's advance/walkover drives (they seat bye destinations with `state` unchanged) or 0010/0012's fixtures. If any suite UPDATEs a bye/void/forfeit row's `state` as a fixture shortcut, that fixture is now (correctly) refused — fix the FIXTURE to build the intended state via INSERT or a legal transition, never by weakening the guard (the exact 4.3 lesson). Keep every `plan(N)` exact and accounted.
- [x] `npx vitest run` (new walkover tests + everything green), `npm run lint`, `npm run build` all 0. Worker `go build ./... && go vet ./...` clean — re-confirm BY GREP (not assumed, per 4.3) that `worker/` touches no `match`/forfeit/grace surface: `grep -riE 'awaiting_grace|mark_walkover|grace_period|forfeit|(from|into|update)\s+match' worker/` → 0.

### Task 8 — THE BAR: live-QA a real forfeit over the production seam (AC: 1, 2, 3)
- [x] Re-apply `supabase/fixtures/live-qa-bracket-seed.sql` after `supabase db reset` (standing Live-QA fixture; see the memory note). Drive a real 8-16-player bracket over the **supabase-js → PostgREST → RPC** seam (not just in-DB):
  1. `begin_match_grace` a determined matchup → `awaiting_grace`, clock stamped.
  2. `mark_walkover` BEFORE the (small, configured) grace period → typed `grace_active` refusal, match unchanged.
  3. After the period → `mark_walkover` succeeds: `forfeit`, present player advanced into the next round, absent player dropped to Losers (Winners no-show) or eliminated (Losers no-show), two audit rows, and a real ANON WebSocket subscriber receives the `bracket.advanced` broadcast.
  4. **AC3 live:** attempt to flip the forfeited match to a played state as `service_role` over the seam → REFUSED (the terminal guard). Confirm no `stat_row` exists for it.
  5. `resume_match` on a separate `awaiting_grace` match → back to `declared`, clock cleared.
- [x] Prove the rollback contract live if feasible: engineer a `slot_taken` and confirm `mark_walkover` leaves the match `awaiting_grace` (or accept the pgTAP proof if the live setup is impractical — the seam itself is proven by the succeeding paths, since the RPC signatures are what cross it).

---

## DECISIONS (made in-story; overrule at review — the 4.1/4.2/4.3/4.4 pattern)

**DECISION A — grace config lives on `tournament.grace_period_seconds` (default 600).** RECOMMENDED. FR-9 says "Admin-configurable"; SPINE:471 lists the grace timer under "organizer/content config … tournament config." A per-tournament column is the minimal home that satisfies "configurable" without a migration per change (the format catalog's lib-file approach doesn't fit — grace is a scalar the RPC reads, not a vocabulary the route validates). *Alternative:* a hardcoded constant — reject (violates "configurable"); a per-match column — reject (over-modeled for a casual event; nothing needs per-match grace).

**DECISION B — the grace clock is `match.awaiting_grace_since` + a live read of `tournament.grace_period_seconds`.** RECOMMENDED. Stamp the start when entering `awaiting_grace`; compute the deadline at `mark_walkover` time (`now() >= awaiting_grace_since + period`). The elapsed check is server-side and un-bypassable. *Alternative:* freeze a `grace_ends_at` on the match at `begin_match_grace` (immune to a mid-grace config change) — a reasonable robustness upgrade, but for a single casual event the live read is simpler; flag.

**DECISION C — `resume_match` returns `awaiting_grace → declared`, NOT `→ live`.** RECOMMENDED. The UX ("the absent player arrives → the match proceeds normally", EXPERIENCE:243) is satisfied by returning the match to its well-defined pre-grace `declared` state; the normal `Declared → Live → Pending → Resolved` path is owned by 4.6 / Epic-5. Going to `live` would make 4.5 claim the still-unowned `declared → live` transition (4.2 flagged it) AND inherit the `23514 → "declare the format first"` mapping obligation (`deferred-work.md:128`) — scope 4.5 deliberately declines. Flag so a reviewer sees the boundary is intentional.

**DECISION D — 4.5's trigger + RPC raises use a DISTINCT custom SQLSTATE, never bare `P0001`.** RECOMMENDED (essentially forced by `deferred-work.md:127`). `lib/match/format.ts` maps *any* `P0001` from its RPC to `already_locked`; a second `match` trigger raising `P0001` is the ambiguity that item predicted. Use a documented custom SQLSTATE (e.g. class-`IC` code such as `'IC901'` for the terminal guard and `'IC902'` for the advance-refused raise — pick and pin them in the migration + lib). Keeps format.ts correct and lets 4.5's lib classify precisely. *Alternative:* match on the error message — reject (brittle).

**DECISION E — `begin_match_grace` and `resume_match` are UN-AUDITED; only `mark_walkover` writes an `audit_log` row.** RECOMMENDED. AD-17's enumerated set (SPINE:163) is "generate bracket, advance, mark W.O., approve, re-parse, rollback, declare format, start ceremony, grant role" — grace-start/resume are NOT in it, and FR-9 requires logging the FORFEIT specifically ("logged with who forfeited and when"). Both are reversible, non-result transitions. *Alternative:* audit them too (a new `begin_grace` action string — free, `action` is uncapped) — a defensible belt-and-braces; flag.

**DECISION F — forfeit is a NORMAL double-elim loss; the absent player drops via the standard loser edge.** RECOMMENDED. `mark_walkover` seats the present player as winner and lets `advance_match` route both uniformly — the Winners no-show still gets their Losers-bracket life, a Losers no-show is eliminated (the two-loss rule, derived from edges). This requires ZERO change to `advance_match` and matches "the present player advances" without special-casing the routing. *Alternative:* forfeit = immediate elimination (suppress the loser drop) — reject: it special-cases routing, diverges from double-elim, and contradicts the uniform-edge design. Also OUT OF SCOPE: a **double no-show** (both absent) — the AC covers "one player absent"; flag double-forfeit/void-a-match as unhandled (a future story or an admin manual-resolve).

---

## Dev Notes

### Architecture constraints (cited)
- **AD-9** (`ARCHITECTURE-SPINE.md:120-123`): "Forfeit and Bye transitions have **no reachable stat-write path** — only a bracket advance and a structural badge. … A Forfeit is markable only after the grace timer (default 10 min, configurable) elapses, and is logged with actor + timestamp." Binds FR-8, FR-9, FR-17.
- **AD-23** (`ARCHITECTURE-SPINE.md:190-193`): "once `Forfeit`/`Bye` is committed, a demo that later arrives … is archived for evidence (AD-1) but produces **no** `stat_row` and does not flip the match. `Resolved` (demo) and `Forfeit` (admin) cannot coexist; the `match` row is the single arbiter and its **transition guards** prevent two writers landing both." The terminal-state guard (Task 1) IS that transition guard.
- **AD-8** (`ARCHITECTURE-SPINE.md:115-118`): advance is a "consequence of a result (Aprobar / Forfeit / Bye) … never an independent button that races publish." `mark_walkover` makes advance a consequence of the forfeit — consistent. The `mark W.O.` control IS a legitimate result-entry action (EXPERIENCE:45), not an independent advance button.
- **AD-1** (`:80-83`): the raw demo is retained write-once regardless of match state — so the "archived for evidence" half of AC3 is ALREADY delivered by demo retention (Stories 3.1/3.2); 4.5 only adds the "never flips" half.
- **Match lifecycle** (`ARCHITECTURE-SPINE.md:299-317`): `Declared → AwaitingGrace` (one absent) · `AwaitingGrace → Forfeit` (grace elapsed + W.O.) · `AwaitingGrace → Live` (absent arrives — implemented as `→ Declared`, DECISION C) · `Bye → [*]` / `Forfeit → [*]` (terminal). `Declared → Live` remains UNOWNED (4.6 / Epic-5).
- **FR-8/FR-9/FR-17** (`prd.md:192-207`, epics.md:917): bye advances with a badge, no stats; forfeit only after the grace timer, logs who/when; forfeits contribute zero rows so leaderboards normalize by construction (the leaderboard normalization itself is Epic 5 / AD-20 — 4.5 only guarantees the zero rows).
- **UX** (`EXPERIENCE.md:67-69,98-100,113-115,237-243`): `{components.grace-timer}` renders `MM:SS` ("Ausente — W.O. en MM:SS") from the server clock, loss-red near threshold; `{components.bye-badge}` "Pase directo" (neutral, never a win); `{components.forfeit-badge}` "W.O. / Ausente" + "sin estadísticas". **All UI is Epic 5** — 4.5 produces only the correct DATA (state + winner_entry + the audit "who/when" + the `awaiting_grace_since` the countdown reads).

### Current-state facts you must preserve (regressions to avoid)
- **`advance_match` is TWO-PASS and RETURNS typed refusals** (`0013:537-542`). `mark_walkover` calls it and MUST RAISE on `{ok:false}` to roll the forfeit back (hand-off #1 / DECISION D's second code). Do NOT change `advance_match` to raise — 4.6 relies on the RETURN semantics.
- **`match_place_competitor` seats a `bye` walkover in ONE statement** (`0013:475-497`, `p_walkover => true` sets `winner_entry` alongside the seat) — because `match_winner_is_competitor` (0010:94-98) requires the winner already be a competitor. Your terminal guard must NOT block this (state stays `bye`).
- **The emit gate + single broadcaster.** `advance_match` emits `bracket.advanced` post-commit-by-construction (`0014:632-646`). `mark_walkover` relies on THAT emit (AD-11: "ONE Broadcast carries the semantic change"). Do NOT add a second `realtime.send`.
- **`match_live_requires_locked_format` deliberately excludes `awaiting_grace`/`forfeit`/`bye`/`void`** (`0012:117-126`). Do NOT touch that CHECK; the forfeit path is already unblocked.
- **`match` has NO DELETE grant** (`0010:227`); a terminal row is never removed, only structurally terminal. `void`/`bye`/`forfeit` are end states.
- **`audit_log.actor_steamid64` is NOT NULL with an FK to `player`** (`0003:24`) — fixtures + the route's `gate.steamid64` must be a real player.

### Migration hygiene
- Next migration slot is **`0015_walkover_grace.sql`**; test **`supabase/tests/0015_walkover_grace_test.sql`**.
- `audit_log.action = 'mark_walkover'` is already enumerated (`0003:25`) — NO migration for the action string, same as `advance`/`declare_format`.
- The three new RPCs are NEW functions (not `create or replace`) — issue their `revoke … from public; grant … to service_role;` EXECUTE grants explicitly (0012:480-487 pattern). The trigger function needs no grant (a `returns trigger` function is not callable normally and PostgREST does not expose it — 0012:248-251).
- ⚠ Unlike 0013, 0015 adds columns with **defaults/nullable** and a trigger that fires only on state-change-out-of-terminal — so it applies cleanly to a DB that already holds a bracket (no 0013-style backfill trap). State this in the header.

### Scope boundaries (do NOT do these here)
- **No `declared → live` / `live` / `pending` transitions** (still unowned; 4.6 / Epic-5). `resume_match` goes to `declared` (DECISION C). No `23514` mapping obligation is incurred.
- **No Aprobar / demo-derived score / demo→match binding** (Story 4.6) — the "a late demo binds and is refused" round-trip is 4.6's; 4.5 installs + proves the guard the binding will hit.
- **No rollback / un-advance** (Story 4.7). The terminal guard needs a 4.7 audited-override seam to legitimately leave a terminal state — flag, do not build (same shape as the `deferred-work.md:136` competitor-write item).
- **No manual score** (4.8), **no shared command-route helper** (4.9 — it will de-dup the route boilerplate + centralize SQLSTATE mapping, incl. `advance_match`'s five bare `P0001`s), **no CSRF** (Epic 7).
- **No UI / i18n / realtime viewer / leaderboard normalization** (Epic 5). The badges (`Pase directo` / `W.O. — sin estadísticas`) and the `MM:SS` countdown are Epic-5 renders of 4.5's data.
- **No changes to `advance_match` / `generate_bracket`** — 4.5 CALLS `advance_match` unchanged; the forfeit is a normal loss (DECISION F).

### Project Structure Notes
- DB mechanism: `supabase/migrations/0015_walkover_grace.sql` (+ `supabase/tests/0015_walkover_grace_test.sql` pgTAP).
- Lib: `lib/match/walkover.ts` (+ `lib/match/walkover.test.ts` Vitest) — mirror `lib/match/format.ts`.
- Routes: `app/api/admin/match/walkover/route.ts` + `app/api/admin/match/grace/route.ts` — mirror `app/api/admin/match/format/route.ts`.
- Schema adds exactly TWO columns (`tournament.grace_period_seconds`, `match.awaiting_grace_since`) + one trigger + three RPCs. No new tables, no enum change.

### Testing standards
- **pgTAP** with EXACT `plan(N)` accounting (standing convention since Epic 1).
- **Mutation-test your own suite** (the explicit lesson of the 4.1/4.2/4.3 reviews): neuter the grace gate, the terminal guard, and the `{ok:false}` RAISE — each must turn a test RED. A green suite after mutation is blind.
- Gates to keep green: pgTAP (currently 625), Vitest (currently 212), `lint 0`, `build 0`, worker `go build`/`vet` clean (confirm by grep the worker never touches `match`).
- **THE BAR (Task 8):** a real forfeit driven over the live seam — grace refusal before elapse, forfeit + advance after, the terminal guard refusing a flip live, the broadcast received, and (pgTAP-or-live) the `{ok:false}` rollback proven.

### References
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#AD-9] (`:120-123`); AD-23 (`:190-193`); AD-8 (`:115-118`); AD-1 (`:80-83`); AD-11 (`:130-133`); Match lifecycle (`:299-317`); audit action set (`:163`); grace-timer as config (`:471`)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#7] (`:352-366` Bracket & match — Bye/Forfeit precedence); match table (`:110-139`); audit_log action list (`:251`)
- [Source: _bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#FR-8] (`:192-198`); FR-9 (`:200-207`); FR-17 (leaderboard normalization)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md] grace-timer/bye/forfeit components (`:67-69,98-100,113-115`); the no-show journey (`:237-243`); admin `mark W.O.` (`:45`)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.5] (`:718-739`)
- [Source: supabase/migrations/0010_match.sql] state enum incl. awaiting_grace/forfeit/bye/void (`:64-65`); `match_winner_is_competitor` (`:94-98`); grants no-DELETE (`:227`)
- [Source: supabase/migrations/0012_format_lock.sql] the CONSTRAINT-TRIGGER + audited-RPC pattern to mirror (`:138-156,191-239,268-487`); `match_live_requires_locked_format` excludes forfeit/bye (`:117-126`)
- [Source: supabase/migrations/0013_advance.sql] `advance_match` two-pass + RETURN-not-raise (`:537-542,731-735`); `match_place_competitor` (`:447-509`); the five bare P0001 raises (`deferred-work.md:139`)
- [Source: supabase/migrations/0014_grand_final_reset.sql] `advance_match` result gate + loser drop (`:417-430`) — forfeit is advanceable, loser dropped uniformly
- [Source: lib/match/format.ts] the lib wrapper shape (`:122-185`); the `P0001` ambiguity note (`:102-106`)
- [Source: app/api/admin/match/format/route.ts] the route shape + `isPositiveInt`/`STATUS_FOR` (`:33-142`)
- [Source: lib/bracket/generate.ts] bye seating + pre-advance (`:485-501`); Losers walkover-state derivation (`:527-557`)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] hand-offs to 4.5 — `{ok:false}` caller rollback (`:137`), P0001 ambiguity (`:127`), declared→live/23514 (`:128`), advance_match's bare P0001s (`:139`)
- [Source: supabase/migrations/0003_audit_snapshot.sql] audit_log shape + actor FK (`:20-30`)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow) — 2026-07-15.

### Debug Log References

- `supabase db reset` → all 15 migrations apply clean, incl. `0015_walkover_grace.sql` (the note held: nullable/defaulted columns + a trigger that fires only on state-change-out-of-terminal apply cleanly to a DB already holding a bracket).
- `supabase test db` → **657 pgTAP** pass (was 625; +32 from `0015`, 0012 unchanged at 78 — see the regression note below).
- Mutation test (the mandate), applied in-DB via `create or replace` then re-run of `0015`:
  - neuter the terminal guard (`if false and old.state in …`) → tests **24–26 RED**.
  - neuter the grace gate (`if false and now() < v_deadline`) → tests **6, 7 RED** (+ cascade 8, 9 — the source got forfeited early).
  - swallow the `{ok:false}` RAISE (`if false and not coalesce…`) → tests **29–32 RED** (a partial forfeit would commit).
  - A green suite after any mutation would be blind; each turned RED. Baseline restored via `db reset`.
- `npx vitest run` → **233** pass (was 212; +21 from `lib/match/walkover.test.ts`). `npm run lint` → **0**. `npm run build` → **0** (both new routes registered: `/api/admin/match/grace`, `/api/admin/match/walkover`). Worker `go build ./... && go vet ./...` → **0**; grep of `worker/` for `awaiting_grace|mark_walkover|grace_period|forfeit|(from|into|update)\s+match` → **0 hits** (the worker never touches the forfeit/grace surface — confirmed, not assumed).

### Completion Notes List

**AC1 (zero-stats bye/forfeit).** The BYE half already ships (4.1 seats + pre-advances Winners-R1 byes; 4.3's cascade walks Losers byes; `advance_match` accepts `state='bye'`) — proven, not rebuilt. The FORFEIT half: `mark_walkover` seats the present player as winner and `state='forfeit'`, and there is no reachable stat-write path (stats come only from the worker's demo parse; a forfeit has no demo). pgTAP asserts zero `stat_row` after a forfeit; live-QA re-confirmed zero `stat_row` for the forfeited match over the seam.

**AC2 (grace timer).** `begin_match_grace` (`declared → awaiting_grace`, stamps `match.awaiting_grace_since = now()`); `mark_walkover`'s server-side gate `now() >= awaiting_grace_since + make_interval(secs => tournament.grace_period_seconds)` refuses `grace_active` before the period elapses and writes nothing; after it elapses the forfeit is logged with actor + timestamp (`action='mark_walkover'`, `occurred_at`, `winner_entry`/`forfeiting_entry`). Config lives on `tournament.grace_period_seconds` (default 600). All proven live.

**AC3 (single-writer precedence).** `match_terminal_state_guard` (BEFORE UPDATE, `IC901`) rejects any UPDATE that changes `state` OUT of `bye`/`forfeit`/`void`, so a later demo/Aprobar cannot flip a committed forfeit/bye — "Resolved and Forfeit cannot coexist" holds by construction. It fires ONLY on a state change out of terminal, so 4.3's walkover-seating of a `bye` destination (state unchanged) still passes (pgTAP `lives_ok` + live-QA both confirm). The "archived for evidence" half of AC3 is already delivered by demo retention (AD-1, Stories 3.1/3.2); 4.5 adds the "never flips" half.

**⭐ THE LOAD-BEARING HAND-OFF (deferred-work.md:137).** `mark_walkover` writes the forfeit then calls `advance_match` UNCHANGED (forfeit = a normal double-elim loss, DECISION F); a returned `{ok:false}` (e.g. `slot_taken`) RAISES `IC902` and rolls the WHOLE forfeit back. Proven in pgTAP (Section G, mutation-verified) AND live over the seam (a pre-occupied destination seat → `IC902`, source left `awaiting_grace` with no winner and no audit rows).

**DECISION D (distinct SQLSTATEs).** `IC901` (terminal guard) / `IC902` (advance-refused rollback), never bare `P0001` — so `lib/match/format.ts`'s `P0001 → already_locked` mapping stays unambiguous, and `lib/match/walkover.ts` classifies these as typed `terminal` / `advance_refused`. A Vitest pins that a bare `P0001` is NOT hijacked here (fails closed).

**Correctness point beyond the story prose — lock order.** `mark_walkover` takes the SAME ordered whole-bracket `FOR UPDATE` that `advance_match` takes, UP FRONT, before its first write. Writing the source row before calling `advance_match` would otherwise lock it out of canonical id order and could deadlock a concurrent advance (the exact 4.3 deadlock). `begin_match_grace`/`resume_match` take only a single-row lock and wait for nothing else, so they cannot form a cycle.

**KNOWN REGRESSION — fixed the FIXTURE, never the guard.** The new terminal guard turned `0012_format_lock_test.sql` tests 14–16 RED: they cycled ONE match `declared→bye→void→forfeit→awaiting_grace`, and `bye→void` is now (correctly) refused. Fixed by giving each of the four never-played exclusion states its own fresh `declared` row (TFMT slots 9/10/11 added); `0012` plan stays 78. No `advance_match`/`generate_bracket`/format-CHECK changes.

**THE BAR (Task 8) — MET over supabase-js → PostgREST → RPC.** Drove a real 11-player bracket (31 rows, 5 byes): `begin_match_grace` → `awaiting_grace` + clock; `mark_walkover` before elapse → typed `grace_active`, match unchanged; after backdating the clock → `forfeit`, the present player advanced into the `winner_to` seat, the absent player dropped into the `loser_to` seat (and, being a Winners-R1 forfeit whose loser fell into a Losers **bye** node, `advanced=3` — the drop correctly cascaded through the bye, integrating with 4.3's D3), TWO audit rows; the committed forfeit could NOT be flipped to `resolved` (`IC901`); zero `stat_row`; `resume_match` returned a separate match to `declared` with the clock cleared; and the `{ok:false}` rollback raised `IC902` live with the source untouched. The forfeit emitted exactly ONE `bracket.advanced` message (verified in `realtime.messages`: topic `tournament:1`, `match_id`/`winner_entry`/`loser_entry` correct — AD-11's single emitter, unchanged from 4.3), and the DB→anon-WebSocket relay was proven to deliver in this stack (an isolated `realtime.send` probe was received by a real anon socket). No new emitter was added.

**DECISIONS A–F** stand as recommended (overrule at review): A grace config on `tournament.grace_period_seconds`/600; B live-read grace clock; C `resume_match → declared` (4.5 deliberately does NOT claim the unowned `declared → live` nor the 23514 map); D distinct SQLSTATEs; E `begin_match_grace`/`resume_match` un-audited (only the forfeit is logged, FR-9); F forfeit = normal double-elim loss. Flagged out-of-scope: a DOUBLE no-show (both absent) is UNHANDLED (the AC covers "one player absent"); the terminal guard will need a 4.7 audited-override seam to legitimately leave a terminal state (same shape as deferred-work.md:136).

### File List

- `supabase/migrations/0015_walkover_grace.sql` — NEW. `tournament.grace_period_seconds` + `match.awaiting_grace_since` columns; `match_terminal_state_guard` (BEFORE UPDATE, IC901); `begin_match_grace`, `resume_match`, `mark_walkover` RPCs + service-role EXECUTE grants.
- `supabase/tests/0015_walkover_grace_test.sql` — NEW. pgTAP plan(32): grace gate, forfeit+advance+audit, zero-stats, terminal guard, resume, and the ⭐⭐ {ok:false} rollback. Mutation-verified.
- `lib/match/walkover.ts` — NEW. `beginMatchGrace` / `resumeMatch` / `markWalkover` wrappers (mirror `lib/match/format.ts`); IC901→`terminal`, IC902→`advance_refused`; fail-closed on unknown reasons.
- `lib/match/walkover.test.ts` — NEW. Vitest (21): payload shapes, every typed reason, the distinct-SQLSTATE branches, P0001 NOT hijacked, fail-closed.
- `app/api/admin/match/walkover/route.ts` — NEW. `POST` = mark W.O. (mirror the format route; `STATUS_FOR` map).
- `app/api/admin/match/grace/route.ts` — NEW. `POST` = begin grace, `DELETE` = resume (DECISION F: one route, two verbs).
- `supabase/tests/0012_format_lock_test.sql` — MODIFIED. Fixture fix for the terminal-guard regression: TFMT slots 9/10/11 added so each never-played exclusion state uses a fresh `declared` row (plan unchanged at 78).

### Review Findings

_Code review 2026-07-15 (bmad-code-review, baseline e9d93f7). Three parallel adversarial layers — Blind Hunter, Edge Case Hunter, Acceptance Auditor (all Opus 4.8). **Zero Critical/High findings from any layer.** All four named prior-review hand-offs (the ⭐ {ok:false}→IC902 rollback, distinct SQLSTATEs, terminal guard, format.ts non-collision) verified TRUE against the real `advance_match`/`match_place_competitor`/`format.ts` contracts; AC1–AC3 substantively satisfied; the three mandated mutations confirmed to redden. 1 decision-needed, 1 patch, 5 deferred, 4 dismissed._

**Decision-needed (RESOLVED 2026-07-15 → patch → APPLIED):**

- [x] [Review][Decision→Patch] Audit `begin_match_grace` / `resume_match` (DECISION E OVERRULED at review) — both RPCs accept `p_actor_steamid64` and discard it; only the forfeit writes an audit row, so there is no trail of who paused/resumed a match's grace clock (flagged independently by Blind Hunter + Acceptance Auditor). **Cuatro's call: DECISION E overruled — add audit rows.** Add a `begin_grace` + a `resume`/`resume_match` `audit_log` INSERT to both RPCs (actor = `p_actor_steamid64`, `target_match_id = p_match_id`; `action` is uncapped text so no migration to the vocabulary is required), plus pgTAP coverage asserting each row. Update DECISION E in the story to reflect the overrule.

**Patch (BOTH APPLIED 2026-07-15 — gates re-run green: pgTAP 659 (+2) / Vitest 233 / lint 0 / build 0):**

- [x] [Review][Patch] Grace gate fail-opens if `grace_period_seconds` resolves NULL — the symmetric guard is missing [supabase/migrations/0015_walkover_grace.sql:286-296]. The adjacent `awaiting_grace_since is null` branch fails closed with the exact reasoning ("a NULL deadline would make `now() < NULL` NULL … silently opening the gate"), but the `select … into v_grace` has no NULL/not-found guard — so a NULL `v_grace` makes `v_deadline` NULL and `now() < NULL` → NULL → the grace gate silently opens. Unreachable today (`grace_period_seconds` NOT NULL DEFAULT 600; `match.tournament_id` NOT NULL FK), but the gate is the AC2 teeth and the fix is a two-line symmetric fail-closed guard matching the code beside it.
- [x] [Review][Patch] Audit `begin_match_grace` / `resume_match` (from the resolved decision above) [supabase/migrations/0015_walkover_grace.sql:134-217] — add an `audit_log` INSERT to each RPC + pgTAP assertions.

**Patch outcomes (applied + verified):**

1. **Grace-gate NULL symmetry** — `mark_walkover`'s gate now fails closed on `v_m.awaiting_grace_since is null OR v_grace is null`. ⚠ **NOT mutation-verifiable, and deliberately not claimed as covered:** `grace_period_seconds` is NOT NULL DEFAULT 600 behind a NOT NULL `tournament_id` FK, so no fixture can make `v_grace` NULL without altering the schema. This is defense-in-depth against a future schema change (e.g. a nullable per-tournament override), matching the fail-closed reasoning the adjacent `awaiting_grace_since` branch already applied. The related coverage gap stays deferred.
2. **`begin_grace` / `resume_match` audit rows** — ⭐ **MUTATION-VERIFIED, not merely green.** Removing `begin_match_grace`'s audit INSERT turns **3 tests RED** (the new Section-A assertion 3, plus B2/8 and G4/34 — the two assertions this patch rewrote); removing `resume_match`'s turns assertion **23 RED**. Both restored and re-confirmed green.
3. **Two pre-existing assertions were rewritten, and the rewrite is the interesting part.** B2 and G4 asserted `audit_all(...) = 0`, which the new `begin_grace` row correctly invalidates. Rather than delete the totals, both now pin the *specific* actions at 0 (`mark_walkover`, and `advance` for G4) **and** the total at exactly the 1 surviving `begin_grace` row — so they still catch a refusal/rollback that leaks any audit row, and they proved their own sensitivity by reddening under the mutation above. **The fixtures were fixed from real behavior; no assertion was weakened to accommodate the patch** (the 4.1/4.2/4.3 standing lesson).
4. **Vocabulary note (documentation debt, not a defect):** `0003:25`'s `action` comment lists the enumerated vocabulary and does **not** include `begin_grace`/`resume_match`. `action` carries no CHECK, so this needed no migration and nothing is broken — but that comment is now one migration stale. 0015's header records the extension; 0003 was deliberately left untouched (never edit an applied migration).

**Deferred (pre-existing / latent / out-of-scope):**

- [x] [Review][Defer] `mark_walkover` trusts the both-seats-filled invariant; a NULL competitor would yield a NULL `v_loser` and a NULL `forfeiting_entry` audit value [supabase/migrations/0015_walkover_grace.sql:302-308] — deferred, unreachable (only `begin_match_grace` enters `awaiting_grace` and it enforces both seats at :164; no unseat path exists). Cheap defense-in-depth: re-assert both seats non-NULL under the lock.
- [x] [Review][Defer] `advance_match`'s bare `P0001` raises map to `write_failed`/500, not `advance_refused`/409 [lib/match/walkover.ts:165-175] — deferred, pre-existing. Only advance's `{ok:false}` RETURN is converted to IC902; its `P0001` raise paths (dangling edge / void destination / hop-cap) fall to 500. Those are genuine bracket corruption, and `advance_match`'s five bare P0001s are Story 4.9's central-SQLSTATE-map job (deferred-work.md:139).
- [x] [Review][Defer] `resume_match` on HTTP `DELETE` requires a JSON body; a body-stripping proxy makes resume unreachable [app/api/admin/match/grace/route.ts:98-113] — deferred, low-risk (`fetch()` sends DELETE bodies; the deploy is Vercel with no exotic proxy). Revisit by moving resume to POST or `match_id` as a query param if a body-stripping hop ever appears.
- [x] [Review][Defer] `mark_walkover`'s `not_awaiting` guard has no pgTAP coverage [supabase/migrations/0015_walkover_grace.sql:278-280] — deferred, low value (the guard is trivial and `resume_match`'s identical `not_awaiting` IS tested; the grace-gate NULL fail-closed branch is likewise uncovered but unreachable). A future `plan(32→33)` bump could add a `mark_walkover`-on-`declared` → `not_awaiting` assertion.
- [x] [Review][Defer] AD-23's terminal guard is asymmetric — it blocks `forfeit→resolved` (the direction a late demo hits) but does NOT block `resolved→forfeit` by construction [supabase/migrations/0015_walkover_grace.sql:109] — deferred to Story 4.6. `resolved`/`manual_resolved` are 4.6/4.8's states; the reverse direction is held today only by `mark_walkover`'s `not_awaiting` guard, so AD-23's "cannot coexist by construction" is half-true until 4.6 lands its side.

**Dismissed (4):** (a) the `terminal`/IC901 branch in `markWalkover` is unreachable dead code — but it is intentional defense-in-depth mirroring `format.ts`'s fail-closed posture and would matter the moment a 4.7 unseat path exists; keep it. (b) AC1 zero-stats pgTAP (test 17) is blind (can never redden) — but the story honestly scopes AC1's bye/forfeit-no-stats as a *structural* proof (there is no stat-write path to exercise), not a mutation-covered one; not an overclaim. (c) test G4 (`audit_all=0`) doesn't independently prove the rollback (the audit INSERT is after the raise) — but it does redden under the documented "swallow the raise" mutation, and G2/G3 (state/`winner_entry`) carry the real proof. (d) the `0012` fixture growth (TFMT slots 9/10/11) breaking a hidden count assumption — **verified false**: every `count(*)` assertion is scoped to `TBULK` or to TFMT `declare_format` audit rows, none of which the three new format-less `declared` rows affect; plan stays 78.

### Change Log

- 2026-07-15 — Story 4.5 **code-reviewed → done** (bmad-code-review, baseline e9d93f7). Three parallel adversarial layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor, all Opus 4.8): **zero Critical/High from any layer** — 1 decision-needed + 1 patch + 5 defer + 4 dismissed. ⭐ This breaks the 4.1/4.2/4.3 pattern for the second story running: the Acceptance Auditor independently verified all four named prior-review hand-offs are TRUE against the real contracts — `mark_walkover` does call `advance_match` unchanged and RAISE IC902 on `{ok:false}` (and every advance `{ok:false}` return sits in pass 1 *before* its write boundary, so a partial forfeit genuinely cannot commit); the grace gate is server-enforced; the terminal guard binds the flip but allows the walkover seat; IC901/IC902 do not collide with format.ts's P0001. The lock-order claim was verified by direct comparison, not trusted — `mark_walkover` takes the identical canonical whole-bracket `FOR UPDATE` as `advance_match`. **DECISION E OVERRULED by Cuatro:** `begin_match_grace`/`resume_match` are now AUDITED (`begin_grace` + `resume_match` rows; `action` has no CHECK so no migration — 0003:25's vocabulary comment is now one migration stale, recorded in 0015's header). Second patch: the grace gate's `v_grace is null` half was missing, so a NULL period would have made `now() < NULL` NULL and failed the gate OPEN — unreachable today (NOT NULL DEFAULT 600 behind a NOT NULL FK) and honestly NOT claimed as mutation-covered. ⭐ The audit patch IS mutation-verified: removing `begin_match_grace`'s INSERT turns 3 tests RED, removing `resume_match`'s turns 1 RED. Two pre-existing assertions (B2/G4) asserted `audit_all = 0`, which the new rows correctly invalidate — both were rewritten to pin the specific actions at 0 AND the total at the 1 surviving row, fixing the fixtures from real behavior and weakening nothing. Gates re-run: **pgTAP 659 (+2), Vitest 233, lint 0, build 0.** 5 deferrals to deferred-work.md (NULL-loser defense-in-depth; advance_match's P0001→500 → 4.9; DELETE-body fragility; two uncovered guards; AD-23's `resolved→forfeit` asymmetry → 4.6). Live-QA NOT re-run — the RPC signatures are unchanged, but `begin_match_grace`/`resume_match` now write an audit row, which THE BAR's original run did not exercise.
- 2026-07-15 — Story 4.5 implemented (bmad-dev-story, baseline e9d93f7). Migration `0015_walkover_grace`: +2 columns (`tournament.grace_period_seconds`/600, `match.awaiting_grace_since`), the AD-23 `match_terminal_state_guard` (IC901), and 3 RPCs (`begin_match_grace`, `resume_match`, `mark_walkover`). Forfeit = a normal double-elim loss routed through `advance_match` unchanged; a returned `{ok:false}` RAISES IC902 and rolls the forfeit back (the 4.3 hand-off). Ships `lib/match/walkover.ts` (+ Vitest) and `app/api/admin/match/{walkover,grace}` routes. Fixed the `0012` terminal-guard fixture regression (fresh declared rows, never the guard). Gates: pgTAP 657 (+32), Vitest 233 (+21), lint 0, build 0, worker go build/vet 0. Mutation-tested (grace gate / terminal guard / {ok:false} RAISE each → RED). THE BAR met: a real forfeit over the supabase-js → PostgREST → RPC seam — grace refusal before elapse, forfeit + advance + drop after, terminal-guard flip refused live (IC901), zero stat_row, resume, and the {ok:false} rollback (IC902), with the correct single `bracket.advanced` message emitted and the DB→anon-WS relay proven. Status → review.
