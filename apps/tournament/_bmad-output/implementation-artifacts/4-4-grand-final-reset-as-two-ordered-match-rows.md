---
baseline_commit: eac5f5124c15da8c2be8637b1f5e817f34f5254a
---

# Story 4.4: Grand-final reset as two ordered match rows

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want the grand final modeled as up to two ordered match rows,
so that a losers-bracket player can force a reset without the champion slot ever being overwritten in place.

## Acceptance Criteria

**AC1 — up to two ordered GF rows (AD-21, FR-6).**
**Given** the GF-reset rule, **When** the grand final is created, **Then** it is up to two ordered `match` rows (`gf_order` 1 then 2).

**AC2 — the reset crowns from the last row, never overwritten in place (AD-21).**
**Given** the losers-bracket player wins the first GF row, **When** the reset row is played, **Then** the champion is whoever resolves the *last* GF row and the champion slot is never overwritten in place.

**AC3 — AD-8 conditional advance applies per row (AD-8).**
**Given** the conditional-advance rule, **When** each GF row resolves, **Then** AD-8 conditional advance applies per row.

_Traces: FR-6 · AD-21 (with AD-8, AD-13)_

---

## THE ONE-PARAGRAPH HEADLINE

The whole bracket already ships **except the reset row**. `match` already carries `gf_order` (allowed `in (1,2)`), the slot-unique index already keeps `gf_order=1` and `gf_order=2` distinct (`coalesce(gf_order,0)`), and Story 4.3's `advance_match` already crowns a champion at the terminal edgeless grand-final row. Story 4.3 shipped **exactly one** GF row (`gf_order=1`, both edges NULL, terminal) in TypeScript generation, in the SQL skeleton-count, and in every fixture — and left four things to this story, **flagged by name in the code you are about to edit**. This story adds the second GF row and the ONE conditional in double-elimination: **side A of the GF is always the Winners-bracket champion (0 losses); if they win game 1 they are champion outright and there is no reset. Side B is the Losers-bracket survivor (1 loss); only THEIR win forces the reset (`gf_order=2`), because it hands the WB champion their first loss.** The champion is the winner of the *last* GF row played — `gf_order=1` when side A wins, `gf_order=2` when the reset is played. Two separate rows means the champion slot is a *different column on a different row* in the two games, so it is never overwritten in place — that is the entire point of AD-21.

---

## Developer Context — READ THIS BEFORE YOU TOUCH ANYTHING

### The four hand-offs Story 4.3 left you, verbatim, in the files you will edit

1. **`supabase/migrations/0013_advance.sql:149-151`** — on `match_routing_complete`:
   > "⚠ STORY 4.4 MUST WIDEN THE grand_final ARM. The AD-21 reset row (gf_order=2) means the gf_order=1 row gains a CONDITIONAL winner edge (-> the reset, iff the LB survivor won it). When 4.4's suite goes red here, that is this constraint doing its job — **widen the arm, do not weaken the CHECK.**"
2. **`lib/bracket/generate.ts:438-440`**:
   > "Exactly ONE grand-final row this story. The AD-21 reset row (gf_order=2) is Story 4.4's. Neither edge: the winner is the CHAMPION and goes nowhere; the loser is the runner-up."
3. **`_bmad-output/implementation-artifacts/4-3-idempotent-conditional-advance.md:439-442`** — on `tournament.final_match_id`:
   > "the column exists ([0001_core_schema.sql:31], FK closed by 4.1) … **Leave it dormant.** Which row is the *last* GF row is **4.4's** question (the reset row), and writing it now would be wrong for exactly the field 4.4 exists to handle."
4. **`supabase/tests/0013_advance_test.sql:116-123`** — the `pg_temp.mid`/`pg_temp.comp` helpers were pre-parameterised with `gf int default 0` **specifically so 4.4's reset row does not abort the whole file** the moment `mid('grand_final',0)` starts matching two rows. Section B's grand-final CHECK assertion (`~:318-323`) is annotated "(Story 4.4 widens this arm for the AD-21 reset row)" and **will go red** — that is expected; update the assertion, not the constraint direction.

### The mechanism, precisely

The Winners-Final winner and Losers-Final winner already route into `gf_order=1`:
- `lib/bracket/generate.ts:246` — `winnersWinnerTarget(...)` → `{ bracket:'grand_final', slot:0, side:'a', gfOrder:1 }` (**side A = WB champion, 0 losses**)
- `lib/bracket/generate.ts:297` — `losersWinnerTarget(...)` → `{ bracket:'grand_final', slot:0, side:'b', gfOrder:1 }` (**side B = LB survivor, 1 loss**)

So `competitor_a` of `gf_order=1` is ALWAYS the WB champion and `competitor_b` is ALWAYS the LB survivor. That convention is what makes the conditional crisp and data-driven rather than a lookup of loss counts.

**Game 1 (`gf_order=1`) outcomes:**
| Winner of game 1 | Loss count after | Consequence | Champion | `final_match_id` |
|---|---|---|---|---|
| `competitor_a` (WB champ, side A) | A:0, B:2 | **No reset.** A is undefeated → champion. | A | id of `gf_order=1` |
| `competitor_b` (LB survivor, side B) | A:1, B:1 | **Reset.** Both go to `gf_order=2` (A→side a, B→side b); winner of game 2 is champion. | winner of `gf_order=2` | id of `gf_order=2` |

