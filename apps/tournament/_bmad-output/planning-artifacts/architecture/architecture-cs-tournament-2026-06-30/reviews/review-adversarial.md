---
title: Adversarial Pre-Handoff Gate Review — InclusivCup Architecture Spine
artifact: ARCHITECTURE-SPINE.md (architecture-cs-tournament-2026-06-30)
reviewer: Adversarial reviewer (pre-handoff gate)
lens: "Two units, one level down, each obey every AD to the letter yet build incompatibly."
date: 2026-06-30
verdict: CONCERNS
---

# Adversarial Review — Spine Integrity Under Independent Build

## Method

I did not grade prose, completeness, or taste. I took the spine's own invariants (AD-1…AD-18 plus
the Provably-Fair contract and the Consistency Conventions) as binding, then tried to build two
units one level down — a producer and a consumer, two writers, a Go side and a JS side, two state
machines — that each satisfy **every** applicable AD *verbatim* and **still diverge**: clashing
data shapes, two owners of one mutation, conflicting state paths, or two reproductions that disagree.

Every pair below is a place the author talked past a fork the ADs do not actually close. For each I
name the two units, show that both obey the cited ADs, show the divergence, and state the new or
tightened AD that closes it. Holes are ranked; a separate section lists pairs I tried and **failed**
to drive apart (the spine holds there) so the gate can see the probe was exhaustive, not selective.

Severity scale: **CRITICAL** (two correct builds silently disagree on a published/ceremony result or
on persisted truth) · **HIGH** (two correct builds break each other at the contract or corrupt state
under a normal operation) · **MEDIUM** (divergence reachable but only under an edge input or with
observable symptom) · **LOW** (latent ambiguity, no near-term divergence).

---

## CRITICAL holes

### H1 — Snapshot capture (worker/awards) vs. verifier (lib/roulette): no schema authority over `stat_snapshot_row`, so the two "players" arrays can be field-incompatible while both pass AD-14/15

**The two units.** `worker/awards` (the producer) freezes the ceremony snapshot and emits the
published bundle whose `players` array *is* the frozen snapshot (Provably-Fair §"Published
verification bundle"). `lib/roulette` (the verifier) reads that `players` array back and recomputes
Stage-2 winners.

**Both obey the ADs.** AD-15 says winners resolve "exclusively from `stat_snapshot` /
`stat_snapshot_row`, an immutable copy." AD-14 says the draw is "a pure function of the published
verification bundle" and that a golden-vector suite gates the build. The ERD declares
`STAT_SNAPSHOT ||--o{ STAT_SNAPSHOT_ROW` but gives `STAT_SNAPSHOT_ROW` **no column list at all** —
unlike `STAT_ROW`, which lists `idle_dq`, `rounds_played`, `status`. The spine never states that the
snapshot row is a structural copy of the stat row, nor which derived fields it must carry.

**The divergence.** Stage-2 needs, per the Provably-Fair contract: rate stats as `{num, den}`
integer pairs, the FR-21 floors inputs (`rounds_played`, kills, `idle_dq`), the secondary stat, the
efficiency stat, head-to-head data, and "earliest achievement timestamp (integer tick/epoch-ms)."
The producer can capture a snapshot that stores rate stats **pre-divided** (or as floats it rounds
itself), omits the head-to-head matrix (it resolved H2H from live `match` rows at capture time,
which AD-15 forbids the verifier from reaching), or stores the achievement timestamp as epoch-ms
while the build-handoff vectors assume ticks. The verifier, reading only the bundle, then *cannot*
reproduce the ladder — or reproduces it from different inputs — and **both units passed every AD**.
The golden-vector suite (AD-14) does not save this: vectors test the *draw algorithm over a given
players array*; they do not pin what fields the **capture** step must place into that array. Producer
and verifier conform to `roulette/vectors` "independently, never to each other" (the dependency
rule) — so a field the producer forgot to capture is simply a field the vectors never exercised.

**Why it's critical.** This is the ceremony result. Two correct-by-the-AD builds produce a bundle
the verifier either rejects (best case: "Verificar" fails on a legitimate ceremony — kills SM-3) or
"verifies" against a different computation (worst case: a skeptic reproduces *different* winners and
the trust keystone inverts).

**Closing AD (new).**
> **AD-19 — The snapshot row schema is the verifier's complete and sole Stage-2 input contract.**
> `stat_snapshot_row` carries every field Stage-2 and the FR-29 ladder consume, in the exact integer
> form the Provably-Fair contract specifies: rate stats as `{num, den}` pairs (never pre-divided),
> `rounds_played`, kills, `idle_dq`, the declared secondary and efficiency stats, the per-pair
> achievement timestamp as integer ticks, **and a materialized head-to-head result table** captured
> at lock (so the verifier never reads live `match`/`stat_row`, per AD-15). The migration that
> defines `stat_snapshot_row` is the shared contract; the golden vectors MUST include at least one
> vector whose `players` array is a byte-identical projection of a real `stat_snapshot_row` set, so
> the capture shape — not just the draw math — is build-gated.

---

### H2 — Stage-2 selection (worker/awards) vs. verifier (lib/roulette): "best deciding-stat value" has no spine-level total order, so two correct integer comparators pick different winners on equal-cross-product

**The two units.** The producer's Stage-2 selector and the verifier's Stage-2 selector. Both
implement "the eligible player … with the best deciding-stat value," rates "compared by
cross-multiplication" (AD-14, Provably-Fair §Stage 2).

**Both obey the ADs.** AD-14 mandates integer-only arithmetic, cross-multiplication for rates,
"explicit sorted iteration," and a five-step tie ladder. The Provably-Fair §Stage 2 says ties
resolve "by the FR-29 ladder." Nothing more is required.

**The divergence — equal value is not a tie unless someone says so.** Consider two players with rate
stats `{num:3, den:4}` and `{num:6, den:8}`. Cross-multiplication: `3·8 == 6·4` → **equal value**.
Is that a "tie" that enters the FR-29 ladder, or are they ordered by the "explicit sorted iteration"
order (e.g., ascending steamid64 / ascending priority of arrival)? The spine says iteration is
sorted and deterministic, *and* it says ties go to the ladder — but it never says **equal deciding
value triggers the ladder**. A producer can treat equal cross-products as a tie (→ ladder → possibly
a shared co-winner per FR-29.5); a verifier can treat "best" as a strict argmax over the sorted
iteration (→ first player in sort order wins outright, no ladder, no co-winner). Both are
integer-only, both iterate in sorted order, both are deterministic, both "obey AD-14." They produce
**different winners and different `is_shared` shapes**. The same fork exists for volume stats with an
exact integer tie.

**Why it's critical.** Same failure class as H1 — divergent published winners — but from a different
root: the comparator's tie *trigger*, not the snapshot's *fields*. The golden vectors *could* catch
it, but only if someone thought to include an equal-cross-product fixture; the spine does not require
one, so the author talked past the case.

**Closing AD (tighten AD-14).**
> Add to AD-14: "Equal deciding value (rates: equal cross-product `a·d == c·b`; volume: equal
> integer) **is a tie** and MUST enter the FR-29 ladder; it is never resolved by iteration order.
> Iteration order is a determinism aid for *stream consumption and candidate enumeration only*,
> never a tiebreaker. The golden-vector suite MUST contain an equal-cross-product fixture and an
> exact-integer-volume-tie fixture, each asserting ladder entry and the resulting `is_shared` shape."

