---
baseline_commit: 7208608
---

# Story 4.3: Idempotent conditional advance

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **admin**,
I want **advancing a winner to be a conditional, idempotent consequence of a result**,
so that **double-taps or races cannot mis-route the bracket.**

This is the **third story of Epic 4**, and it is the story that makes the bracket **move**. Story 4.1
built the skeleton (every node, every competitor slot NULL) and 4.2 froze each node's rules. 4.3 ships
the one thing that turns a static skeleton into a tournament: **a result flows to its consequences.**

**Read this before anything else — it is the shape of the whole story.** Like 4.2, this story has **no
production caller**: AC2 forbids an independent advance control, and the transitions that *do* call an
advance (Forfeit → 4.5, Aprobar → 4.6) do not exist yet. So 4.3 ships a **mechanism**, proven at the SQL
layer and at live-QA, that 4.5/4.6 call **inside their own transactions**. It ships **no route and no new
TypeScript module** — and that is correct, not a gap. See §"What 4.3 ships, and what it deliberately does not".

## Acceptance Criteria

Verbatim from [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3 (lines 674-694)]:

**AC1 — the conditional write (AD-8, FR-7)**
**Given** the conditional-advance rule, **When** a match result advances a winner, **Then** the advance
writes under `WHERE slot IS NULL OR = winner` so re-applying it is a **no-op** (no double-route).

**AC2 — consequence, not control (AD-8)**
**Given** the consequence-not-control rule, **When** an advance occurs, **Then** it is a **consequence of
a result transition** (Aprobar / Forfeit / Bye) and **never an independent control that races publish**.

**AC3 — realtime (FR-7)**
**Given** the realtime requirement, **When** an advance commits, **Then** the change **propagates to
viewers in real time** (emitted **only after commit**).

_Traces: FR-7 · AD-8_

### Additional required outcomes (D1–D5 — derived, NOT optional)

These are not in the epic's three ACs but they are **binding requirements** of this slice. AC1 says
"advances a winner"; a bracket in which only winners advance **cannot complete a single event**. An implied
requirement is still a requirement — the dev agent owns leaving the system working end to end.

- **D1 — The routing edges must be PERSISTED, because the advance runs inside SQL.**
  The double-elim routing exists **only in TypeScript** today
  ([lib/bracket/generate.ts:200-276] — `winnersWinnerTarget` / `winnersLoserTarget` / `losersWinnerTarget`).
  The `match` table has `bracket` / `bracket_slot` / `gf_order` and **no edge columns at all**. But the
  advance must run **inside** Story 4.6's Aprobar transaction — SOLUTION-DESIGN §8 lists it as step (3) of
  **one** DB transaction [SOLUTION-DESIGN.md:372-374] — and a plpgsql transaction cannot call back out to
  TypeScript to ask where a winner goes. **So the database must know the edges.**
  4.1 anticipated exactly this and said so: *"The routing functions below are exported precisely so 4.3
  consumes them rather than re-deriving"* [lib/bracket/generate.ts:31]. **Consume them — do not port the
  routing math to plpgsql.** A second implementation of `index ^ 1` is a second thing to drift.
  → **Generation emits the edges; the DB stores them; `advance_match` follows pointers.** Routing keeps
  exactly **one** implementation. See Task 1 for the column shape and Task 3 for why they are structural
  (`bracket`+`slot`+`gf_order`+`side`), not `match_id`s.

- **D2 — THE LOSER DROP IS PART OF THE ADVANCE. Without it, no bracket can ever complete.**
  ⚠ **This is the single most likely thing to be missed, because AC1 only says the word "winner".**
  In double elimination a Winners-bracket loser **drops to the Losers bracket** (their first loss); a
  Losers-bracket loser is **eliminated** (their second). FR-6's *"each loser drops to Losers until a second
  loss eliminates them"* is the whole point of the format, and *"two-loss elimination is **derived from
  bracket edges**, never a stored flag"* [SOLUTION-DESIGN.md:359]. `winnersLoserTarget` exists in 4.1's
  module **for this story and no other reason**.
  If the advance moves only winners, every Losers node stays empty forever, the Grand Final's side B never
  fills, and **not one tournament can reach a champion.** The loser drop is subject to the *same* AC1
  conditional predicate and the same idempotency.
  **The loser is not a stored column** — it is `the competitor who is not `winner_entry``, which is NULL
  when the match had only one competitor (a bye). That single expression handles Bye, Forfeit and Resolved
  uniformly. See Task 3.

- **D3 — THE BYE CASCADE. 4.1 flagged this in capitals and it is a hard blocker for every odd field.**
  Verbatim from [lib/bracket/generate.ts:33-38]:
  > *"⭐ **THE CONTRACT 4.3 MUST HONOUR:** a bye has no loser, so on a non-power-of-two field some Losers
  > nodes can only ever receive **ONE** competitor (`state='bye'`, a walkover) and some can receive **NONE**
  > (`state='void'`). … When 4.3 places a player into a Losers node already marked `'bye'`, it MUST advance
  > them **straight through it** (that match is won, unplayed) instead of waiting for an opponent who can
  > never arrive; a `'void'` node is never played and never advances anyone. **Without that, the Losers
  > bracket stalls.**"*

  So an arrival at a `bye` node **is** a result: set that node's `winner_entry` to the lone arrival and
  **advance again from it**, recursively, until the chain reaches a `declared` node (which waits for a real
  opponent) or the Grand Final. The standing 11-player live-QA field has **5 byes → 10 `bye`/`void` rows**
  (4.1 live-QA, verified), so this is not a corner case — it is the normal path for the fixture this story
  is proven against. A `void` node advances nobody and must never be the target of an arrival.

- **D4 — The advance writes an `advance` audit row (AD-17).**
  `advance` is **already** the enumerated `audit_log.action` vocabulary — [0003_audit_snapshot.sql:25],
  [SOLUTION-DESIGN.md:251], AD-17 [ARCHITECTURE-SPINE.md:163] all list it — so this **needs no migration**,
  exactly as `declare_format` needed none in 4.2. `target_match_id` = the **source** match. `audit_log.
  actor_steamid64` is `not null references player(steamid64)` [0003:24], so the function **must** take an
  actor.

- **D5 — NO standalone advance route, and no "advance" button. This is AC2, and it is a BOUNDARY.**
  AD-8 is explicit: advance is *"a consequence of a result (Aprobar / Forfeit / Bye), conditional … **never
  an independent button that races publish**"* [ARCHITECTURE-SPINE.md:118].
  ⚠ **You will find contrary evidence, and you must not follow it.** PRD **FR-7** says
  *"The Admin can advance a Match by tapping or dragging the winner forward"* [prd.md:183-185] and the UX
  ships an `{components.advance-control}` — *"`Avanzar` arrow. Tap to advance, or drag the winner forward"*
  [EXPERIENCE.md:87]. **The architecture deliberately overrode this**, and AD-8 names the exact failure it
  is preventing (*"an advance racing the publish"*). The epic's AC2 then restates AD-8 **verbatim**, which
  makes it the binding contract for this story. The `Avanzar` affordance, if it is ever built, is a
  *result-entry* action (Aprobar / W.O.) wearing an advance's clothes — and it is Epic 5's console, not
  this story's.
  → 4.3 exposes the advance as a **SQL function callable from inside a result transaction**, granted to
  `service_role` only. **No `app/api/admin/advance/route.ts`.** Flagged for Cuatro in the open questions.

## Tasks / Subtasks

> **Migration numbering:** next free is **0013**. This story is **one** migration — `0013_advance.sql` —
> because it is **one concern**: making a result flow to its consequences. It carries the routing edges
> (D1), the `advance_match` function (AC1/AC2/D2/D3/D4), the post-commit Broadcast (AC3), and a
> `create or replace` of `generate_bracket` so generation persists the edges.