**`gf_order=2` (the reset)** is a fresh, terminal, edgeless row: both edges NULL, its winner is champion by 4.3's existing "edgeless → champion" rule at `0013_advance.sql:678-680`. It carries the SAME two competitors as game 1, re-seated (A→side a, B→side b), so the champion slot is a *new* row's `winner_entry`, never an overwrite of game 1's.

### What "champion slot never overwritten in place" means for AD-8 (the reason AD-21 exists)

Read `review-adversarial.md:167-179` (the H4 hole that birthed AD-21). Without two rows, a bracket reset would write ONE grand-final destination slot **twice with different winners** (game-1 winner then game-2 winner), and AD-8's `WHERE slot IS NULL OR = winner` guard (`match_place_competitor`) is built precisely to *reject* a second different winner into a filled slot — it cannot tell "double-route bug" from "legitimate reset." AD-21 dissolves the dilemma: the reset routes into a **separate** row, so `match_place_competitor` never sees a legitimate second-different-winner. AC3 ("AD-8 conditional advance applies per row") is satisfied by construction — each GF row is advanced by the same `advance_match`, independently.

---

## Tasks / Subtasks

### Task 0 — Re-read the load-bearing code before editing (do not skip) (AC: all)
- [x] Read `supabase/migrations/0013_advance.sql` end to end, especially: the `gf_order` edge guards (`:128-137`), `match_routing_complete` (`:158-165`), `generate_bracket`'s skeleton-count `v_expected := 2*v_bracket - 2` (`:264-280`) and edge-resolution guard 6b (`:320-356`), `match_place_competitor` (`:447-509`), and **all of `advance_match` (`:563-858`)** — the champion detection at `:678-680`, the edge loop `:684-765`, the void-node raise `:716-724`, the audit row `:795-807`, the emit gate `v_hops > 0 or v_champ is not null` (`:838`).
- [x] Read `lib/bracket/generate.ts:236-313` (routing functions), `:406-441` (skeleton emission incl. the single GF row), `:504-539` (arrivals counting + GF state derivation).
- [x] Read `supabase/tests/0013_advance_test.sql` Section B grand-final CHECK (`~:318-323`), Section K the GF champion test (`~:694-744`), and the golden-snapshot fixture `pg_temp.matches11` (`~:188-225`) — note its single GF row at `~:223` and the two finals routing to `grand_final/0/1/a` and `.../b`.
- [x] Read `_bmad-output/implementation-artifacts/4-3-idempotent-conditional-advance.md` Dev Notes + Completion Notes for every "Story 4.4" mention (`:429-442`, `:798-800`).

### Task 1 — Emit the reset row + `gf_order=1` conditional edges in `lib/bracket/generate.ts` (routing lives as DATA — AD-21) (AC: 1, 2)
- [x] At `generate.ts:438-440`, replace the single terminal GF `add(...)` with TWO rows:
  - `gf_order=1`: give it the conditional edges — `winnerTo = { bracket:'grand_final', slot:0, side:'b', gfOrder:2 }`, `loserTo = { bracket:'grand_final', slot:0, side:'a', gfOrder:2 }`. (Winner→reset side b, loser→reset side a, matching the game-2 seating A=side a / B=side b.)
  - `gf_order=2`: the terminal reset — `add('grand_final', 'Grand Final (reset)', 0, 2, null, null)`. Both edges NULL → its winner is champion by the existing edgeless rule.
- [x] **State derivation:** keep `gf_order=1`'s state derivation at `:539` (`gfArrivals===2 ? 'declared':'bye'`) but re-key it to the `gf_order=1` row explicitly. Set `gf_order=2`'s state to `'declared'` (its competitors are NULL at generation and are seated only if the reset fires — the same shape as every other not-yet-filled `declared` row; it must **not** be `void`, because `advance_match:716-724` RAISES on routing into a void node).
- [x] **DO NOT re-derive routing in SQL.** The conditional edges are emitted here by the routing functions/`edgeRef`, exactly as `winnersWinnerTarget`/`losersWinnerTarget` already do. If you find yourself writing `gf_order` routing in plpgsql, stop — the DB copy is the one nobody tests (`generate.ts:406-409`).
- [x] `generateAndPersistBracket` (`~:611-685`) passes `matches` verbatim to the RPC — **no change needed** there; the extra row flows through.

### Task 2 — Widen `match_routing_complete`'s grand_final arm (migration `0014_grand_final_reset.sql`) (AC: 1)
- [x] New migration `supabase/migrations/0014_grand_final_reset.sql`. **Drop and re-add** `match_routing_complete` with a widened grand_final arm that PERMITS `gf_order=1` to carry edges while keeping `gf_order=2` terminal. Suggested shape (keep `else false`, keep every arm named — 4.3 review lesson at `0013:153-157`):
  ```sql
  case bracket
    when 'winners'     then winner_to_bracket is not null and loser_to_bracket is not null
    when 'losers'      then winner_to_bracket is not null and loser_to_bracket is null
    when 'grand_final' then
      case gf_order
        when 1 then true   -- AD-21: gf_order=1 MAY carry the conditional reset edges (or none, if you
                           --        chose lazy seating); the edge gf_order guards already pin the target.
        when 2 then winner_to_bracket is null and loser_to_bracket is null  -- terminal: its winner is champion
        else false
      end
    else false
  end
  ```
  Consider tightening the `gf_order=1` arm to assert the edges, when present, point at `grand_final/gf_order=2` (`winner_to_bracket = 'grand_final' and winner_to_gf_order = 2`) so a malformed GF-1 edge is still unrepresentable — decide based on whether that over-constrains a future format. **Do not weaken the winners/losers arms.**