---

### H3 — Aprobar transaction (api/admin) vs. leaderboard read surface (app/): "recomputes affected leaderboards" names no owner of the recomputation or its storage shape, so the writer and the reader can disagree on what a leaderboard *is*

**The two units.** The `api/admin` Aprobar route (AD-6: "recomputes affected leaderboards in one DB
transaction") and the `app/` leaderboard read surface (AD-7, AD-11: "every viewer surface is fully
reconstructable from a published-state read alone").

**Both obey the ADs.** AD-6 requires the recompute to be *inside* the approve transaction. AD-7
requires viewers to read approved-only via RLS. AD-11 requires the surface be reconstructable from a
read. None of these say **whether a leaderboard is a materialized table the transaction writes, or a
view/query the reader computes on the fly from `stat_row`.**

**The divergence — two owners of "the leaderboard."** Reading AD-6 literally, the Aprobar route
author builds a materialized `leaderboard_standing` table and writes it inside the txn (because AD-6
says *recompute … in one DB transaction* — a query-time view can't be "recomputed in a transaction").
Reading AD-7/AD-11 literally, the read-surface author builds the leaderboard as a `SELECT … WHERE
status='approved'` over `stat_row` (because AD-11 says reconstructable from a read, and the simplest
RLS-gated read is a direct aggregate). Now there are **two sources of leaderboard truth**: a
materialized table the writer maintains and an ad-hoc aggregate the reader computes. They drift the
instant a rollback (AD-8) reverts `stat_row.status` but the recompute path and the view path
normalize differently (e.g., FR-17/AD-9 "completed non-forfeit matches" — does the materialized
recompute exclude forfeits the same way the live aggregate does?). Two correct builds, two
leaderboards, silently different numbers — and FR-21 floors (who is *hidden* below the floor) can be
applied in one path and not the other.

**Why it's critical.** Leaderboards feed Award eligibility framing (UJ-1) and the public read; a
silent split between a materialized standing and a live aggregate is exactly the "fabricated stats"
distrust AD-1 exists to kill, reintroduced one layer down.

**Closing AD (new).**
> **AD-20 — Single owner and single shape for leaderboard derivation.** Either (a) leaderboards are a
> pure query-time projection over `stat_row` (no materialized standings; AD-6's "recompute" reduces
> to "no extra write"), **or** (b) they are a materialized `leaderboard_standing` written *only* by
> the Aprobar/rollback service-role transaction and read RLS-gated — never both. The spine MUST pick
> one. The normalization rule (completed non-forfeit matches only, FR-21 floor-hiding) lives in
> exactly one place that both the writer path and any read path call; it is not re-implemented per
> surface.

---

## HIGH holes

### H4 — Aprobar advance (api/admin via lib/bracket) vs. re-parse-republish (api/admin): both write `match.score_source` and the winner under AD-5/AD-6/AD-8, and the grand-final reset case lets them route a champion two different ways

**The two units.** The first-approval Aprobar path (Live→Resolved, AD-6) and the
re-parse-republish path (Approved→Approved "one txn," AD-8, ingest diagram). Both advance the bracket
as a consequence of a result.

**Both obey the ADs.** AD-8: advance is "conditional (`WHERE slot IS NULL OR = winner`, no
double-route)." AD-6: approve "advances the bracket … in one DB transaction." AD-13 separates the
fairness seed from the bracket seed. The double-elim grand-final **bracket reset** (FR-6: losers
finalist can take the winners finalist to a second set) is mentioned nowhere in the ADs.

**The divergence — the bracket-reset edge the `WHERE` guard mis-handles.** In a grand final, the
winners-bracket finalist arrives with zero losses; the losers finalist must beat them **twice**. So
the grand-final destination slot is legitimately written *twice* with *different winners* across two
matches (set 1 → losers finalist wins → reset; set 2 → champion). The AD-8 idempotency guard `WHERE
slot IS NULL OR slot = winner` is built precisely to *reject* a second different winner into a filled
slot — it cannot distinguish "double-route bug" from "legitimate grand-final reset." Unit A
(first-approval) treats the GF as one match and writes the champion once; Unit B (the reset-set
match) tries to advance a *different* winner into a *now-filled* champion slot and the guard
**silently no-ops** (slot already = the set-1 winner, condition false). Result: either the reset is
impossible (champion frozen at set-1 winner) or the implementer adds an un-specified escape hatch
that re-opens the double-route hole AD-8 closed. The spine's `match.bracket ∈
{winners,losers,grand_final}` has **no `grand_final_reset` state and no notion of a best-of-2-sets
GF**, so two builders model the GF reset incompatibly (one match toggled vs. two match rows).

**Why it's high.** This is the literal last match of the event — the champion crowning — and the one
advance the idempotency invariant cannot express. FR-6 ("losers and winners finalists meet in the
grand final," "eliminated only after two losses") *requires* the reset path for the player who came
through losers; the spine never modeled it.

**Closing AD (new).**
> **AD-21 — Grand-final reset is two ordered match rows, not a re-advanced slot.** The grand final is
> modeled as up to two `match` rows (`grand_final` set 1, `grand_final_reset` set 2). Set 2 exists
> **iff** the losers-bracket finalist wins set 1. The champion slot is written exactly once, by
> whichever set is decisive; AD-8's "no double-route" guard therefore never sees a legitimate second
> different winner into one slot. Byes in the grand final are impossible by construction (both
> finalists are present). `lib/bracket` owns this routing table as data, not branching code.

---

### H5 — Bye assignment (lib/bracket generation) vs. losers-bracket routing (lib/bracket advance): a first-round bye in a non-power-of-two field produces a player who "lost zero matches but must drop a phantom opponent," and the two sub-units route it incompatibly under AD-9/FR-6

**The two units.** Bracket *generation* (FR-5: "non-power-of-two counts produce Byes … assigned by
the recorded Seed") and bracket *advance/routing* (FR-6 double-elim loser routing, AD-9 byes produce
zero stats).

**Both obey the ADs.** AD-9: a bye is "only a bracket advance and a structural badge," zero stats.
AD-8: advance is conditional and idempotent. FR-6: a loser routes to losers bracket until a second
loss. AD-13: bracket seed is separate. Nothing constrains **what happens in the losers bracket to the
player whom a bye-advanced winner would have sent there.**

**The divergence — the missing-loser slot in the losers bracket.** With, say, 11 players, the first
winners round has byes. A standard double-elim losers bracket is *structured around* every
winners-round producing a loser to drop down. A first-round bye produces **no loser** — so the
corresponding losers-bracket slot has no incoming player. Unit A (generation) can pre-seed the losers
bracket assuming a full first round and leave a dangling empty slot; Unit B (advance) can treat that
empty slot as itself a *bye* (advance the waiting player) **or** as *awaiting* (deadlock the losers
bracket until a player that will never arrive). Both obey AD-9 (no stats either way) and AD-8 (the
`WHERE slot IS NULL` guard is happy with either). One build advances the losers bracket; the other
stalls it forever. The spine's match-lifecycle diagram has `Declared → Bye` but **no losers-bracket
structural bye / "drop-down slot that never fills"** — the non-power-of-two losers-side topology is
unspecified.

**Why it's high.** 8–16 is the *entire* supported range (FR-5) and most counts in it are
non-power-of-two; the losers-bracket bye topology is hit in nearly every real event, and a stalled
losers bracket strands the early-eliminated players the product exists to keep engaged (UJ-1).

**Closing AD (new).**
> **AD-22 — The double-elim routing table for 8–16 (with byes) is a frozen, generated artifact, not
> runtime branching.** Bracket generation emits the *complete* match graph — winners, losers, and all
> structural byes/drop-down slots — for the actual roster size at generation time, with every slot's
> source explicitly one of `{winner_of(M), loser_of(M), bye}`. A losers-bracket slot whose source is
> a winners match that was itself a bye is itself a structural bye, assigned at generation. Advance
> only fills slots whose source resolved; no slot is "awaiting" a player that the topology proves
> will never arrive. The generated graph is recorded (FR-5 seed-reproducible) and is the single
> source both generation and advance read.

---

### H6 — Realtime emitter (lib/realtime + api/admin) vs. ceremony reveal consumer (app/ + lib/roulette): "one Broadcast carries the semantic change" (AD-11) vs. per-spin `spin.reveal` events gives two incompatible event-granularity contracts on `ceremony:{id}`

**The two units.** The post-commit emitter for the ceremony and the ceremony reveal consumer. The
producer-side ceremony runs N spins; the consumer animates a spinning wheel per spin.

**Both obey the ADs.** AD-11: "One Broadcast carries the *semantic* change so the four effects of
AD-6 stay atomic on the wire," channels include `ceremony:{id}`, events are "named by semantic
change (… `spin.reveal` …)," emitted post-commit, and "on reconnect a client re-fetches the published
snapshot and never replays missed events." The Consistency table lists `spin.reveal` as an event.

**The divergence — is the ceremony one commit or N commits?** AD-6's atomicity is about *approve*.
The ceremony is a different mutation. AD-11 says one Broadcast per semantic change, but a ceremony
has two readings: (A) the whole ceremony is computed deterministically at lock (it's a pure function
of the bundle — AD-14), so it could be **one commit + one `ceremony.complete` Broadcast**, with the
client animating reveals locally from the bundle; or (B) each spin is its own semantic change → **N
sequential `spin.reveal` commits + N Broadcasts**, the wheel reveals as events arrive. Unit A (emitter
built per "one Broadcast carries the semantic change," ceremony = one semantic change) emits once;
Unit B (consumer built per "`spin.reveal`" being a listed event, expecting one per spin) waits for N
events that never come — **or** vice versa: emitter sends N, consumer (per AD-11 reconnect rule
"re-fetch snapshot, never replay missed events") drops the spins it missed and the wheel never
animates. The reconnect rule actively *breaks* the per-event reveal reading: a viewer who joins mid-
ceremony "re-fetches the published snapshot" — but is the snapshot the *final* result (spoiling
un-revealed spins) or the *reveal-state-so-far* (which AD-11 says is never on the wire as truth)?
Two correct builds, mutually deaf.

**Why it's high.** The ceremony is the product's emotional climax (UJ-4) and a stated stream/recap
surface (FR-30); a granularity mismatch means either no animation or spoiled reveals, and the
reconnect-spoiler question has a real trust dimension (a reconnecting viewer must not see future
winners).

**Closing AD (new).**
> **AD-23 — Ceremony progression is server-driven discrete state, separate from AD-6 atomicity.** The
> ceremony advances spin-by-spin: each spin reveal is its own committed `ceremony.state` increment
> (`spin_index`) plus one post-commit `spin.reveal` Broadcast carrying that spin's revealed
> `award_result`(s). The full bundle (all winners) is published only at `ceremony.complete`. A client
> that reconnects mid-ceremony re-reads `ceremony.spin_index` and the *already-revealed*
> `award_result` rows (RLS-gated to revealed-only) — never un-revealed winners. "Verificar" reads the
> complete bundle, available only post-complete. AD-11's "one Broadcast per semantic change" applies
> per spin, not per ceremony.

---

### H7 — RLS viewer policy author (supabase/migrations 0002) vs. ceremony reveal gating: AD-7 gates by `status='approved'`, but `award_result` reveal-state has no `status`, so "approved-only" and "revealed-only" are two different unstated gates

**The two units.** The migration author writing RLS for the read tables (AD-7) and the same author
writing RLS for `award_result` / `spin` reveal visibility (FR-24: "categories hidden from viewers
until revealed").

**Both obey the ADs.** AD-7's rule is specifically about `status='approved'` on stat-bearing rows
and a separate `is_admin()` policy. The ERD's `AWARD_RESULT` has **no `status` column** and no
reveal-state field; `CEREMONY.state ∈ {not_started,locked,spinning,complete}` is the only
reveal-ish state, and it's on the ceremony, not the per-award result.

**The divergence — what RLS predicate hides an un-revealed award?** Author A applies the AD-7 pattern
mechanically: `award_result` has no `status`, so the approved-only pattern doesn't apply → author A
gates `award_result` reads on `ceremony.state = 'complete'` (all-or-nothing: nothing visible until
the whole ceremony ends). Author B reads FR-24 ("hidden until *its* Spin") and AD-23 (if adopted) and
gates per-spin (`spin_index >= award_result.spin.index`). Two correct migrations: one reveals
everything at once at the end (breaking the dramatic per-category flip of FR-30/UJ-4), the other
reveals progressively. AD-7 is silent because reveal-state is not approval-state — the author talked
past the fact that the read model has **two** orthogonal visibility axes (approved-vs-pending for
stats; revealed-vs-blurred for awards) and only specified one.

**Why it's high.** A wrong gate here is a *correctness/spoiler* bug enforced at the database, exactly
the layer AD-7 makes load-bearing ("fails closed"). It also intersects H6's reconnect-spoiler concern
at the RLS level.

**Closing AD (new or fold into AD-7).**
> **AD-24 — Reveal-state is a first-class, RLS-enforced axis distinct from approval-state.**
> `award_result` (and `spin`) carry an explicit reveal marker driving a viewer RLS policy
> `USING (revealed = true)` separate from the admin `USING (is_admin())` policy — same two-policy,
> fail-closed discipline as AD-7. Un-revealed award results are invisible to viewers at the row level
> regardless of `ceremony.state`. Blurring is defense-in-depth in the UI, not the security boundary.

---

### H8 — Forfeit grace-timer gate (api/admin) vs. ingest Pending arrival (worker/ingest): a demo can land for a match the admin is concurrently forfeiting, and AD-3/AD-5/AD-9 each hold while the two units write contradictory `match.state`

**The two units.** The Forfeit command route (AD-9: forfeit "markable only after the grace timer…")
and the ingest writer landing parsed rows for that same match (AD-3 idempotent ingestion, writing
`stat_row` and flipping the match toward Pending).

**Both obey the ADs.** AD-9: forfeit has "no reachable stat-write path." AD-2: the worker is the only
stat writer. AD-3: ingestion is idempotent. AD-5: one score source. The match lifecycle shows
`AwaitingGrace → Forfeit` and, separately, `Live → Pending`. **Nothing says these transitions are
mutually exclusive under concurrency**, nor who wins if a demo arrives during/after a forfeit.

**The divergence — late demo vs. declared forfeit.** A player is absent, the grace timer elapses, the
admin clicks Forfeit (legitimate per AD-9). Meanwhile MatchZy *did* finish a demo (the player showed
up on the server but not in the app, or a stale demo lands late) and `worker/ingest` writes
`stat_row` and pushes the match toward Pending — also legitimate (AD-2/AD-3, the worker is the sole
writer and idempotent). Now the match is simultaneously Forfeit (zero stats, per AD-9) **and** has a
parsed Pending demo with real stats. AD-9 says forfeit has zero stats "by construction," but the
*construction* assumed no demo would ever arrive — the worker has no AD telling it to refuse to write
for a forfeited match, and the forfeit route has no AD telling it to refuse a match with a landed
demo. Two units, two writes, contradictory `match.state` and contradictory stat existence. AD-5 ("one
score source") arbitrates *demo_derived vs admin_manual* — it does not arbitrate *demo_derived vs
forfeit*.

**Why it's high.** It corrupts persisted match truth (forfeit + stats) and poisons leaderboard
normalization (AD-9/FR-17 promised forfeits contribute nothing; now they contribute a full stat row).
Reachable in a normal no-show-then-late-demo sequence.

**Closing AD (new).**
> **AD-25 — Terminal match-state precedence is explicit and single-writer-enforced.** `match.state`
> has a defined precedence and the transition is guarded in one place: a match in `forfeit`/`bye`
> refuses demo association (ingest writes the demo as *unassociated/anomalous*, never as that match's
> result), and a match with a landed/parsed demo cannot be force-forfeited without an explicit
> audited admin override (AD-17) that first detaches the demo. The guard lives on the `match` row
> (DB-level state check), so the worker and the admin route contend on the same row, not on
> independent assumptions.

---

### H9 — `is_admin()` definition site (supabase/migrations) vs. role mirror writer (app/auth/steam): AD-7 RLS and AD-12 role storage each name a source, but `is_admin()` can read a *different* source than the one the auth route writes

**The two units.** The migration that defines the `is_admin()` SQL function used by every RLS policy
(AD-7) and the auth/role unit that maintains role (AD-12: role lives in `app_role` table *and* is
mirrored to `app_metadata`).

**Both obey the ADs.** AD-12: "Role lives in an `app_role` table with no client write policy and is
mirrored to `app_metadata`. RLS reads role/steamid64 only from `auth.jwt() -> 'app_metadata'`." AD-7
says admin visibility is a policy `USING (is_admin())`.

**The divergence — `is_admin()` has two legitimate definitions and a mirror lag between them.** AD-12
explicitly says **RLS reads from `app_metadata`** (the JWT). So `is_admin()` should read
`auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`. But the *table of record* is `app_role` (AD-12:
"role lives in an `app_role` table"). A second, equally AD-compliant author defines `is_admin()` as
`EXISTS (SELECT 1 FROM app_role WHERE steamid64 = current_steamid() AND role='admin')` — reasoning
that the table is the source of truth and the JWT is just a mirror. Both obey AD-12's words. But the
JWT is **stamped at login**; a role granted *after* a user's current session began is in `app_role`
immediately but not in their JWT until re-auth. So `is_admin()`-via-JWT and `is_admin()`-via-table
disagree for the lifetime of a session after any role change. If the admin command route checks one
definition and an RLS policy checks the other, an admin can pass the route gate but fail RLS (or vice
versa) — a half-authorized mutation. AD-12 names *where role is stored*, not *which store
`is_admin()` authoritatively reads*, and the two stores are eventually-consistent.

**Why it's high.** Authorization that disagrees with itself between the command-route check and the
RLS check is a security-relevant split, and role-grant (AD-17 logs it as a mutating action) is a
normal admin operation, so the mirror-lag window is reachable.

**Closing AD (tighten AD-12).**
> Add to AD-12: "`is_admin()` (and the steamid64 accessor) is defined **once**, reads **only** from
> `auth.jwt() -> 'app_metadata'`, and is the single function used by both RLS policies and the
> server-side command-route re-check — they never read different stores. `app_role` is the write-time
> source of record; granting/revoking a role MUST refresh the affected session's `app_metadata`
> (force token refresh / session invalidation) within the same audited action (AD-17), so the JWT
> mirror is never authoritative-but-stale for an authorization decision."

---

## MEDIUM holes

### H10 — `algo_version` MAJOR gate (lib/roulette verifier) vs. producer (worker/awards): "client refuses a MAJOR it doesn't implement" is a divergence the spine *names* but doesn't make build-gated, so producer MINOR/PATCH bumps can silently change verifier-visible outputs

**The two units.** The Go producer bumping `algo_version` and the JS verifier deciding whether it can
verify. AD-14/Provably-Fair: "MAJOR bumps on any outcome-affecting change; a client refuses to verify
a MAJOR it doesn't implement."

**Both obey the ADs.** The rule binds only MAJOR to outcome changes. MINOR/PATCH are unconstrained.

**The divergence.** A producer author makes an outcome-affecting fix (say, corrects a rejection-
sampling boundary) and — judging it a "fix," not a "change" — bumps PATCH. The verifier, seeing a
PATCH it doesn't have, *still verifies* (the rule only lets it refuse a MAJOR). Now the verifier
reproduces the old (buggy) outcome and the producer published the new one: `bundle_hash` mismatch on
a legitimately re-published ceremony, or — if the verifier is lenient on hash — a silent disagreement.
The spine relies on human discipline ("MAJOR bumps on any outcome-affecting change") with no
mechanical enforcement, and the golden vectors are versioned by… the same field whose discipline is
in question.

**Closing AD (tighten AD-14 / Provably-Fair).**
> "The golden-vector suite is keyed by `algo_version` and is the *definition* of outcome-affecting:
> any change that alters a single golden-vector output MUST bump MAJOR — this is checked in CI by
> re-running the prior MAJOR's vectors against the new code and requiring either identical output
> (no MAJOR bump needed) or a MAJOR bump with a new vector set. The verifier refuses any
> `algo_version` whose MAJOR it lacks **and** any bundle whose `algo_version` is unknown to its
> vector set."

### H11 — Re-parse SteamID delete-missing (worker/ingest) vs. snapshot immutability (AD-15): a re-parse that deletes a `stat_row` after a ceremony snapshot referenced that SteamID has no defined interaction, so leaderboard and snapshot can reference different player sets

**The two units.** Re-parse (AD-3: "a delete of SteamIDs absent from the new parse … forces rows back
to `status='pending'`") and the frozen snapshot (AD-15: immutable, ceremony decides from it).

**Both obey the ADs.** AD-3 deletes missing SteamIDs and reverts to pending. AD-15 says live
re-parses "change leaderboards but never the published ceremony result." Both hold.

**The divergence.** AD-15 protects the *ceremony result*. But the verification bundle's `players`
array (the frozen snapshot) may reference a SteamID that a post-ceremony re-parse later *deletes* from
live `stat_row`. The snapshot row survives (immutable), so the ceremony reproduces — good. But the
*leaderboard* (H3's other owner) now lacks that player while the published bundle includes them, and
any UI that cross-links a ceremony winner to their live stat detail (FR-23 player detail) dangles.
Two correct units: the snapshot keeps the player, the live table drops them. The spine says the
ceremony is safe but never says the *cross-reference* between a frozen winner and live stats is
defined.

**Closing AD (tighten AD-15 / AD-4).**
> "A SteamID referenced by any `stat_snapshot_row` is pinned: re-parse delete-missing (AD-3) may
> revert its live `stat_row` to pending or remove it from leaderboards, but the `player`/roster row
> and the snapshot reference are never invalidated, and ceremony-winner→player links resolve against
> the snapshot, never live `stat_row`."

### H12 — Anomaly gate (worker/ingest) vs. Aprobar (api/admin): `Anomalous → Pending: admin accepts` puts the accept decision in the worker's lifecycle but the audit/authorization in the app's, so the "accept anomaly" action has two possible owners

**The two units.** `worker/ingest` (owns the `Validating → Anomalous → Pending` transition in its
state machine) and `api/admin` (owns admin-gated mutations + audit, AD-8/AD-17).

**Both obey the ADs.** The ingest diagram shows `Anomalous → Pending: admin accepts, logged [FR-13]`.
AD-8 says *every mutation* flows through a Next.js server route. AD-2 says the worker is the only
writer of `stat_row`. So "admin accepts an anomaly and it becomes Pending" is simultaneously a
worker-owned state transition (it's in the worker's diagram and only the worker writes `stat_row`) and
an app-owned admin mutation (AD-8: all mutations via the app route; AD-17: it's an audited admin
action — "parse anomalies are flagged for review"). Who flips `Anomalous → Pending`: the worker (on a
signal) or the app route (writing via service-role)? AD-2 says only the worker writes `stat_row`, but
AD-8 says only the app route mutates event state. The accept-anomaly action sits exactly on the
worker/app boundary the dependency rule says has *no edge*.

**The divergence.** Build A: the app admin route writes `stat_row.status` directly via service-role
(it has the key) — violating the *spirit* of AD-2 (worker is the only writer of `stat_row`) while
obeying its letter is debatable. Build B: the app route can't touch `stat_row` (AD-2), so it must
signal the worker — but the dependency graph forbids an app→worker edge, leaving no defined channel.
Two builds, one writes the status from the app, one has no path to do it at all.

**Closing AD (new / clarify AD-2 + dependency rule).**
> **AD-26 — `stat_row.status` transitions have a single declared writer and a defined cross-boundary
> trigger.** Decide and state: either (a) `stat_row.status` (pending/approved/accept-anomaly) is
> writable by the app's service-role command route — i.e., AD-2's "single writer" governs *stat
> values*, while *status/publication* is the app's CQRS write side — or (b) all `stat_row` writes
> including status stay in the worker, and the app triggers them via the one allowed channel (a
> queue/notify row in the shared `supabase/migrations` contract, not a direct dependency edge). The
> spine MUST pick one; the worker/app no-edge rule needs the chosen trigger named.

### H13 — Pity draw seeded reveal order (worker/awards) vs. anti-sweep interaction: "everyone winless gets one" is invariant but the pity *award assignment* (which consolation, to whom) has no specified determinism when the consolation pool is smaller than the winless set

**The two units.** The producer's pity stage and the verifier's pity reproduction.

**Both obey the ADs.** Provably-Fair §Pity: "every non-fully-DQ'd player with an empty shelf gets a
guaranteed consolation award (seeded reveal order via the pity stream; the *outcome* — everyone
winless gets one — is invariant)." FR-28: pity is "seeded and reproducible."

**The divergence.** The invariant pins *reveal order* and *that everyone winless gets one*. It does
**not** pin *which* consolation each winless player receives when consolations are distinguishable
(named "pity" awards differ) and the pool size ≠ winless count. If there are 3 winless players and a
pool of 5 distinct consolation trophies, *which three, mapped to whom*? Producer and verifier can both
seed the *order* identically yet assign *different trophy→player mappings* (one assigns by stream-
order over players, the other by stream-order over trophies). Both reproduce "everyone winless got
one" — the stated invariant — yet disagree on the actual `award_result_winner` rows, so `bundle_hash`
diverges.

**Closing AD (tighten Provably-Fair §Pity).**
> "Pity assignment is fully specified, not just its existence: define the canonical mapping (e.g.,
> winless players sorted by steamid64 string ascending, consolation pool consumed in published
> `spin_plan` order, paired by stream-driven assignment with stated iteration order). A golden vector
> with `|pool| ≠ |winless|` gates it."

---

## LOW holes

### H14 — `match.state` enum split between ingest and bracket lifecycles
The ingest diagram uses states `{Pending, Approved, Anomalous, ...}` on the *demo*; the match diagram
uses `{Declared, Bye, Forfeit, Live, Pending, ManualResolved, Resolved}`; the ERD's `match.state` enum
is `pending|bye|forfeit|no_stats|resolved|manual`. "Live," "Declared," and "AwaitingGrace" from the
diagram are absent from the ERD enum; "no_stats" in the ERD is in neither diagram. Two builders
encode the match state set differently. **Close:** make the ERD enum the single authority and
reconcile both state diagrams' labels to it exactly (or state that diagram labels are
phase-descriptive, not the stored enum).

### H15 — `parse_generation` bump vs. dedup short-circuit ordering (AD-3)
AD-3 says a "duplicate-bytes upload short-circuits to the prior result," and `demo.parse_generation`
"bumps on re-parse." For an identical-bytes re-upload (same sha256) the short-circuit fires (no new
parse) — so `parse_generation` does **not** bump; for an admin re-parse of the *same stored bytes* it
*does* bump. Two builders can disagree on whether `parse_generation` counts upload attempts or actual
parse executions. **Close:** state that `parse_generation` counts *parse executions only* (never
short-circuited uploads), and dedup short-circuit returns the existing generation unchanged.

---

## Pairs I tried to drive apart and could NOT (the spine holds)

- **Demo identity / content addressing (AD-1) producer vs. verifier.** `(match_id, sha256)` identity,
  lowercase-hex convention, raw-32-byte HMAC key vs. hex string — all pinned in Provably-Fair §Seed.
  No divergence: both sides are told the key is the raw bytes, not the hex.
- **Vercel body-size bypass (AD-16) across all three ingest paths.** MatchZy→worker, presigned
  multipart, CLI server-side all explicitly route around the function; `DemoStore` interface +
  opaque `(storage_backend, storage_key)` is a clean single contract. Retention-guarded `Delete()`
  refusing `permanent_seed` is unambiguous.
- **Single-writer of stat *values* (AD-2).** No client write policy + no app stat-write code path is
  airtight for stat *values*. (The *status* transition is the gap — see H12 — but value-writing has
  one owner.)
- **Fairness-seed vs. bracket-seed conflation (AD-13).** Two named fields, two lifecycles, "never
  reused for each other" — explicit and adopted. Could not construct a conflation that obeys AD-13.
- **Audit-log append-only shape (AD-17).** INSERT-to-service-role-only + no UPDATE/DELETE policy is a
  single, unambiguous contract; no two builders diverge on append-only-by-absence.
- **HMAC-CTR stream construction (Provably-Fair §Stream PRNG / Uniformity).** `block_i(label) =
  HMAC(key=seed, label_bytes || LE64(i))`, minimal-`k` big-endian rejection sampling with the exact
  `limit` formula, "both runtimes consume identical byte counts" — this is the most tightly nailed
  part of the spine; I could not separate a Go and JS impl that both follow it. (The divergences I
  found are *upstream* of the PRNG — snapshot fields H1, tie-trigger H2, pity-mapping H13 — not in the
  byte stream itself.)

---

## Verdict

**CONCERNS.** The PRNG byte-stream contract, content-addressing, storage abstraction, seed
separation, and audit shape are genuinely tight — an independent Go and JS pair will agree on the
*stream*. But the spine repeatedly nails the *arithmetic* and talks past the *data shape and
ownership feeding it*: the snapshot row has no schema (H1), "best value" has no tie-trigger (H2),
"recompute leaderboards" has no owner or storage shape (H3), the grand-final reset and non-power-of-
two losers-bracket byes are unmodeled (H4, H5), the ceremony's on-the-wire granularity and its RLS
reveal-axis are undefined (H6, H7), and three cross-boundary mutation contentions (late-demo-vs-
forfeit H8, `is_admin()` source-of-truth H9, accept-anomaly ownership H12) sit exactly on edges the
spine declared edge-free. Three of these (H1, H2, H3) let two AD-conformant builds publish or persist
*different truth* — the failure class this product's trust keystone cannot survive.

These are closable at the spine: H1, H4–H8, H12 want new ADs (AD-19…AD-26); H2, H9, H10, H11, H13
tighten existing ADs; H14–H15 are convention reconciliations. None require re-architecting the four
patterns. Recommend the gate **return for AD-19…AD-26 + the AD-2/12/14/15 tightenings** before
handoff; with those closed, the build substrate is divergence-safe.