- [x] **Task 0 — VERIFY THE ONE EXTERNAL ASSUMPTION BEFORE YOU BUILD ON IT (AC3)**
  - [x] AC3 is specced on Supabase's **Broadcast-from-the-Database**: `realtime.send(payload jsonb,
        event text, topic text, private boolean)`. Confirm it exists on the local stack **first**:
        `select proname, pg_get_function_arguments(oid) from pg_proc where proname = 'send'
         and pronamespace = 'realtime'::regnamespace;`
        (`[realtime] enabled = true` is already set — [supabase/config.toml:87-88].)
  - [x] **If it is absent**, STOP and report it: fall back to Decision-1 option (b) in §"Decision 1" —
        `advance_match` returns the semantic payload and emits nothing, and the emit is re-homed to the
        transaction owner (4.5/4.6). **Do not invent a third mechanism.** Everything else in this story is
        unaffected either way.

- [x] **Task 1 — Migration `0013_advance.sql`: the routing edges (D1)**
  - [x] Add **eight** nullable columns to `public.match` — the bracket DAG, as **structure**, not ids:
        `winner_to_bracket text`, `winner_to_slot int`, `winner_to_gf_order int`, `winner_to_side text`,
        and the four `loser_to_*` siblings.
        **⚠ Why structure and NOT `winner_to_match_id bigint`:** generation INSERTs every row in **one
        statement**, so no row has an `id` yet when its neighbours are written. A `match_id` edge would
        force a second, post-INSERT resolution pass — and then the completeness CHECK below could not be
        an ordinary immediate CHECK (it would have to become a deferred constraint trigger). The structural
        key is **already unique** (`match_slot_uniq` on
        `(tournament_id, bracket, bracket_slot, coalesce(gf_order,0))`, [0010_match.sql:112-113]), so
        `advance_match` resolves an edge to a row with one indexed lookup. Simpler, and it keeps the CHECK
        honest.
  - [x] `check (winner_to_side in ('a','b'))` / `check (loser_to_side in ('a','b'))` — the closed-set-text
        convention [ARCHITECTURE-SPINE.md:234].
  - [x] **CHECK `match_routing_complete` — the teeth of D1.** A bracket row with no outbound edge is a
        **brick**: nothing can ever advance out of it, and `match` has **no DELETE grant**, so it is
        unrecoverable. Make it unrepresentable:
        ```sql
        case bracket
          when 'winners'     then winner_to_bracket is not null and loser_to_bracket is not null
          when 'losers'      then winner_to_bracket is not null and loser_to_bracket is null
          else /* grand_final */  winner_to_bracket is null     and loser_to_bracket is null
        end
        ```
        Each arm is exactly the bracket's structural truth: **every** Winners row has a winner edge *and* a
        loser-drop edge; a Losers loser is **eliminated** (the *absence* of the edge **is** the two-loss
        rule — FR-6, [SOLUTION-DESIGN.md:359]); the Grand Final's winner is the **champion** and goes
        nowhere. Assert `winner_to_slot`/`winner_to_side` are non-NULL exactly when `winner_to_bracket` is
        (an edge is all-or-nothing) — same for `loser_to_*`.
        **⚠ Story 4.4 will need to widen the `grand_final` arm** (the AD-21 reset row, `gf_order=2`) — say
        so in the constraint's comment so 4.4 does not read a red suite as a bug.
  - [x] Migration header docstring in the established SCOPE / OUT-OF-SCOPE style (mirror 0010/0011/0012).

- [x] **Task 2 — Migration `0013`: `create or replace function public.generate_bracket(...)` (D1)**
  - [x] **The signature is UNCHANGED** — `(bigint, text, jsonb, jsonb, jsonb)`. `create or replace` with an
        identical signature **preserves the existing EXECUTE grants** ([0011:335-336]), so do **not** drop
        and recreate, and do **not** re-issue the grants.
  - [x] The **only** change: the `insert into public.match (...) select ...` at [0011:276-290] also reads the
        eight edge keys from each `p_matches` element. Emit them from a nested object per edge — TS sends
        `winner_to: {bracket, slot, gf_order, side} | null` and `loser_to: {…} | null` — so the SQL is
        `m -> 'winner_to' ->> 'bracket'`, `(m -> 'winner_to' ->> 'slot')::int`, etc. A JSON `null` edge
        yields SQL NULL on every key, which is exactly what the Losers/Grand-Final arms of the CHECK want.
  - [x] **Everything else in the function is untouched** — every guard, the `FOR UPDATE`, the roster
        re-check, the `bad_skeleton` count, the audit row. Copy it forward verbatim. (Re-read
        [0011_bracket_generation.sql:139-327] and change only the INSERT.)
  - [x] The `match_routing_complete` CHECK is now what rejects a caller that omits the edges — no extra
        assertion is needed inside the function.

- [x] **Task 3 — Migration `0013`: `advance_match` — the whole story (AC1, AC2, D2, D3, D4)**
  - [x] `advance_match(p_match_id bigint, p_actor_steamid64 text, p_emit boolean default true)`
        → `returns jsonb`. `language plpgsql`, `security invoker`, `set search_path = ''`.
        Mirror `generate_bracket` / `declare_match_format` **exactly**: **typed refusals RETURNED, not
        raised**; **every guard before any write**, so a refusal commits nothing.
  - [x] **AC2's TEETH — refuse to advance a match that has not produced a RESULT.** This is what makes
        "consequence, not control" a *mechanism* rather than a comment:
        - `state NOT IN ('bye','forfeit','resolved','manual_resolved')` → `not_resolved`.
          (`declared`/`live`/`awaiting_grace`/`pending` have no result yet; `pending` is *especially*
          important — advancing a Pending match is **precisely** the "advance racing the publish" AD-8
          exists to prevent. `rolled_back` → `not_resolved` too: a rolled-back match advances nobody, and
          un-advancing is 4.7's job.)
        - `winner_entry IS NULL` → `not_resolved`. A result without a winner is not a result.
        - `state = 'void'` → `not_resolved` (it can never be played; nothing arrives, nothing leaves).
        - No such match → `bad_match`.
  - [x] **AC1 — THE CONDITIONAL WRITE.** For a destination `(bracket, slot, gf_order)` resolved through
        `match_slot_uniq`, and a side `a`/`b`, the write is **literally** the AC:
        ```sql
        update public.match d
           set competitor_a = p_entry              -- or competitor_b, per the edge's side
         where d.id = v_dest
           and (d.competitor_a is null or d.competitor_a = p_entry);
        ```
        - **`row_count = 1`** → placed (or it was **already** this exact entry — a replay). **Both are
          success.** That is the idempotency, and it falls straight out of the predicate.
        - **`row_count = 0`** → the slot holds a **different** player. **REFUSE `slot_taken`. Do NOT
          overwrite.** AD-8/§7: *"Re-routing a different winner requires an explicit rollback first"*
          [SOLUTION-DESIGN.md:357-358]. Rollback is Story 4.7.
        - Factor this into one internal helper (e.g. `match_place_competitor(dest, side, entry)
          returns boolean`) — it is called from **four** places (winner, loser, and both of their bye
          cascades) and re-writing the predicate four times is how one of them ends up wrong.
  - [x] **D2 — DROP THE LOSER.** `v_loser := case when m.competitor_a = m.winner_entry then m.competitor_b
        else m.competitor_a end`. It is **NULL for a bye** (one competitor), non-NULL for a
        forfeit/resolved/manual_resolved. Place it via `loser_to_*` under the **same** conditional predicate.
        Skip when either `v_loser` or `loser_to_bracket` is NULL — a Losers-bracket loser is **eliminated**
        (no edge, by construction) and a Grand-Final loser is the runner-up.
  - [x] **D3 — CASCADE THROUGH A WALKOVER.** After **each** placement, look at the destination:
        - `state = 'bye'` **and** `winner_entry IS NULL` → that node is **won unplayed** by the arrival.
          Set `winner_entry` to it **in the same UPDATE that seats the competitor** (the
          `match_winner_is_competitor` CHECK [0010:94-98] requires the winner to already be a competitor —
          two separate statements would violate it on the first). Then **advance from that node too**.
        - `state = 'void'` → **impossible by construction** (a void node has zero possible arrivals —
          [lib/bracket/generate.ts:428]). If you get there, the routing is broken: `raise exception`, do not
          paper over it.
        - `state = 'declared'` → **stop.** It waits for its real opponent.
        - Implement as an explicit **bounded worklist/loop**, not open recursion, and **cap the hops**
          (32 is generous — a 16-bracket's longest chain is < 10). Exceeding the cap means a routing cycle:
          `raise exception`. A `while true` here would be an infinite loop inside an admin transaction.
  - [x] **NEVER A SILENT NO-OP** (the repo's fail-closed convention, [lib/roster.ts:180-182]): every path
        returns something meaningful. The **Grand Final** is the one legitimate "advanced nobody" —
        it has no outbound edge and its winner is the **champion**. Return
        `{ok:true, advanced:0, champion:<winner_entry>}` — a *distinct, positive* outcome, not a bare zero.
  - [x] **D4 — the audit row, INSIDE the transaction.** **One** `audit_log` row per **call**:
        `action='advance'` (**needs no migration** — [0003:25]), `target_match_id` = the **source** match,
        `detail = {winner_entry, loser_entry, hops:[{match_id, entry, side, walkover:bool}, …]}`. One row
        per call (not per hop) keeps a bye cascade legible as the single admin consequence it is.
  - [x] Return `{ok:true, advanced:<n>, champion:<id|null>, hops:[…]}`.
  - [x] Grants: `revoke execute … from public;` **then** `grant execute … to service_role;` —
        `CREATE FUNCTION` grants EXECUTE to PUBLIC by default and anon/authenticated inherit it, so the
        revoke is **load-bearing, not decoration** ([0011:329-336], [0012:480-487] both document exactly this).
        Same for the `match_place_competitor` helper if it is a normal (non-trigger) function.

- [x] **Task 4 — Migration `0013`: the post-commit Broadcast (AC3)** — see **§Decision 1** before writing this.
  - [x] At the end of `advance_match`, when `p_emit` and something actually advanced:
        `perform realtime.send(<payload> , 'bracket.advanced', 'tournament:' || m.tournament_id, false);`
  - [x] **Why this satisfies "emitted only after commit" BY CONSTRUCTION** — and why it is *stronger* than
        a post-commit call from TypeScript: `realtime.send` **inserts a row into `realtime.messages`**
        inside the current transaction, and Realtime ships it off the replication slot. Nothing is
        delivered unless the transaction **commits**; a rollback discards the message with the advance that
        would have caused it. A TS "emit after the RPC returns" can still emit for a transaction that then
        fails, or lose the nudge if the process dies post-commit. **The emit cannot outrun its own commit.**
  - [x] Channel + event naming is **fixed by the spine**, not your choice: `tournament:<id>`, event named by
        semantic change ([ARCHITECTURE-SPINE.md:230], AD-11 [:133]). `private => false` — `tournament:<id>`
        is the **public** channel.
  - [x] `p_emit` exists for **one** reason, and it is AD-6/AD-11: *"**One** Broadcast carries the semantic
        change so the four effects of AD-6 stay atomic on the wire"* [ARCHITECTURE-SPINE.md:133]. When
        Story 4.6's Aprobar calls this **inside** its transaction it may prefer to fold the advance into its
        single `match.approved` message and pass `p_emit => false`. Default `true` so the advance is never
        silently unannounced. **Do not build a second emitter anywhere.**
  - [x] Note in the comment (do not "fix" it): `realtime.send` swallows its own errors by design, so a
        Realtime hiccup can **never** abort an advance. That is correct and it *is* AD-11 — Broadcast is a
        **nudge**, not the source of truth; every viewer surface is reconstructable from a published read
        alone, and a client re-fetches on reconnect.

- [x] **Task 5 — `lib/bracket/generate.ts` — emit the edges (D1). NO NEW ROUTING MATH.**
  - [x] Widen `MatchRow` with `winner_to: EdgeRef | null` and `loser_to: EdgeRef | null`, where
        `EdgeRef = { bracket: BracketName; slot: number; gf_order: number | null; side: 'a' | 'b' }`.
        This is the **existing** `Edge` type [lib/bracket/generate.ts:192-197] in the jsonb shape the RPC
        reads — map it, do not redefine the routing.
  - [x] In `generateBracket`, when each row is `add(...)`ed, populate its edges **by calling the functions
        that are already there and already exhaustively unit-tested**: `winnersWinnerTarget` /
        `winnersLoserTarget` for a Winners row, `losersWinnerTarget` for a Losers row, `null`/`null` for the
        Grand Final. **If you find yourself writing `index ^ 1` or `losersSlot(...)` arithmetic again, stop
        — you are re-deriving what D1 forbids.**
  - [x] The `state` propagation block ([:435-470]) and the bye pre-advance ([:397-408]) are **unchanged**.
        4.1's Winners-R1 bye winners are still seated at generation (their destination row does not exist
        yet at that point — it is the same INSERT); the *Losers* `bye` nodes still land with NULL
        competitors, and **Task 3's cascade is what finally walks them**. That division is 4.1's design and
        it is correct.
  - [x] `generateAndPersistBracket` needs **no change** — it already passes `matches` through to the RPC
        verbatim [:572-578].

- [x] **Task 6 — `lib/bracket/generate.test.ts` (Vitest)**
  - [x] Assert the edges **land as values**, not merely that the key exists — the 4.1 review's headline
        lesson was that a suite asserting shape/counts stays green through a broken payload.
  - [x] Pin the structural invariants for **both** bracket sizes (8 and 16): every `winners` row has both
        edges; every `losers` row has a winner edge and **no** loser edge; the `grand_final` row has
        **neither**; the Winners-Final winner edge is `grand_final/0/gf_order 1/side a` and the Losers-Final
        winner edge is `…/side b` ([:200-210], [:258-261]).
  - [x] **The edges must be a fixpoint of the skeleton:** every edge target `(bracket, slot, gf_order)`
        resolves to a row that **exists** in `matches`, and no two rows share a destination `(row, side)`.
        A duplicated destination slot means two players routed into one seat — assert it is impossible.

- [x] **Task 7 — pgTAP `supabase/tests/0013_advance_test.sql` (AC1, AC2, AC3, D2, D3, D4)**
  - [x] `plan(N)` **exact** count; `begin … rollback`; `create extension if not exists pgtap with schema
        extensions; set local search_path = extensions, public;` (mirror
        [supabase/tests/0012_format_lock_test.sql] / [0011_bracket_generation_test.sql:36-41]). Seed as
        `postgres`, then **`set local role service_role`** to prove the behaviour against the writer that
        actually exists.
  - [x] **AC1 — idempotency, both halves.** Advance a resolved match → the winner lands in the destination
        slot. **Call `advance_match` on it AGAIN** → `ok:true`, the slot is **unchanged**, and **no second
        audit row**… *(decide and pin: a replay writes a second `advance` audit row or it does not — assert
        whichever you implement, and say which in the Completion Notes. Recommended: it DOES, because the
        audit is a log of admin actions, not of state deltas.)*
  - [x] **AC1 — the double-route is REFUSED.** Manually seat a **different** entry in the destination slot,
        then advance → `slot_taken`, and **the destination is unchanged**. This is the assertion the whole
        AC exists for; do not settle for "it did not crash".
  - [x] **AC2 — the result gate bites.** `advance_match` on a `declared` match → `not_resolved`. On `live`
        → `not_resolved`. On **`pending`** → `not_resolved` (**the AD-8 "advance races the publish" case —
        pin it explicitly and by name**). On a `resolved` match with `winner_entry` NULL → `not_resolved`.
        On a `void` row → `not_resolved`. **Each refusal writes NOTHING** (assert the audit count and the
        destination slot are both unchanged).
  - [x] **D2 — the loser drops.** A resolved Winners match → the loser lands in the `losers` row its
        `loser_to_*` names, on the named side. A resolved **Losers** match → the loser goes **nowhere**
        (assert no row anywhere gained a competitor). This is two-loss elimination, and it is proven by an
        **absence** — assert it, or it is not proven.
  - [x] **D3 — THE BYE CASCADE, on a real generated 11-player bracket.** Generate through the real
        `generate_bracket` (do **not** hand-fixture this one). Resolve the Winners-R1 match whose loser
        drops into a `bye` Losers node, advance, and assert the loser **did not stop there**: that node's
        `winner_entry` is now them **and** they have already been seated in the *next* node. Then assert a
        `void` node still has NULL competitors and NULL winner. **This is the assertion that proves the
        Losers bracket does not stall**, and it is the reason the story exists in the shape it does.
  - [x] **D4 — the audit row's COLUMN VALUES.** `action='advance'`, `target_match_id` = the **source**
        match, and `detail` carries `winner_entry`, `loser_entry` **and** the `hops` array.
        **Assert every key** — 4.2's review found that asserting one key of a `jsonb_build_object` lets a
        typo in any of the others NULL the payload with the suite fully green.
  - [x] **AC3 — the Broadcast, and that it is transactional.** After a successful advance, assert a row
        exists in `realtime.messages` with `topic = 'tournament:<id>'` and `event = 'bracket.advanced'`.
        Then assert a **refused** advance (`not_resolved`) emitted **nothing**. *(The whole suite runs in
        `begin … rollback`, which is itself the proof that nothing is delivered without a commit.)*
  - [x] **The 4.2 lock still holds (no regression).** `advance_match` writes `competitor_*` / `winner_entry`
        / `state` and **never** a format column, so the `match_format_audited` constraint trigger
        ([0012:220-239]) must **not** fire. Assert an advance on a **format-locked** match **succeeds** —
        this is the cross-story regression that would otherwise only surface in 4.6.
  - [x] **EXECUTE grant matrix:** `has_function_privilege` — `service_role` = true; `anon` /
        `authenticated` = **false**.

- [x] **Task 8 — REGRESSION: `supabase/tests/0011_bracket_generation_test.sql` WILL go red, and that is correct (D1)**
  - [x] 0011's suite hand-builds its `p_matches` payload — `pg_temp.matches8` [0011_test:125-152] and its
        16-bracket sibling [:154-184] — and **those fixtures now omit the routing edges**, so
        `match_routing_complete` refuses every insert (`23514`) and the generation tests go red.
        **This is the CHECK working, not a bug**: a fixture that no longer resembles what `generateBracket`
        actually emits is a fixture that proves less than it claims (**exactly** the 4.1 review's headline
        finding).
  - [x] **Fix it by making the fixtures TRUE, not by weakening the CHECK.** The reliable way: run the real
        `generateBracket()` (it is pure and deterministic — inject a stub `rng`) for an 8-field and a
        16-field, and paste the **actual** emitted edges into the fixtures as literals. The fixture then
        becomes a golden snapshot of real generator output instead of a hand-guess. **Do not hand-derive
        `index ^ 1` in SQL.**
  - [x] Account for the `plan(N)` delta **exactly** — `plan(65)` today; the repo keeps exact
        assertion-accounting (a standing convention since the Epic-1 retro).
  - [x] Run the **whole** suite: `supabase test db` + `npm test` + `npm run lint` + `npm run build`.
        The **Go worker is untouched** by this story — it never writes `match` (confirmed at 4.2; re-confirm
        with a grep, do not assume).

- [x] **Task 9 — Live-QA: DRIVE A REAL BRACKET TO A CHAMPION (do NOT sign off on unit tests alone)**
  - [x] Fresh `supabase db reset` + [supabase/fixtures/live-qa-bracket-seed.sql] (the standing **11-player**
        field → bracketSize 16 → **30 match rows, 5 byes**). Generate the bracket through the real route,
        then bulk-declare the format through the real 4.2 route (an advance must work on a **locked** match —
        that is the cross-story check).
  - [x] **Now play the whole tournament out via `advance_match`** as `service_role`: set a winner on each
        playable match (`state='resolved'`, `winner_entry`, and the 4.2 CHECK means the format must be
        locked first), call `advance_match`, and repeat until a **champion** falls out of the Grand Final.
        **THE BAR: the bracket must actually complete.** 4.1's live-QA drove a field the review later proved
        *could never reach its Grand Final*, and the re-run was waived. **Do not repeat that.** A completed
        bracket is the only honest proof that D2 + D3 are right.
  - [x] Along the way, assert: **every** `bye` Losers node was walked through (none left with a NULL winner
        once its feeder resolved); **every** `void` node is still untouched; **no** slot ever holds a player
        who did not route there; the losers all landed in the LB; and **`count(*) = 1`** on the champion.
  - [x] **AC1 live:** re-call `advance_match` on an already-advanced match → no double-route, slot
        unchanged. Then hand-seat a different entry and re-advance → **`slot_taken`**, nothing written.
  - [x] **AC3 live:** with a `supabase.channel('tournament:<id>').on('broadcast', {event:'bracket.advanced'})
        .subscribe()` client connected (a throwaway node script is fine), confirm the nudge **arrives** —
        and that a **rolled-back** advance (`begin; select advance_match(...); rollback;`) delivers
        **nothing**. That pair is the whole of AC3.
  - [x] Record the numbers in the Completion Notes: matches advanced, byes cascaded, audit rows written,
        the champion's `roster_entry_id`.

## Decision 1 — how AC3's Broadcast is emitted (decided; overrule at review if you disagree)

**There is no realtime code in this repo at all** (grep: zero hits for `channel(`/`broadcast` in `app/` and
`lib/`), and Epic 5 owns the viewer surfaces (5.7) and the reconnect/nudge story (5.8). So AC3 had to be
decided here rather than inherited.

**Chosen: (a) `realtime.send()` from inside `advance_match`.** Reasons, in order of weight:
1. **It makes "emitted only after commit" true BY CONSTRUCTION**, not by discipline. The message row is
   written **in the advance's own transaction**; Realtime ships it off the replication slot **after** the
   commit. It **cannot** be delivered for an advance that rolled back, and it cannot be lost by a process
   that dies after committing. A TS-side "emit after the RPC returns" fails both of those.
2. **It works unchanged inside Story 4.6's Aprobar transaction.** The advance is called *from SQL*, so a
   TypeScript emitter would have no seam to hook — 4.6 would have to re-derive what the advance did.
3. **Zero dead code.** 4.3 has no TS caller (D5), so a TS emitter would ship unused and untestable-in-anger.
4. It is provable **today**, in pgTAP, against `realtime.messages` — so AC3 does not become an IOU.

**Rejected: (b) a TS post-commit emitter** (`channel.httpSend()` — real, and available on our pinned
`@supabase/supabase-js` 2.110.0, which is ≥ the 2.107.0 that introduced it). It is the more conventional
reading of AD-11's *"server-emitted, post-commit"*, but it needs a TS caller this story does not have, it
cannot see inside 4.6's transaction, and it can emit for a transaction that later fails. **This is the
fallback if Task 0 finds `realtime.send` missing.**
**Rejected: (c) defer AC3 entirely to Epic 5.8.** That is an AC the story would simply not meet.

**Two consequences, stated honestly rather than buried:**
- `tournament:<id>` is a **public** channel per AD-11, so `private => false`. A public Broadcast topic can
  also be *written* by any client — but a spoofed nudge only makes a viewer **re-fetch published truth**
  (AD-11: Broadcast is a *nudge*, never the source of truth), so the blast radius is a wasted read. If
  Cuatro wants it locked down, that is a private channel + an RLS policy on `realtime.messages`, and it
  belongs with **Story 5.8**, uniformly across all three channels — not bolted onto this one.
- **The viewer half of AC3 is not provable in this story** and is not claimed to be: there is no subscriber
  surface until Epic 5.7. Task 9 proves the message **is emitted, post-commit, on the right channel, with
  the right event**, using a throwaway subscriber. That is the whole of what 4.3 can honestly own.

## Dev Notes

### What 4.3 ships, and what it deliberately does not

**4.3 OWNS:** the routing edges on `match` (D1), the `advance_match` function — conditional (AC1),
result-gated (AC2), loser-dropping (D2), bye-cascading (D3), audited (D4) — the post-commit Broadcast (AC3),
the `generate_bracket` replacement that persists the edges, and the pgTAP + live-QA that prove a real
11-player bracket **completes**.

**4.3 SHIPS NO ROUTE AND NO NEW TS MODULE.** The only TypeScript it touches is `lib/bracket/generate.ts`
(emit the edges) and its test. There is no `lib/match/advance.ts` and no `app/api/admin/advance/route.ts` —
**AC2 forbids the control, and 4.5/4.6 call the SQL function from inside their own transactions.** If you
feel the urge to add a route "so it can be demonstrated", re-read D5: pgTAP and Task 9's SQL *are* the
demonstration, and they are a **better** one, because the guard binds every writer rather than one endpoint.

**OUT OF SCOPE — do NOT build here** (each has an owning story; building it now is scope creep):
- **The `declared → live` transition.** Still unowned (4.2 flagged it; see below). Not yours.
- **The Grand-Final RESET row (`gf_order=2`, AD-21)** → **Story 4.4.** 4.3 treats the single `gf_order=1` row
  as terminal (its winner is the champion). 4.4 widens the `match_routing_complete` grand-final arm.
- **Forfeit / `awaiting_grace` / the 10-min grace timer / `mark_walkover`** → **Story 4.5.** 4.3 *accepts*
  `state='forfeit'` as an advanceable result (D2's loser expression already handles it) but **does not
  create it**.
- **Aprobar / the demo-derived score / `state='resolved'` / `demo_id` binding** → **Story 4.6.** 4.3 writes
  **no score and no state**: it *reads* a result someone else committed. In pgTAP and live-QA you will set
  `state='resolved'` + `winner_entry` **by hand** — that is a fixture, not a feature.
- **Rollback / un-advance** → **Story 4.7.** `slot_taken` is the *refusal* that points at it. Do not build a
  force-overwrite escape hatch: AD-8 says re-routing requires an explicit rollback first.
- **`tournament.final_match_id`** — the column exists ([0001_core_schema.sql:31], FK closed by 4.1) and is
  tempting the moment you compute a champion. **Leave it dormant.** Which row is the *last* GF row is
  **4.4's** question (the reset row), and writing it now would be wrong for exactly the field 4.4 exists to
  handle.
- **The reusable audited-command-route helper** → 4.9. **CSRF** → Epic 7, uniformly ([deferred-work.md]).
- **Viewer/admin UI, Spanish copy, the `Avanzar` affordance, the bracket map** → **Epic 5.**

### The three things that will break this story if you skip them

They are D1, D2 and D3, and each one is fatal on its own:

| If you skip… | What happens |
|---|---|
| **D1** (persist the edges) | You will be tempted to port `index ^ 1` into plpgsql. Now the routing has **two** implementations and the DB's copy is the one nobody unit-tests. 4.1 wrote its routing functions as **exports** specifically to stop this. |
| **D2** (drop the loser) | The Losers bracket never receives **anybody**. The Grand Final's side B never fills. **No tournament can ever finish**, and every test that only advances winners still passes. |
| **D3** (cascade through byes) | The 11-player fixture — the *only* field this project has ever live-QA'd — has **10 `bye`/`void` rows**. A loser drops into a `bye` node, waits forever for an opponent who cannot exist, and the Losers bracket **stalls at the first walkover**. |

### Read these two files before you write a line of DDL

- **[lib/bracket/generate.ts]** — in particular the header's `OUT OF SCOPE` block (**lines 28-40**), which
  is addressed to *this story by name* and states the bye/void contract in capitals; the `Edge` type
  (**192-197**); and the three routing functions (**200-276**) whose doc-comments explain *why*
  `index ^ 1` is a swap and not a reversal. You are **consuming** these, not rewriting them.
- **[supabase/migrations/0010_match.sql]** — the CHECKs you must not trip:
  `match_winner_is_competitor` (**94-98** — the winner must *already* be a competitor, which is why D3's
  walkover seats the competitor and the winner in **one** UPDATE), `match_distinct_competitors` (**100-102**),
  the `state` closed set (**64-65**), `match_slot_uniq` (**112-113** — the index D1's edge lookup rides on),
  and the grant matrix (**227**: service_role has SELECT/INSERT/**UPDATE**, deliberately **no DELETE**).

### The 4.2 lock is armed, and the advance must live with it

Migration 0012 put **two CHECKs and two triggers** on `match`. Three of the four are irrelevant to you, and
knowing *why* will save you a confused hour:

- **`match_format_audited`** (constraint trigger, [0012:220-239]) fires **only** when `format`,
  `tie_policy`, `format_locked` or `format_overridden_at` change. The advance touches **none** of them, so
  it is a **no-op** for this story — 0012's own comment says exactly that ([0012:217-219], naming 4.3).
  **Do not go anywhere near a format column**, and it stays that way.
- **`match_live_requires_locked_format`** ([0012:123-126]) refuses `live`/`pending`/`resolved`/
  `manual_resolved` on an **unlocked** match. **This bites your fixtures, not your code**: to fixture a
  `state='resolved'` match you must **declare + lock its format first**. `bye`/`void`/`forfeit` are
  **excluded on purpose**, so a bye fixture needs no format — which is exactly why the D3 cascade tests are
  cheap to set up.
- **`match_format_lock`** (the latch) and **`match_format_lock_complete`**: not your business at all.

⚠ **`P0001` is already spoken for.** [lib/match/format.ts:106] maps any `P0001` from *its* RPC to
`already_locked`, and [deferred-work.md] carries the open item that this becomes ambiguous *"the moment a
second `match` trigger raises it"*. **You are not adding a raising trigger** (`advance_match` is a plain
function returning typed refusals), so you do not trip it. **Keep it that way** — a `raise exception` in an
advance would have to be given a distinct SQLSTATE, and there is no reason to raise: everything expected is
a typed refusal.

### Command/RPC pattern — copy 4.1 and 4.2, do not invent

```
(no route — AC2/D5)
  4.5 forfeit txn ─┐
  4.6 Aprobar txn ─┴─> advance_match(match_id, actor)      ← 0013, this story
                          ├─ result gate (AC2) ─────────────> not_resolved
                          ├─ conditional place (AC1) ───────> slot_taken
                          ├─ loser drop (D2) + bye cascade (D3)
                          ├─ audit row (D4)
                          └─ realtime.send (AC3, post-commit by construction)
```

- **Typed refusals, RETURNED not raised**, for every expected outcome ([0011:134-138], [0012:261-263]).
- **Every guard before any write**, so a refusal commits nothing.
- **Audit inside the transaction** — 4.1 flagged this as a strict improvement on `lib/roster.ts`'s
  after-the-fact `writeAudit` ([0011:304-307]).
- **`service_role`-only EXECUTE grant**, with the `revoke … from public` **first** ([0011:329-336]).
- **Never a silent no-op** ([lib/roster.ts:180-182]) — but *do* distinguish an **idempotent replay**
  (success) from a **nothing-happened** (refusal). AC1 makes the replay a first-class success.

### Previous-story intelligence (4.1 and 4.2 — the lessons that cost the most)

Both were reviewed hard (4.1: 2 decisions + 11 patches; 4.2: 2 decisions + 12 patches, **all applied**), and
their findings map almost one-to-one onto the traps here:

- **"The suites proved materially less than they claimed."** (4.1's headline, and 4.2's again.) Both
  suites asserted **row counts** where a broken `jsonb_build_object` key would have NULLed the payload with
  the tests green. → **Task 7 asserts the audit `detail`'s every key**, and Task 6 asserts edge **values**.
- **"The LIVE run caught what 510 green pgTAP assertions did not."** (4.2.) The suite tested the easy half
  of the gate. → **Task 9 is not a formality**: the bracket must actually **complete**. A green suite that
  never routed a loser into a walkover proves nothing about D3.
- **"An empty payload committed an unrecoverable live tournament."** (4.1.) The RPC trusted its caller. →
  `advance_match` **re-reads the match and its edges from the DB**; it takes a `match_id`, never a
  destination. And `match_routing_complete` means a caller cannot hand it a bracket with no exits.
- **"The trigger ignored `OLD` — guard BOTH ends of a state change."** (4.1's D3.) → AC1's predicate guards
  the destination **as it is**, and `slot_taken` refuses rather than overwriting.
- **4.1's live-QA drove an 11-player field the review then proved could never reach its Grand Final**, and
  the re-run was **waived by Cuatro** (recorded honestly in the story and in sprint-status). **This story is
  the one that repays that debt** — if a real 11-player bracket now completes end to end, that gap is closed
  for good. If it does *not* complete, you have found a real bug in 4.1's routing, and that is a finding,
  not a blocker to hide.
- **This is SQL + app/lib (TypeScript) work.** Ground your patterns in Story 4.1/4.2 and Epic 2 — **not** the
  Go worker (all of Epic 3). The worker does not touch `match` at all.

**Retro action items:** none are homed to 4.3. The two still open (**epic-3 #4**: Story 4.6 absorbs deferred
3.7; **epic-3 #5**: the Epic-5 conservation-gate relaxation) belong to later stories and only inform the
OUT-OF-SCOPE boundary above. 4.1 closed epic-2 #7 and epic-3 #3.

### The ownership gap 4.2 surfaced is still open (do not fix it here)

**No Epic-4 story owns the `declared → live` transition.** 4.2 installed the CHECK that makes it *born safe*
and flagged the gap; [deferred-work.md] additionally records that **nothing in TypeScript maps `23514`**, so
whoever lands that transition owes a friendly *"declare the format first"* refusal.

**4.3 does not close it, and does not need to.** The advance reads a *terminal* result state
(`bye`/`forfeit`/`resolved`/`manual_resolved`); it never sets `live`. Your fixtures set the terminal state
directly. Most likely home remains 4.5 or the Epic-5 admin console — still worth pinning before 4.5 is
written.

### Testing requirements (conventions — non-negotiable)

- **pgTAP** ([supabase/tests/NNNN_<name>_test.sql], `supabase test db`): `create extension if not exists
  pgtap with schema extensions; set local search_path = extensions, public;` then **`select plan(N)`** with an
  **exact** count (standing convention since the Epic-1 retro); `begin … rollback` so nothing persists; seed
  as `postgres` (bypasses RLS), then `set local role service_role` to prove the guards bite the real writer.
  SQLSTATEs: `23514` CHECK · `23502` not-null · `23503` FK · `23505` unique · `42501` insufficient_privilege ·
  `P0001` a plpgsql raise.
- **Vitest** (`npm test` → `vitest run`, pinned `vitest@4.1.9`): colocated `*.test.ts`; injected clients; the
  `.rpc()`-capable mock is at [lib/bracket/generate.test.ts:536-575] (do **not** rebuild it from
  `lib/roster.test.ts` — that one predates `.rpc()`).
- **Both layers required, plus the human gate:** the routing + edge emission ⇒ Vitest; the CHECK, the
  function, the cascade, the audit and the Broadcast ⇒ pgTAP; **a real bracket reaching a champion ⇒ Task 9**,
  never "unit tests pass" alone.

### Latest tech / versions (all pinned — no upgrade needed)

From [package.json] + [ARCHITECTURE-SPINE.md#Stack]: Next.js **16.2.10** (App Router, Node ≥20.9),
`@supabase/supabase-js` **2.110.0**, `@supabase/ssr` **0.12.0**, TypeScript **5.9**, Vitest **4.1.9**,
Supabase Postgres **15+**, pgTAP (in `extensions`). **No new dependency is required.**

**The one API this story does not already use:** `realtime.send(payload jsonb, event text, topic text,
private boolean)` — Supabase's *Broadcast from the Database*. It inserts into `realtime.messages`, which
Realtime tails off the replication slot, so delivery is **post-commit by construction**; it defaults to
`private => true` (pass `false` for the public `tournament:<id>` channel) and it **swallows its own errors**
so a Realtime fault cannot break the caller's transaction. `[realtime] enabled = true` locally
([supabase/config.toml:87-88]). **Task 0 verifies it exists before you build on it.**
For the record, the TS fallback in Decision 1(b) is `channel.httpSend()` — it always uses the REST API and
needs no WebSocket subscription; it landed in `@supabase/supabase-js` **2.107.0** and we are on **2.110.0**.

### Git intelligence (recent commits)

`7208608` (4.2 → done, the AD-10 lock) · `5b398ec` (4.1 code-review → done, 11 patches) · `8cde0a2` (4.1
implementation) · `d8c5277` (Epic-3 retro close-out) · `0bef580` (the standing live-QA fixture). Working tree
clean, branch `main`. The immediately relevant artifacts are 4.1's and 4.2's: migrations **0010 / 0011 /
0012**, `lib/bracket/`, and `supabase/fixtures/live-qa-bracket-seed.sql` (the 11-player field Task 9 reuses).
**4.3 builds directly on all three migrations — read them before writing 0013.**

### Project Structure Notes

New files land where the spine's source tree puts them ([ARCHITECTURE-SPINE.md:437-452]):
`supabase/migrations/` = the shared schema+RLS contract. Expected additions:
`supabase/migrations/0013_advance.sql`, `supabase/tests/0013_advance_test.sql`.
Modified: `lib/bracket/generate.ts` (+ `.test.ts`) — the edges; `supabase/tests/0011_bracket_generation_test.sql`
— the deliberate regression (Task 8).
**No new directory, no new route, no new lib module** — see D5. `lib/bracket/` is already scoped to
*"double-elim routing, idempotent advance, two-loss-from-edges"* [ARCHITECTURE-SPINE.md:445], which is
literally this story; the advance itself lives in SQL because that is where its caller will be.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3 (lines 674-694)] — the three ACs + traces;
  #Epic 4 (630-632); #Story 4.4 (696-716), #4.5 (718-739), #4.6 (741-761), #4.7 (763-783) — the OUT-OF-SCOPE
  boundaries; #Story 4.9 (803-819) — the audited-command-route helper that generalizes this.
- [Source: ARCHITECTURE-SPINE.md] — **AD-8 (115-118)** the whole story in four lines, incl. *"never an
  independent button that races publish"*; **AD-11 (130-133)** Broadcast is a nudge, post-commit, channel
  `tournament:<id>`, *"one Broadcast carries the semantic change"*; AD-6 (105-108) the Aprobar txn that will
  call this; AD-9 (120-123) bye/forfeit produce zero stats; AD-21 (180-183) the GF reset → 4.4; AD-17
  (160-163, `advance` enumerated); AD-23 (190-193); Match-lifecycle diagram (299-317); Consistency
  Conventions (225-235, incl. *"Idempotency keys … advance keyed on destination slot"* at 232 and the
  channel/event naming at 230); Structural Seed (435-452).
- [Source: SOLUTION-DESIGN.md] — **§7 (357-359)**: *"Advance (FR-7): admin-only, server-gated, **idempotent**
  — `SET occupant = winner WHERE slot IS NULL OR occupant = winner`. Re-routing a different winner requires
  an explicit rollback first."* and *"Two-loss elimination (FR-6) is derived from bracket edges, never a
  stored flag."* · **§8 (370-375)** — the Aprobar transaction lists *"(3) idempotent bracket advance"* as one
  of four effects of **one** transaction, then *"**After commit only**, emit one Broadcast on
  `tournament:<id>`"*; the Realtime topology (381-383). · `audit_log.action` vocabulary (251).
- [Source: prd.md] — **FR-7 (183-190)**: the advance propagates to viewers in real time; *"Advancing is
  idempotent: re-issuing the same advance does not double-route a Player"*; **and the tap/drag control that
  AD-8 overrides — see D5**. FR-6 (elimination derivable), FR-8 (byes), FR-13 (245-246: Pending stats are
  *"excluded from … Bracket advancement"*), FR-31 (the feed posts advances → 4.6/5.6); NFR ~2s (530).
- [Source: EXPERIENCE.md] — `{components.advance-control}` (87) and Interaction Model (130) — the `Avanzar`
  tap/drag affordance **that this story deliberately does not build** (D5); Live & Realtime (156-160);
  `{components.bye-badge}` "Pase directo" (99) → Epic 5.
- [Source: lib/bracket/generate.ts] — **the header's OUT-OF-SCOPE block (28-40), addressed to this story by
  name**; `Edge` (192-197); `winnersWinnerTarget` (200-210), `winnersLoserTarget` (231-248, incl. why
  `index ^ 1`), `losersWinnerTarget` (258-276); the bye state propagation (413-470); `generateAndPersistBracket`
  (542-616).
- [Source: supabase/migrations/0010_match.sql] — the columns (46-103), `match_winner_is_competitor` (94-98),
  `match_distinct_competitors` (100-102), the `state` closed set (64-65), `match_slot_uniq` (112-113), the
  `(tournament_id, bracket)` index (117) explicitly noting *"4.3's advance walks one bracket of one event"*,
  the grant matrix (227). · [0011_bracket_generation.sql] — the RPC to `create or replace` (139-327), the
  INSERT to widen (276-290), the grant pattern (329-343). · [0012_format_lock.sql] — the two CHECKs (107-126)
  and the constraint trigger's `when` clause (220-239) that **excludes** this story's writes by design. ·
  [0003_audit_snapshot.sql] — `action` free text + the `advance` vocabulary (25), `target_match_id` (26),
  `actor_steamid64 not null` (24).
- [Source: supabase/tests/0011_bracket_generation_test.sql] — `plan(65)` (41) and **the fixtures Task 8 must
  fix** (`pg_temp.matches8` at 125-152 and its 16-bracket sibling). · [0012_format_lock_test.sql] — the pgTAP
  conventions for an RPC + trigger suite.
- [Source: _bmad-output/implementation-artifacts/4-1-…md] and [4-2-…md] — Review Findings + "Review Fixes
  Applied": the suite-proves-less-than-it-claims, untrusted-payload, and live-run-caught-what-the-suite-missed
  lessons this story is written against.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the `P0001` ambiguity (do not add a
  raising trigger), the unmapped `23514` (not yours), CSRF → Epic 7, `score_source_guard` → 4.6.

### Open questions for Cuatro (answer at review; none block implementation)

1. **The `Avanzar` control (D5).** PRD FR-7 and the UX both describe an admin tap/drag advance button;
   AD-8 and the epic's AC2 both forbid an independent advance control. **I have implemented AC2** (advance is
   a consequence only, no route). If you want a literal `Avanzar` button, the honest way is for it to *be* the
   result-entry action (Aprobar / W.O.) — which is 4.5/4.6 + the Epic-5 console, not a separate advance
   endpoint. Say the word if you read AD-8 differently.
2. **Decision 1 — the Broadcast mechanism** (`realtime.send()` from SQL vs. a TS post-commit emitter). See
   the decision section: the SQL route makes AC3 true by construction and needs no caller, but it is the less
   conventional reading of AD-11's *"server-emitted"*. Also worth your call: **public vs private**
   `tournament:<id>` (AD-11 says public; a public topic is client-writable, and a spoofed nudge costs a
   wasted re-fetch).
3. **Does an idempotent replay write a second `advance` audit row?** I have recommended **yes** (the audit is
   a log of admin *actions*, not of state deltas — and a silent second call is exactly the double-tap AD-8 is
   worried about, so it is worth seeing). Trivial to flip.
4. **The 11-player field, again.** Task 9 demands a bracket that reaches a champion — which 4.1's field
   reportedly could not. If it stalls, that is a **4.1 routing bug surfaced by 4.3**, and I would rather fix
   it here than ship a bracket that cannot finish. Flagging so it is not a surprise mid-story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (`claude-opus-4-8`) via `bmad-dev-story`.

### Debug Log References

**Task 0 — the one external assumption, verified before anything was built on it.**
`realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true)` EXISTS on the local
stack (`prosecdef = f` — SECURITY INVOKER). Its body wraps the INSERT in `EXCEPTION WHEN OTHERS -> RAISE
WARNING`, confirming the story's claim that it swallows its own errors. `service_role` holds EXECUTE on it
and INSERT on `realtime.messages`. **Decision 1(a) therefore stands; the TS `channel.httpSend()` fallback
was NOT needed.**

⚠ **One thing Task 0 did not anticipate, found by inspection:** `realtime.messages` is **RANGE-partitioned
on `inserted_at`**, and its partitions are created by a Realtime **background job**. Since `realtime.send`
swallows errors, a missing partition would make the emit fail **silently** and turn AC3's pgTAP red for a
reason unrelated to this story. The suite now creates the day's partition if absent (a no-op in the normal
case, rolled back with everything else) rather than trusting a background job.

**⭐ MUTATION TESTING — and it found a real hole in my own suite.** The 4.1 and 4.2 reviews *each* found
that "the suite proved materially less than it claimed", so the 79 assertions were not trusted just because
they were green. Four defects were injected into the shipped SQL and the suite re-run:

| Injected defect | Suite result |
|---|---|
| Remove the **loser drop** (D2) | **7 red** — incl. *"D2: THE LOSER DROPPED"* |
| Remove the **bye cascade** (D3) | **4 red** — incl. *"D3 ⭐⭐ …AND THEY DID NOT STOP THERE"* |
| **One-pass** (write before validating the cascade) | **1 red** — *"THE WINNER WAS NOT PLACED EITHER"* |
| **Delete AC1's `WHERE slot IS NULL OR = winner`** | ⚠ **ALL 76 GREEN — NOT CAUGHT** |

Deleting **Acceptance Criterion 1 itself** left the suite fully green. The cause is structural:
`advance_match` validates the whole cascade under `FOR UPDATE` in pass 1, so by the time pass 2 calls
`match_place_competitor` the seat is already known to be free (or already ours) and the predicate never gets
to decide anything. It is a genuine backstop — and it was an **untested** one, which is how a backstop
quietly stops working. It is *not* dead code: the helper is granted to `service_role`, so 4.5/4.6 can call
it **without** pass 1 in front of it. → **Section L (+3) was added to assert the predicate directly**, and
the suite now goes red on that mutation. Section F/G were also **reordered** (D3 before D2) so a broken
cascade reports itself instead of aborting the file on a downstream fixture.

**Two live-QA harness bugs worth recording, because both produced a FALSE GREEN.** (1) The first
`slot_taken` check seated an "intruder" who happened to *be* the winner — so the conditional predicate
correctly read it as a replay and succeeded. (2) The second seated an intruder who was already the
destination's other competitor, so `match_distinct_competitors` **rejected the poison itself**; the failed
UPDATE left the real winner in the seat and the advance then succeeded as an honest replay — and the error
was being ignored. Both now assert the poison actually landed before claiming `slot_taken` proves anything.
**The code was right in both cases; the test was lying.**

### Completion Notes List

**🏆 THE BAR IS MET: A REAL 11-PLAYER BRACKET REACHED A CHAMPION.** Story 4.1's live-QA drove a field the
code review later proved could never reach its Grand Final, and the re-run was waived. **That debt is
repaid.** Driven end-to-end over the real `supabase-js -> PostgREST -> RPC` seam against the local stack,
using the **production** module (`generateAndPersistBracket`) and the **production** RPCs:

| | |
|---|---|
| Field / bracket | 11 players -> bracketSize 16 -> **30 rows**, byeSeeds [1,2,3,4,5] |
| Never-played rows | **9 `bye` + 1 `void`** = the 10 the story predicted |
| Format (real 4.2 RPC) | **20 locked**, all 10 bye/void rows correctly left alone |
| **Advances** | **21** calls, **4 walkover cascades** |
| **Champion** | **`roster_entry` 1** — `count(*) = 1`, and it is the GF's `winner_entry` |
| Byes left un-walked | **0** ⭐ (a stalled walkover *is* the D3 failure) |
| Void nodes touched | **0** |
| Losers bracket | **13/14** nodes received a dropped player ⭐ (D2: the LB actually fills) |
| Audit rows | **21** `advance` rows — one per call |

**AC1 live:** re-advancing an already-advanced match changed **nothing** (`ok:true`, zero double-routes);
seating a genuinely different player in a destination seat then re-advancing returned **`slot_taken`** and
**wrote nothing at all**.
**AC3 live, BOTH halves:** a real **ANON** client subscribed to `tournament:1` over a WebSocket received
**20 `bracket.advanced` broadcasts** on the public channel; and a **rolled-back** advance left its message
row **discarded with the transaction** (21 inside the open txn -> 20 after `rollback`). *The emit cannot
outrun its own commit.*

**What shipped** — `0013_advance.sql` (one migration, one concern):
- **D1 — the routing edges.** Eight structural columns (`bracket`/`slot`/`gf_order`/`side` per edge),
  resolved through the existing `match_slot_uniq` index — **no self-FK, no post-INSERT pass**, so the
  completeness CHECK can stay an ordinary immediate CHECK. `match_routing_complete` makes a **brick** (a
  bracket row with no way out) unrepresentable. The routing keeps **exactly one implementation**: TS emits
  the edges by calling 4.1's already-exported functions. **There is no `index ^ 1` anywhere in SQL.**
- **AC1** — the conditional write, factored into `match_place_competitor`, which is *literally* the AC.
- **AC2** — the result gate. `not_resolved` for `declared`/`live`/`awaiting_grace`/**`pending`**/`void`/
  `rolled_back`/winner-less. **No route, no `Avanzar` endpoint** (D5) — the advance is granted to
  `service_role` and called from inside 4.5's/4.6's transactions. The build's route list confirms it.
- **D2 the loser drop / D3 the bye cascade / D4 the audit row / AC3 the Broadcast.**

**⭐ A DESIGN POINT THE STORY DID NOT SPECIFY, AND IT IS LOAD-BEARING: `advance_match` IS TWO PASSES.** A
typed refusal **RETURNS**; it does not raise, so it does **not** roll the caller's transaction back. A
one-pass advance that placed the winner and *then* hit `slot_taken` on the loser drop would hand the caller
`{ok:false}` with **a half-applied advance committed underneath it**. So pass 1 walks the whole cascade
read-only (taking `FOR UPDATE` on every row it resolves, so the plan cannot go stale) and validates every
placement; pass 2 applies them. **A refusal has written nothing.** This is the repo's "every guard before
any write" convention, and here it is a correctness requirement rather than a style. Pinned by the
⭐⭐ assertion in Section J *and* by the one-pass mutation.

**Deadlock note:** every lock is taken in **topological order** (a node before its successors), because
that is the only direction the DAG is walked — so two concurrent advances cannot form a cycle.

**Answers to the story's open questions (3 of 4 were mine to decide; #1 and #2 are yours):**
1. **The `Avanzar` control (D5).** Implemented **as AC2/AD-8 specify**: advance is a consequence only,
   there is no route and no button. PRD FR-7 and `EXPERIENCE.md:87` describe a tap/drag control; the
   architecture deliberately overrode them and the epic's AC2 restates AD-8 verbatim. **Flagged for you.**
2. **Decision 1 — the Broadcast.** `realtime.send()` from inside the function, as recommended. Task 0
   confirmed the API exists, and AC3 is now provable *by construction* rather than by discipline.
   Still open for you: **public vs private `tournament:<id>`** (AD-11 says public; a public topic is
   client-writable, and a spoofed nudge costs a wasted re-fetch — locking it down belongs with **5.8**,
   uniformly across all three channels, not bolted onto this story).
3. **Does an idempotent replay write a second audit row?** **YES**, as recommended and as asserted: the
   audit is a log of admin *actions*, not of state deltas, and a silent double-tap is exactly what AD-8
   wants visible. The bracket is unchanged either way — that is AC1's idempotency, and it is pinned.
4. **The 11-player field.** It **completes**. No 4.1 routing bug was surfaced; 4.1's routing is correct.

**Deviation from the spec, stated rather than buried:** the audit `detail` carries a fourth key,
**`champion`** (NULL except on the Grand Final), beyond the story's `{winner_entry, loser_entry, hops}`.
Every key is asserted in pgTAP.

**⚠ KNOWN REGRESSION — WIDER THAN TASK 8 PREDICTED, AND IT IS THE CHECK WORKING.** Task 8 anticipated that
`0011_bracket_generation_test.sql`'s hand-built fixtures would go red. They did — **and so did
`0010_match_test.sql` and `0012_format_lock_test.sql`**, which also hand-build `match` rows. Same class,
same cause: fixtures that no longer resemble what the generator emits. **Fixed by making the fixtures true,
never by weakening the CHECK.** 0011's edges are a **golden snapshot of real `generateBracket()` output**
(dumped, not hand-derived — the crossed `index ^ 1` drops are exactly what a hand-written fixture gets
wrong). 0010/0012's rows declare a structurally legal exit at a deliberately non-existent slot 999, with
the boundary stated in-file: the CHECK's contract is that a row **declares** an exit, not that the exit
resolves (there is no self-FK); that every *real* edge resolves is proven in `generate.test.ts` (the edge
set is a fixpoint of the skeleton) and `advance_match` raises on a dangling edge.
**⚠ And it was load-bearing, not cosmetic:** a `match_routing_complete` violation is **23514** — the *same*
SQLSTATE those suites' `throws_ok`s assert for `match_gf_order_guard` / `score_source_guard` / the closed
sets, which check the code and **not** the message. Without valid edges every one of those would have gone
green **while actually failing on the routing CHECK** — passing for the wrong reason.

**Story 4.4 must widen the `grand_final` arm of `match_routing_complete`** (the AD-21 reset row gives
`gf_order=1` a conditional winner edge). Said so in the constraint's own comment so 4.4 does not read a red
suite as a bug.

**GATES: pgTAP 591** (512 -> +79) **· Vitest 212** (194 -> +18) **· lint 0 · build 0 · go build/vet clean.**
The Go worker is untouched, and re-confirmed by grep (not assumed) to contain no SQL touching `match`.

### File List

| File | Change |
|---|---|
| `supabase/migrations/0013_advance.sql` | **NEW** — the 8 routing columns + `match_routing_complete` (D1); `create or replace generate_bracket` (same signature, so the 0011 grants survive; only the INSERT changed); `match_place_competitor` (AC1's predicate); `advance_match` (AC1/AC2/D2/D3/D4 + AC3's Broadcast); service-role-only EXECUTE grants. |
| `supabase/tests/0013_advance_test.sql` | **NEW** — pgTAP `plan(79)`. Every fixture bracket is generated by the REAL RPC from a golden snapshot of real `generateBracket()` output. Section L exists because mutation testing proved the suite could not see AC1's predicate. |
| `lib/bracket/generate.ts` | `EdgeRef` + `winner_to`/`loser_to` on `MatchRow`; `generateBracket` populates them by **calling 4.1's exported routing functions** — no new routing math. |
| `lib/bracket/generate.test.ts` | +18 assertions: the edges land as **values** (not merely keys), are a **fixpoint** of the skeleton (every target exists; no two edges share a seat), and the exact-key-set pin updated for the two new payload keys. |
| `supabase/tests/0011_bracket_generation_test.sql` | Fixtures now carry the edges — a **golden snapshot of real generator output**. `plan(65)` unchanged (fixtures only). |
| `supabase/tests/0010_match_test.sql` | Hand-built `match` rows now declare their exits (the unpredicted half of the Task-8 regression). `plan(69)` unchanged. |
| `supabase/tests/0012_format_lock_test.sql` | Same. `plan(78)` unchanged. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | 4.3 -> review. |
| `_bmad-output/implementation-artifacts/4-3-idempotent-conditional-advance.md` | This file. |

## Change Log

| Date | Change |
|---|---|
| 2026-07-14 | **Story 4.3 IMPLEMENTED via `bmad-dev-story` → review.** Baseline `7208608`. **🏆 THE BAR IS MET: a real 11-player bracket was driven to a CHAMPION** over the production `supabase-js → PostgREST → RPC` seam — 30 rows, 9 bye + 1 void, 20 formats locked, **21 advances, 4 walkover cascades, 0 byes left un-walked, 0 voids touched, 13/14 Losers nodes filled, 21 audit rows, exactly one champion.** The debt 4.1's waived live-QA left open is repaid, and 4.1's routing is vindicated (no bug surfaced). **Task 0 passed** — `realtime.send` exists, so Decision 1(a) stands and the TS fallback was not needed; it also surfaced that `realtime.messages` is **day-partitioned by a background job**, and since `realtime.send` swallows its own errors a missing partition would have made AC3 fail *silently*, so the suite now guarantees its own precondition. Migration `0013_advance.sql` = **D1** the eight structural routing columns + `match_routing_complete` (a bracket row with no exit is a **brick** and `match` has no DELETE grant, so it is made unrepresentable) + `create or replace generate_bracket` (identical signature → the 0011 grants survive; only the INSERT changed) + **`match_place_competitor`** (AC1's predicate, written once) + **`advance_match`** (AC2's result gate incl. **`pending`** by name; **D2** the loser drop; **D3** the bye cascade; **D4** the audit row; **AC3** `realtime.send` post-commit *by construction*). **NO ROUTE, NO `Avanzar` BUTTON** (D5/AC2 — confirmed by the build's route list). **⭐ A DESIGN POINT THE STORY DID NOT SPECIFY AND IT IS LOAD-BEARING: `advance_match` is TWO PASSES.** A typed refusal RETURNS — it does not raise — so it does **not** roll the caller's transaction back; a one-pass advance that placed the winner and *then* hit `slot_taken` on the loser drop would return `{ok:false}` with a **half-applied advance committed underneath it**. Pass 1 validates the whole cascade read-only under `FOR UPDATE`; pass 2 applies it. Locks are taken in topological order, so concurrent advances cannot deadlock. **⭐⭐ MUTATION TESTING FOUND A REAL HOLE IN MY OWN SUITE, and this is the finding worth keeping:** four defects were injected — removing the loser drop (7 red), removing the bye cascade (4 red), one-pass writes (1 red) — but **DELETING ACCEPTANCE CRITERION 1 ITSELF (`WHERE slot IS NULL OR = winner`) LEFT ALL 76 ASSERTIONS GREEN**, because pass 1's validation reaches the same verdict first and the predicate never decides anything. It is a real backstop (the helper is granted to `service_role`, so 4.5/4.6 can call it *without* pass 1) and it was an **untested** one. → **Section L (+3) asserts the predicate directly**, and D3/D2 were reordered so a broken cascade names itself instead of aborting on a downstream fixture. The 4.1/4.2 reviews each found a version of "the suite proved less than it claimed"; this is that lesson applied **before** the review rather than after it. **KNOWN REGRESSION, WIDER THAN TASK 8 PREDICTED, AND IT IS THE CHECK WORKING:** 0011's hand-built fixtures went red as forecast — **and so did 0010's and 0012's**, which also hand-build `match` rows. Fixed by making the fixtures TRUE (0011's edges are a **golden snapshot of real `generateBracket()` output**, dumped not hand-derived; 0010/0012's rows declare a legal exit at a deliberately non-existent slot 999), **never** by weakening the CHECK — and it was **load-bearing**: a routing-CHECK violation is **23514**, the *same* SQLSTATE those suites' `throws_ok`s assert for other constraints while checking only the code and not the message, so edge-less fixtures would have let those tests pass **for the wrong reason**. Open questions answered: a replay **does** write a second audit row (the audit logs *actions*, not deltas); the `Avanzar` control is implemented as AD-8 (flagged for Cuatro); public-vs-private `tournament:<id>` deferred to **5.8**. Deviation stated: the audit `detail` carries a fourth key, `champion`. **Story 4.4 must widen the `grand_final` arm of `match_routing_complete`** — said so in the constraint's comment. GATES: **pgTAP 591** (512→+79) **· Vitest 212** (194→+18) **· lint 0 · build 0 · go clean** (worker re-confirmed by grep, not assumed, to never touch `match`). |
| 2026-07-14 | Story 4.3 contexted via `bmad-create-story` → ready-for-dev. **The bracket's routing lives only in TypeScript and the advance must run inside 4.6's SQL transaction — so the edges must be PERSISTED (D1)**, consuming 4.1's already-exported edge functions rather than porting `index ^ 1` to plpgsql. Three derived requirements beyond the epic's three ACs, each fatal alone: **D1** the edges (8 structural columns + a completeness CHECK, so a bracket with no exits is unrepresentable); **D2 the LOSER DROP** — AC1 says only "winner", but without the drop the Losers bracket never fills and **no tournament can ever complete** (FR-6 two-loss elimination is *derived from the edges*); **D3 the BYE CASCADE** — 4.1's ALL-CAPS contract, and the standing 11-player fixture has 10 `bye`/`void` rows, so a loser dropping into a walkover must be advanced straight through or the Losers bracket stalls at the first one. Plus **D4** the `advance` audit row (already enumerated at 0003:25 — no migration) and **D5 NO ADVANCE ROUTE**: AC2/AD-8 make advance a *consequence*, never a control, so 4.3 ships a SQL function that 4.5/4.6 call inside their own transactions — **no route, no new TS module, no dead code**. ⚠ PRD FR-7 + the UX's `{components.advance-control}` describe a tap/drag `Avanzar` button; the architecture (AD-8) deliberately overrode it and the epic's AC2 restates AD-8 verbatim — flagged for Cuatro, implemented as AD-8. **Decision 1 (AC3):** no realtime code exists anywhere in the repo, so the Broadcast had to be decided here → `realtime.send()` from inside `advance_match`, which makes *"emitted only after commit"* true **by construction** (the message row is written in the advance's own transaction and shipped off the replication slot only on commit), works unchanged inside 4.6's Aprobar transaction, and ships zero dead code — with a TS `channel.httpSend()` fallback if Task 0 finds `realtime.send` absent. **KNOWN REGRESSION, correct-by-design (Task 8):** `0011_bracket_generation_test.sql`'s hand-built `p_matches` fixtures omit the new edges, so `match_routing_complete` refuses them (`23514`) — fix the fixtures by pasting real `generateBracket()` output, not by weakening the CHECK. **THE BAR (Task 9):** a real 11-player bracket must be driven to a CHAMPION — 4.1's live-QA drove a field the review later proved could never reach its Grand Final and the re-run was waived; this story repays that debt or finds the bug. |