- [x] The table guard `match_gf_order_guard` (`0010:84-89`) and the edge guards `match_winner_edge_gf_order`/`match_loser_edge_gf_order` (`0013:128-137`) already allow `gf_order in (1,2)` and edges targeting `gf_order=2` — **no change needed**; add a pgTAP assertion that a `gf_order=2` row inserts cleanly.
- [x] Update the column comments at `0013:87-90` (they say `winner_to_bracket` is "NULL only on the grand-final row" and `loser_to_bracket` is "NULL on the grand-final row") — that is now only true of `gf_order=2`. Correct them so the next reader isn't misled.

### Task 3 — Bump the skeleton count in `generate_bracket` (same migration 0014) (AC: 1)
- [x] `create or replace function public.generate_bracket(...)` with an **IDENTICAL signature** `(bigint, text, jsonb, jsonb, jsonb)` so the 0011 EXECUTE grants survive (`0013:171-175`). Copy 0013's body forward VERBATIM and change ONLY the skeleton-count arithmetic at `0013:272`: `v_expected := 2 * v_bracket - 2` → `v_expected := 2 * v_bracket - 1` (the reset row is always emitted). Update the comment at `0013:264` (`B-1 winners + B-2 losers + 1 grand-final = 2B-2`) to `+ 2 grand-final = 2B-1`.
- [x] The edge-resolution guard 6b (`0013:320-356`) needs **no change**: it already validates every non-null edge resolves to a real `(bracket, slot, coalesce(gf_order,0))` row in the payload, so `gf_order=1`'s new edge → `gf_order=2` is validated for free (the guard's header at `0013:317-319` literally anticipates this). Confirm this by reading it, don't re-implement it.

### Task 4 — The GF-1 conditional + champion + `final_match_id` in `advance_match` (same migration 0014) (AC: 2, 3)
- [x] `create or replace function public.advance_match(...)` — **IDENTICAL signature** `(bigint, text, boolean default true)` to preserve grants. Copy 0013's body forward and make these surgical changes:
- [x] **Read the source's bracket, gf_order, and competitors.** At `0013:610-613` `v_m` selects `state, winner_entry, competitor_a, competitor_b` — add `bracket` and `gf_order`.
- [x] **The AD-21 conditional, applied to the source before the cascade is planned** (after the winner/loser are computed at `0013:635`, before `v_todo` is built at `0013:637`):
  ```sql
  -- AD-21: the grand final's first row is the ONE conditional edge in double-elim. Side A is the Winners
  -- champion (0 losses); if THEY win game 1 they are champion outright — no reset, follow no edge. Side B
  -- is the Losers survivor; only their win hands A its first loss and forces the reset (gf_order=2).
  if v_m.bracket = 'grand_final' and v_m.gf_order = 1 and v_m.winner_entry = v_m.competitor_a then
    v_champ := v_m.winner_entry;
    v_todo  := '[]'::jsonb;   -- crown, do NOT enqueue the (reset) edges
  end if;
  ```
  When side B wins, fall through unchanged: the normal edge loop routes the winner (B) to `gf_order=2/side b` and the loser (A) to `gf_order=2/side a`. Because `gf_order=2` is `declared` (not `bye`), the cascade stops there (`v_walk=false`); a later `advance_match(gf_order=2)` crowns the champion by the edgeless rule.
- [x] **Keep the edgeless champion rule** at `0013:678-680` intact — it now crowns `gf_order=2` (terminal, edgeless). Verify it does NOT wrongly fire for `gf_order=1` (which now has edges → `winner_to_bracket` non-null → rule skips it; the conditional above handles GF-1). The emit gate `v_hops > 0 or v_champ is not null` (`0013:838`) already covers "champion crowned, zero hops" — no change.
- [x] **Set `tournament.final_match_id`** when a champion is crowned (see DECISION A). When `v_champ is not null`, `update public.tournament set final_match_id = p_match_id where id = v_m.tournament_id`. This is "the last GF row played": `gf_order=1`'s id when A wins outright, `gf_order=2`'s id when the reset resolves. Confirm the invoking role holds UPDATE on `tournament` (service_role does — `generate_bracket` updates `tournament.state`; `advance_match` is `security invoker` and is granted to service_role only — verify the grant in 0013).
- [x] The `champion` audit/return/broadcast key (`0013:805/845/855`) already exists — it now carries the reset champion correctly with no change.

### Task 5 — pgTAP: new `0014` suite + update the 0013 GF sections (AC: 1, 2, 3)
- [x] **New `supabase/tests/0014_grand_final_reset_test.sql`** covering, with EXACT `plan(N)` accounting:
  - `gf_order=2` row inserts cleanly (guards allow it); a `gf_order=3` is refused (`match_gf_order_guard`).
  - `match_routing_complete`: a `gf_order=1` row WITH the reset edges is now ACCEPTED; a `gf_order=2` row WITH an edge is REFUSED (still terminal).
  - **AC2 side-A path:** seat `gf_order=1` (A=comp_a, B=comp_b, `state='resolved'`, `winner_entry=A`), advance → `{ok:true, advanced:0, champion:A}`, `gf_order=2` stays `declared`/empty, `tournament.final_match_id = gf_order=1.id`.
  - **AC2 reset path (the flagship):** seat `gf_order=1` with `winner_entry=B`, advance → B routes to `gf_order=2/side b`, A routes to `gf_order=2/side a`, no champion yet, `final_match_id` still NULL; THEN resolve `gf_order=2` (winner = A or B), advance → `champion = gf_order=2.winner`, `final_match_id = gf_order=2.id`. Assert `gf_order=1.winner_entry` and `gf_order=2.winner_entry` are DIFFERENT rows — the champion slot was never overwritten in place (AC2's literal claim).
  - **AC3:** each GF row is advanced by the same `advance_match`; a replay of either is a no-op (idempotent) writing a second `advance` audit row (4.3's established behavior).
  - **Mutation check (4.1/4.2/4.3 standing lesson):** confirm deleting the GF-1 conditional turns a test RED (a side-A win must NOT route into the reset; a side-B win MUST). A green suite after mutation means the test is blind — fix the test, per the three prior reviews.
- [x] **Update `0013_advance_test.sql`:** Section B (`~:318-323`) — the "grand_final row with a winner edge is REFUSED" assertion inverts for `gf_order=1` (now permitted); rewrite it to assert the widened truth (`gf_order=1` edge OK, `gf_order=2` edge refused). Section K — extend/keep the terminal-champion path; ensure every GF call site passes explicit `gf => 1` or `gf => 2` (the helper defaults `gf=>0`, which now matches NEITHER GF row — a bare call returns NULL). Fix `plan(N)` exactly (current `plan(87)`).

### Task 6 — Known regression: the golden-snapshot fixtures (AC: 1)
- [x] **`generate_bracket` now expects `2B-1` rows**, so every fixture that feeds it the old `2B-2` skeleton goes RED (`bad_skeleton`). This is the CHECK working — fix the FIXTURES, never the count (the exact 4.3 lesson):
  - `0013_advance_test.sql`'s `pg_temp.matches11` (`~:188-225`) — add the `gf_order=2` row and give `gf_order=1` the reset edges. Regenerate it from **real `generateBracket()` output** (dump it; do not hand-derive — hand-derived edges are what 4.1/4.3 got wrong).
  - `0011_bracket_generation_test.sql` — any hand-built `p_matches` skeleton (`pg_temp.matches8`/`matches16`) fed to `generate_bracket` must add the reset row + gf/1 edges. If a fixture asserts the exact returned row count, bump it (`30→31` for 16, `14→15` for 8).
- [x] `0010_match_test.sql` / `0012_format_lock_test.sql` build `match` rows DIRECTLY (they do not call `generate_bracket`), so the skeleton-count change does not touch them — BUT the widened `match_routing_complete` does. If either inserts a bare `grand_final` row, confirm it still satisfies the widened arm (a `gf_order=1` row with no edges is still valid under the suggested arm; a `gf_order=2` terminal row is valid). Adjust only if a real assertion breaks; keep every `plan(N)` exact and accounted.

### Task 7 — Vitest: `lib/bracket/generate.test.ts` (AC: 1)
- [x] Update generation tests for the new reset row: total row count (`+1`), the `gf_order=2` row present, `gf_order=1` now carries the two conditional edges, `gf_order=2` edgeless `declared`. Keep the "edge set is a fixpoint of the skeleton" property test green (the new edges must resolve to the reset row). Update any golden snapshot.

### Task 8 — THE BAR: live-QA a real reset to a champion over the production seam (AC: 2, 3)
- [x] Re-apply `supabase/fixtures/live-qa-seed.sql` after `supabase db reset` (see the memory note; standing Live-QA fixture).
- [x] Drive a real 8–16-player bracket over the **supabase-js → PostgREST → RPC** seam (not just in-DB), through the finals into the grand final, and prove BOTH GF outcomes on real brackets:
  1. **Reset path:** LB survivor (side B) wins `gf_order=1` → assert the reset row is seated (A→side a, B→side b), `final_match_id` still NULL, no champion; then resolve `gf_order=2` → champion crowned from the reset row, `final_match_id = gf_order=2.id`; a real ANON WebSocket subscriber receives the `bracket.advanced` broadcast carrying `champion`.
  2. **No-reset path:** WB champ (side A) wins `gf_order=1` → champion outright, `gf_order=2` untouched, `final_match_id = gf_order=1.id`.
- [x] Prove **AC2 literally**: `gf_order=1.winner_entry` and the champion (`gf_order=2.winner_entry` on the reset path) are distinct rows — the champion slot was never overwritten in place.
- [x] Confirm advancing each GF row is idempotent (replay = no-op, second audit row) and that a `gf_order=2` advance rolled back inside an open txn discards its message row with the txn (4.3's post-commit-by-construction guarantee still holds).

---

## DECISIONS (made in-story; overrule at review — the 4.1/4.2/4.3 pattern)

**DECISION A — `tournament.final_match_id` is set inside `advance_match` when a champion is crowned.** RECOMMENDED. The champion (`v_champ`) is already computed there; "the last GF row played" is exactly `p_match_id` at the moment `v_champ` becomes non-null; and AD-13's `fair_seed = SHA-256(final demo)` needs `final_match_id` to know which demo is championship-deciding (`SOLUTION-DESIGN.md:64`, `ARCHITECTURE-SPINE.md:140-143`). Deferring to 4.6 Aprobar only moves the identical code and leaves the field dormant longer. Cost: `advance_match` gains its first `tournament` write (verify the UPDATE grant). *Alternative:* have 4.6 set it — reject unless the grant is a real problem.

**DECISION B — the reset row (`gf_order=2`) is ALWAYS generated, `declared`, edgeless; the reset merely SEATS it.** RECOMMENDED (essentially forced). `match` has NO DELETE grant (`0010:227`), generation is single-shot, and the edge-resolution guard (`0013:320-356`) requires `gf_order=1`'s edge to resolve to a real row in the payload — so the reset row must exist at generation. A lazy "INSERT the reset row at advance time" design would fight all three. The row sitting unplayed when side A wins is fine — it is the same shape as `void`/unfilled rows that already exist. *Alternative:* lazy creation — reject; it re-derives structure outside generation.

**DECISION C — `tournament.state` does NOT change here.** OUT OF SCOPE. Crowning a champion is not the same as starting the ceremony; `registration_open → … → ceremony → closed` are **audited admin transitions** (`ARCHITECTURE-SPINE.md:235`), and the ceremony is Epic 6. 4.4 sets `final_match_id` (identifying the decisive match) but leaves `tournament.state` to the admin transition that starts the ceremony. Flag so a reviewer knows the boundary is deliberate.

---

## Dev Notes

### Architecture constraints (cited)
- **AD-21** (`ARCHITECTURE-SPINE.md:180-183`): "the grand final is up to **two** ordered `match` rows (GF, then GF-reset if the losers-bracket player wins the first). The champion is whoever resolves the *last* GF row; AD-8's conditional advance applies per row; the champion slot is never overwritten in place." Origin: adversarial hole H4 (`reviews/review-adversarial.md:167-192`). Routing "lives as **data**, not branching code, in `lib/bracket`."
- **FR-6** (`prd.md:174-181`): a player is eliminated only after two losses; WB and LB finalists meet in the grand final; two-loss elimination is *derived from bracket edges, never a stored flag* (`SOLUTION-DESIGN.md:359`).
- **AD-8** (`ARCHITECTURE-SPINE.md:115-118`): advance is a conditional (`WHERE slot IS NULL OR = winner`), idempotent consequence of a result, never an independent control. The two-row model is what keeps AD-8's guard from ever seeing a legitimate second-different-winner.
- **AD-13** (`ARCHITECTURE-SPINE.md:140-143`): `tournament.fair_seed = SHA-256(final demo)`, frozen when the championship-deciding demo is Approved — this is why `final_match_id` matters (Decision A).
- **Champion is DERIVED**, not stored: there is no `champion_entry` column. It is `winner_entry` of the last GF row; UX renders "the resolved CHAMPION node" with the sole permitted gold border (`EXPERIENCE.md:86,172`, `DESIGN.md:100-108,287`). No UI work in this story (Epic 5 owns viewer surfaces); the champion just needs to be correctly identified in the data + the `champion` broadcast key.

### Current-state facts you must preserve (regressions to avoid)
- **`advance_match` is TWO-PASS** (`0013:641-786`): pass 1 plans read-only under a whole-tournament canonical-`id`-ordered `FOR UPDATE` (`:603-607`); pass 2 applies. A typed refusal RETURNS (does not raise), so it does not roll back the caller. **Do not** reintroduce a `FOR UPDATE` before `:603` (that was the 4.3 deadlock). Your GF-1 conditional runs read-only inside pass 1's scope — safe.
- **`advance_match` RAISES on routing into a `void` node** (`0013:716-724`). That is why `gf_order=2` must be `declared`, never `void`.
- **The emit gate** `v_hops > 0 or v_champ is not null` (`0013:838`) is load-bearing (crowning plans zero hops). Your reset champion sets `v_champ`, so it emits. Don't touch it.
- **`match_place_competitor`** (`0013:447-509`) is AC1's predicate and guards the winner too (4.3 review fix) — it is the ONLY place a competitor seat is written; do not add a second writer.
- **Idempotency/replay** writes a SECOND `advance` audit row deliberately (`0013:792-794`) — that is AC1's idempotency being visible, and it is asserted. Keep it.
- **`match` has NO DELETE grant** (`0010:227`); a bad bracket is unrecoverable. Get the reset row right at generation.

### Migration hygiene
- Next migration slot is **`0014_grand_final_reset.sql`**; test **`supabase/tests/0014_grand_final_reset_test.sql`**.
- Both `create or replace` functions MUST keep their exact existing signatures (`generate_bracket(bigint,text,jsonb,jsonb,jsonb)`, `advance_match(bigint,text,boolean)`) so the EXECUTE grants issued in 0011/0013 survive — **do not** drop-and-recreate, **do not** re-issue grants (`0013:171-175`).
- `audit_log.action` is uncapped free text (`0003:25`), so the reset reusing `action='advance'` needs no migration. **Recommendation:** reuse `'advance'` — the reset IS an advance of the GF-1 winner into GF-2; a champion crowning is already distinguished by the `champion` detail key. Introducing a new action string is optional and needs no migration, but adds vocabulary for no gate.

### Scope boundaries (do NOT do these here)
- No `tournament.state` transition / ceremony (Decision C; Epic 6).
- No bye/forfeit/grace mechanics (Story 4.5) — but note **byes are impossible in the GF by construction** (both finalists present, `review-adversarial.md:191`), so you never seat a `bye` GF row.
- No Aprobar/score (Story 4.6), no rollback/un-advance (Story 4.7), no manual score (Story 4.8), no command route (Story 4.9). Like 4.2/4.3, this story has **no production caller** — it is a mechanism proven at the SQL layer + live-QA; 4.5/4.6 call `advance_match` inside their own transactions.
- No UI / i18n / realtime viewer (Epic 5). The `bracket.advanced` broadcast already carries `champion`.

### Project Structure Notes
- Routing data + generation: `lib/bracket/generate.ts` (+ `lib/bracket/generate.test.ts` Vitest).
- DB mechanism: `supabase/migrations/0014_grand_final_reset.sql` (+ `supabase/tests/0014_grand_final_reset_test.sql` pgTAP).
- No new module, no new route, no `app/` changes. `match`/`tournament` schema already has every column (`gf_order`, `final_match_id`, the slot-unique index) — this story adds **no new columns**, only a widened CHECK + two replaced functions + generation output.

### Testing standards
- **pgTAP** with EXACT `plan(N)` accounting (standing convention since Epic 1) — account for every added/removed assertion across 0011/0013/0014.
- **Mutation-test your own suite** (the explicit lesson of the 4.1, 4.2, AND 4.3 reviews — each found "the suite proved less than it claimed"): delete the GF-1 conditional and the reset routing and confirm the suite goes RED. A green suite after mutation is a blind suite.
- Gates to keep green: pgTAP (currently 599), Vitest (currently 212), `lint 0`, `build 0`, worker `go build`/`vet` clean (the Go worker never touches `match` — confirm by grep, don't assume, per 4.3).
- **THE BAR (Task 8):** a real reset driven to a champion over the live seam, both GF outcomes, AC2 proven literally (two distinct rows).

### References
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/ARCHITECTURE-SPINE.md#AD-21] (`:180-183`); AD-8 (`:115-118`); AD-13 (`:140-143`); match lifecycle (`:301-317`); tournament state (`:348`); admin transitions (`:235`)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/SOLUTION-DESIGN.md#grand-final-reset] (`:360-361`); `match.gf_order` (`:116`); slot-unique (`:131`); `tournament.final_match_id` (`:64`); two-loss derived (`:359`)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-cs-tournament-2026-06-30/reviews/review-adversarial.md#H4] (`:156-192`) — the reset-slot dilemma AD-21 resolves
- [Source: _bmad-output/planning-artifacts/prds/prd-cs-tournament-2026-06-29/prd.md#FR-6] (`:174-181`)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.4] (`:696-716`)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-cs-tournament-2026-06-30/EXPERIENCE.md] champion node (`:86,172`); [DESIGN.md] gold reserve (`:100-108,287`)
- [Source: supabase/migrations/0013_advance.sql] the four hand-off comments (`:87-90,149-151`), `match_routing_complete` (`:158-165`), edge gf_order guards (`:128-137`), `generate_bracket` count (`:264-280`) + guard 6b (`:320-356`), `match_place_competitor` (`:447-509`), `advance_match` (`:563-858`, champion `:678-680`, void raise `:716-724`, emit gate `:838`)
- [Source: supabase/migrations/0010_match.sql] `match` cols + state enum (`:46-103`), `match_gf_order_guard` (`:84-89`), slot-unique (`:112-113`), `tournament_final_match_fk` (`:195-196`), grants no-DELETE (`:227`)
- [Source: supabase/migrations/0001_core_schema.sql] `tournament` incl. `final_match_id` (`:32`) + state enum (`:29-30`)
- [Source: lib/bracket/generate.ts] GF emission (`:438-440`), routing to GF (`:246,297`), arrivals + GF state (`:504-539`), `key`/`add` (`:357,384-404`)
- [Source: supabase/tests/0013_advance_test.sql] the `mid`/`comp` `gf` param landmine (`:116-130`), Section B GF CHECK (`~:318-323`), Section K GF champion (`~:694-744`), `matches11` fixture (`~:188-225`)
- [Source: _bmad-output/implementation-artifacts/4-3-idempotent-conditional-advance.md] Story-4.4 hand-offs (`:429-442,798-800`)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story), baseline_commit eac5f51.

### Debug Log References

- `supabase test db` (full pgTAP): 624 tests PASS (599 → +25: new 0014 suite +23, 0013 plan 87 → 89).
- `npx vitest run`: 212 PASS.
- `npm run lint`: 0. `npm run build`: 0. worker `go build ./...` / `go vet ./...`: clean, exit 0.
- Worker re-confirmed BY GREP (not assumed) to touch no 4.4 surface: `grand_final|gf_order|advance_match|winner_to|final_match_id|(from|into|update) match` → 0 matches under `worker/`.
- ⭐ MUTATION-VERIFIED: neutering the AD-21 GF-1 conditional (`if false and …`) + `db reset` turned the suite RED — 0014 (4 red: a side-A win then routed into the reset, so advanced 2 not 0, no champion, reset seated, final_match_id unset) AND 0013 Section K (4 red). Reverted; suite green again. The suite is not blind.
- 🏆 THE BAR (Task 8) MET over the supabase-js → PostgREST → RPC seam (live-QA script run against the local stack, then removed): two independently-generated 8-player brackets, both drove `generate_bracket` + `declare_match_format` + `advance_match` over the seam. RESET path — side B (LB survivor) won gf_order=1 → `advanced:2`, `champion:null`, reset seated (loser A → side a, winner B → side b), `final_match_id` still NULL; then the reset resolved → `champion` = the reset row's winner, `final_match_id` = gf_order=2's id. NO-RESET path — side A (WB champion) won gf_order=1 → `advanced:0`, champion outright, reset row UNTOUCHED (empty + declared), `final_match_id` = gf_order=1's id. AC2 proven LITERALLY: gf_order=1.winner_entry and gf_order=2.winner_entry are DISTINCT winners on DISTINCT rows — the champion slot was never overwritten in place. Idempotent replay = no-op. A real ANON WebSocket subscriber received the `bracket.advanced` broadcast carrying `champion` on BOTH tournaments.

### Completion Notes List

The bracket already shipped everything except the reset row; this story adds the SECOND grand-final row and the one conditional in double-elim, with NO new columns (`match.gf_order`, `tournament.final_match_id` and the coalesce(gf_order,0) slot-unique index all pre-existed).

- **Task 1 — generation emits the reset as DATA (`lib/bracket/generate.ts`).** The single terminal GF `add(...)` became two rows: `gf_order=1` carries the two conditional reset edges (winner → `grand_final/0/2/side b`, loser → `grand_final/0/2/side a`, written as literal `EdgeRef`s — a constant structural fact, not derived arithmetic), and `gf_order=2` is the terminal edgeless reset row. `gf_order=2`'s state is set explicitly to `declared` (NOT `void` — `advance_match` RAISES on routing into a void node). Skeleton is now 2B-1 rows.
- **Task 2 — widen `match_routing_complete` (migration `0014`).** Drop-and-re-add; the winners/losers arms are byte-identical to 0013, `else false` kept a fail-closed wall. The grand_final arm now branches on gf_order: `gf_order=1` MAY carry edges but, WHEN PRESENT, they must point at `grand_final gf_order=2` (a malformed GF-1 edge — aimed at winners, or self-looping — stays unrepresentable); `gf_order=2` stays terminal (neither edge). The two column comments (0013:87-90) were corrected. The widened arm is strictly MORE permissive, so re-adding it cannot newly fail an existing row.
- **Task 3 — skeleton count 2B-2 → 2B-1 (`create or replace generate_bracket`, IDENTICAL signature).** Copied 0013's body forward verbatim; only step 5b's arithmetic + comments changed. Grants preserved. Edge-resolution guard 6b needed NO change — it already keys on `(bracket, slot, coalesce(gf_order,0))`, so gf_order=1's edge → the reset row validates for free.
- **Task 4 — the AD-21 conditional + `final_match_id` (`create or replace advance_match`, IDENTICAL signature).** The source SELECT now also reads `bracket` and `gf_order`. The conditional runs read-only inside pass 1's scope, BEFORE the cascade is planned (the two-pass / canonical-lock-order invariants are untouched, so the 4.3 deadlock stays fixed): when the source is `grand_final gf_order=1` and `winner_entry = competitor_a` (side A, the undefeated WB champion), crown them and empty the worklist so NEITHER reset edge is followed. When side B wins, fall through unchanged — the normal edge loop routes both competitors into the terminal `gf_order=2` (declared, so the cascade stops there). **DECISION A**: when a champion is crowned, `tournament.final_match_id = p_match_id` — "the last GF row played" (gf_order=1's id when A wins outright, gf_order=2's id when the reset resolves). The edgeless champion rule and emit gate are unchanged; both crown paths set `v_champ`, so the emit gate (`v_hops > 0 or v_champ is not null`) covers them.
- **Task 5 — pgTAP.** New `0014_grand_final_reset_test.sql` (plan 23): the guard truths, the no-reset side-A path (TGFA), the flagship RESET path (TRESET) proving AC2 literally, and AC3 per-row idempotency. 0013: plan 87 → 89 — Section B split the inverted GF-CHECK into two (gf_order=1-with-reset-edges ACCEPTED / terminal-gf_order=2-with-edge REFUSED), Section K asserts DECISION A on the no-reset path, `matches11` gained the reset row + gf/1 edges, `match_count` 30 → 31.
- **Task 6 — golden fixtures.** `0011`'s `matches8`/`matches16` gained the reset row + gf/1 edges; every skeleton-count assertion 14 → 15 / 30 → 31 (the CHECK working, fixtures fixed — never the count). `0010`/`0012` needed NO change (they hand-build rows the widened arm still accepts; the 0010 fixture already inserts both GF rows for "Story 4.4 headroom").
- **Task 7 — Vitest.** `generate.test.ts`: total row counts +1 (15/31), the two-GF-rows assertion, explicit gf_order=1-carries-reset-edges / gf_order=2-edgeless assertions, and the atomic-command `p_matches` length 14 → 15. 75 tests in that file, all green.

**Scope boundaries held (flagged, not exceeded):** DECISION C — `tournament.state` does NOT change (ceremony is an audited admin transition, Epic 6). No production caller (like 4.2/4.3): no route, no `Avanzar` button, no UI/i18n/realtime viewer. DECISION B confirmed by construction: the reset row is ALWAYS generated, `declared`, edgeless (forced by the edge-resolution guard + no-DELETE-grant + single-shot generation). Byes are impossible in the GF by construction, so no GF row is ever `bye`/`void`.

### File List

- `lib/bracket/generate.ts` (M) — emit the AD-21 reset row + gf_order=1 conditional edges; skeleton 2B-1.
- `lib/bracket/generate.test.ts` (M) — reset-row generation assertions; counts 15/31.
- `supabase/migrations/0014_grand_final_reset.sql` (A) — widened routing arm + `create or replace` of `generate_bracket` (2B-1) and `advance_match` (AD-21 conditional + `final_match_id`).
- `supabase/tests/0014_grand_final_reset_test.sql` (A) — the AD-21 suite (plan 23), mutation-verified.
- `supabase/tests/0013_advance_test.sql` (M) — plan 87 → 89; Section B widened-arm split, Section K DECISION A, `matches11` reset row.
- `supabase/tests/0011_bracket_generation_test.sql` (M) — `matches8`/`matches16` reset row + gf/1 edges; skeleton counts 15/31.
- `supabase/fixtures/live-qa-bracket-seed.sql` (M) — comment: expected shape now 31 rows / 2 grand-final.

### Change Log

- 2026-07-14: Story 4.4 implemented (baseline eac5f51). Added the AD-21 grand-final reset as two ordered match rows. Migration `0014_grand_final_reset.sql` (widened `match_routing_complete` grand_final arm; `create or replace` `generate_bracket` skeleton 2B-2 → 2B-1 and `advance_match` with the GF-1 conditional + `tournament.final_match_id` on crown, both IDENTICAL signatures). `generate.ts` emits the reset row + gf/1 conditional edges as data. New pgTAP suite `0014` (plan 23, mutation-verified); `0013` 87 → 89; `0011`/Vitest fixtures updated. Gates: pgTAP 624 / Vitest 212 / lint 0 / build 0 / go clean. THE BAR met: a real reset driven to a champion over the supabase-js → PostgREST → RPC seam, both GF outcomes, AC2 proven as two distinct rows, ANON broadcast received.

## Review Findings

_Code review 2026-07-14 (baseline `eac5f51`) — 3 adversarial layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor, all Opus 4.8). **0 decision-needed · 2 patch · 1 defer · 3 dismissed.** Headline: unlike the 4.1/4.2/4.3 reviews (each of which found the suite proved materially less than it claimed), the Auditor verified this story's own load-bearing claims are TRUE — both `create or replace` functions are 0013's body copied forward verbatim except the three disclosed changes; "mutation-verified" is genuine (removing the GF-1 conditional turns four value-asserting assertions red); AC2 is proven literally (two distinct rows, distinct winners); `final_match_id` = "the last GF row played" holds on both paths. AC1/AC2/AC3 and DECISIONS A/B/C all hold._

- [x] [Review][Patch] ✅ APPLIED — Widened `match_routing_complete` gf_order=1 arm is looser than the "unrepresentable brick / untrusted payload" doctrine — it allows an ASYMMETRIC row (winner edge XOR loser edge) and does not pin the reset edge `side`/`slot`, where the sibling `winners` arm requires BOTH edges. Not reachable via `generateBracket()` (always emits both edges correctly), but the constraint is the DB-authority backstop against hand-built RPC payloads, and this is the one story that touches it. Tighten to strict both-or-neither with the fixed reset target (winner → `grand_final,0,2,b`; loser → `grand_final,0,2,a`); keep both-null valid (0010 fixture). Add a pgTAP `throws_ok` that an asymmetric gf_order=1 row is REFUSED (closes the coverage gap — no test currently asserts the malformed GF-1 shapes the migration comment claims are unrepresentable). [supabase/migrations/0014_grand_final_reset.sql:63-77] [blind+edge]
- [x] [Review][Patch] ✅ APPLIED — Stale doc comment made wrong by this change: "the COMPLETE skeleton — … and the single Grand-Final row" now emits TWO grand-final rows (gf_order 1 + the reset). Corrected, matching the hygiene the story applied to the SQL column comments. [lib/bracket/generate.ts:365] [edge]
- [x] [Review][Defer] `final_match_id = p_match_id` assumes the crown always happens at the ADVANCED row — latent if a future story makes a terminal row walkover-reachable [supabase/migrations/0014_grand_final_reset.sql:587-591] — deferred, correct & verified unreachable today (terminal rows are only gf_order=2, which is `declared` never `bye`, so no walkover cascades into a terminal crown). Full entry + fix sketch in deferred-work.md.

**Dismissed (3):** (1) Blind-layer FALSE POSITIVE — a NULL `winner_to_gf_order` slipping through the widened CHECK: already unrepresentable via `match_winner_edge_gf_order` (0013:128-137), which forces `winner_to_gf_order in (1,2)` non-null whenever an edge targets `grand_final`; the diff-blind layer could not see the sibling constraint. (2) The AD-21 conditional trusting the seat convention (competitor_a = WB champion) rather than loss counts — verified guarded end-to-end (0013:414-421 proves the Winners/Losers finals route to side a/b; Vitest asserts the same); a documented assumption to re-check at Story 4.7 (rollback / manual re-seating), not a defect. (3) A cosmetic Section-B/K assertion-count label — now self-consistent with the runtime `plan(89)`.
