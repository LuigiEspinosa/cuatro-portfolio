---
baseline_commit: 5b398ec3b2feac68fa53cda6880a4ff8f542966e
---

# Story 4.2: Pre-declared match format and tie policy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **admin**,
I want **each match's format and tie policy locked before it goes live**,
so that **rules cannot be changed mid-match and any change is on the record.**

This is the **second story of Epic 4**. It is a **small, sharp slice**: every column it needs already
exists (Story 4.1 shipped `match.format` / `tie_policy` / `format_locked` and explicitly deferred the
*lock* to this story), and the audit action `declare_format` needs no migration. What 4.2 actually
delivers is **teeth**: the DB-level guards that make AD-10 true — a match cannot go Live with an
unlocked format, and a locked format cannot be silently edited by anyone, including the service role.

## Acceptance Criteria

Verbatim from [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2 (lines 656-672)]:

**AC1 — declared and frozen before Live (FR-10, AD-10)**
**Given** the lock-before-live rule, **When** a match is declared, **Then** its `format` and
`tie_policy` are **stored and frozen before** the match transitions to `Live`.

**AC2 — a later change is an audited override, never a silent edit (FR-10, AD-10, AD-17)**
**Given** a frozen match, **When** an admin changes the format or tie policy afterward, **Then** the
change is permitted **only as an explicit audited override** (writes an `audit_log` row), **never a
silent edit**.

_Traces: FR-10 · AD-10_

### Additional required outcomes (D1–D3 — derived, NOT optional)

These are not in the epic's two ACs but are **binding requirements** of this slice. An AC that says
"frozen" is worth exactly as much as the mechanism that enforces it; without D1–D3 this story ships a
convention, not a lock. See the workflow's rule: an implied requirement is still a requirement.

- **D1 — The lock is enforced in the DATABASE, not just the route.** `service_role` holds `UPDATE` on
  `match` ([supabase/migrations/0010_match.sql:227]) and has **BYPASSRLS**, so no policy and no
  route-level discipline can stop a future story's `update match set format=…`. **BYPASSRLS does not
  skip triggers** — that is the exact lesson Story 4.1's D3 roster-lock trigger banked, and it applies
  verbatim here. AC1's "frozen" and AC2's "never a silent edit" must both be provable against a direct
  `service_role` SQL write, not merely against the HTTP route.
- **D2 — Bulk declare, or the feature is unusable.** An 11-player field generates **30** `match` rows
  (4.1 live-QA, verified). A per-match-only declare API means 30 HTTP calls before the first match can
  start. The declare command MUST accept a whole tournament (declare every still-`declared` match at
  once) as well as an explicit list of match ids. This is what makes AC1 reachable in practice.
- **D3 — The override must be VISIBLE ON THE MATCH RECORD, not only in `audit_log`.** PRD FR-10's
  third testable consequence is literally *"The declared format and any manual override are **visible on
  the Match record**"* [prd.md:216], and the UX state-pattern says an override is *"logged **+ flagged
  on the record**"* [EXPERIENCE.md:122]. `audit_log` satisfies "logged"; it does not satisfy "flagged on
  the record". Add a `match.format_overridden_at timestamptz` column.
  **⚠ DO NOT reuse the existing `manual_override` column for this — see the trap in Dev Notes §"The one
  shortcut that would be a disaster". It is a score-source flag (AD-5) and hijacking it silently
  legalizes a hand-typed score on a demo-bearing match.**

## Tasks / Subtasks

> **Migration numbering:** next free is **0012**. This story is **one** migration — `0012_format_lock.sql`
> — because it is **one concern** (AD-10: the format lock). Unlike 4.1, there is no second independent
> slice to separate. It carries: the `format_overridden_at` column (D3), the two CHECK constraints (AC1),
> the no-silent-edit trigger (AC2/D1), and the `declare_match_format` RPC + its grants.

- [x] **Task 1 — Migration `0012_format_lock.sql`: the DDL guards (AC1, D1, D3)**
  - [x] **D3 column:** `alter table public.match add column format_overridden_at timestamptz;`
        (NULL = never overridden). Comment it: this is the AD-10 override flag; `manual_override` is
        AD-5's *score* flag and the two are **not** interchangeable.
  - [x] **CHECK `match_format_lock_complete` (a lock must lock something real):**
        `format_locked = false OR (format IS NOT NULL AND btrim(format) <> '' AND tie_policy IS NOT NULL AND btrim(tie_policy) <> '')`.
        Without it, `format_locked = true` with `format = NULL` passes the live-gate CHECK below while
        having declared **nothing** — the lock would be a lie. (This is also the story's only value
        validation at the DB layer — see Dev Notes §"Format values are organizer config, NOT a CHECK enum".)
  - [x] **CHECK `match_live_requires_locked_format` (AC1's teeth):**
        `state NOT IN ('live','pending','resolved','manual_resolved') OR format_locked`.
        **The excluded states are deliberate, not an oversight:** `bye` / `void` / `forfeit` /
        `awaiting_grace` are **never played** and produce zero stats (AD-9) — requiring a format for them
        would make 4.1's already-generated `bye`/`void` rows unrepresentable and would block Story 4.5's
        forfeit path for no benefit. `declared` is the pre-lock state by definition. `rolled_back` only
        follows `resolved`, which was already locked.
  - [x] Migration header docstring in the established SCOPE / OUT-OF-SCOPE style (mirror 0010/0011).

- [x] **Task 2 — Migration `0012`: the no-silent-edit trigger (AC2, D1)**
  - [x] `match_format_lock_guard()` + `create trigger match_format_lock before update on public.match for each row`.
        `language plpgsql`, `security invoker`, `set search_path = ''` (mirror `roster_entry_lock_guard`,
        [supabase/migrations/0011_bracket_generation.sql:90-122]).
  - [x] **Rule A — `format_locked` is a LATCH.** Reject `old.format_locked AND NOT new.format_locked`
        (SQLSTATE `P0001`). There is **no legitimate unlock**: without this, the silent edit is trivially
        reachable as unlock → edit → relock, leaving no audit trace. A mis-declared format is corrected
        *through* the override (which keeps the lock set), never by unlocking.
  - [x] **Rule B — a locked format/tie_policy changes ONLY inside the audited override.** Reject when
        `old.format_locked AND (new.format IS DISTINCT FROM old.format OR new.tie_policy IS DISTINCT FROM old.tie_policy)`
        **unless** the transaction-local override flag is set (`P0001`, with a `hint` pointing at the RPC).
  - [x] **The override key is a transaction-local GUC:** the trigger reads
        `coalesce(current_setting('inclusivcup.format_override', true) = 'on', false)`, and
        `declare_match_format` is the **only** thing that sets it — and it always writes the `audit_log`
        row **in the same transaction**. That is what makes "audited override" a *mechanism* rather than a
        convention: the flag cannot exist without the audit row. (`current_setting(…, true)` returns NULL
        when unset → `coalesce` to false = fail closed.)
  - [x] The trigger must **not** fire on unrelated updates. Story 4.3 (advance) writes `winner_entry`,
        4.6 writes `score_*`/`state` — none touch `format`/`tie_policy`, so the `IS DISTINCT FROM` guards
        make those a no-op. Do not gate the whole UPDATE.

- [x] **Task 3 — Migration `0012`: the `declare_match_format` RPC (AC1, AC2, D2, D3)**
  - [x] `declare_match_format(p_tournament_id bigint, p_match_ids bigint[], p_format text, p_tie_policy text, p_actor_steamid64 text, p_override boolean)`
        → `returns jsonb`. `SECURITY INVOKER`, `set search_path = ''`. Mirror `generate_bracket`'s shape
        exactly ([0011_bracket_generation.sql:139-327]): **typed refusals RETURNED, not raised**; **every
        guard runs BEFORE any write**, so a refusal commits nothing.
  - [x] In one transaction:
        1. Assert the tournament exists → else `bad_tournament`.
        2. **Resolve the target set** (D2): `p_match_ids IS NULL` ⇒ every match of this tournament with
           `state='declared' AND format_locked=false` (the bulk path — byes/voids are naturally excluded,
           they are not `declared`). Otherwise ⇒ exactly `p_match_ids`, and **every id must belong to this
           tournament** → else `bad_match` (fail the whole call; never partially apply).
        3. `SELECT … FOR UPDATE` the target rows — serializes two concurrent declares on the same match so
           the loser refuses `already_locked` instead of both writing.
        4. Guards: `p_override = true` requires explicit `p_match_ids` → else `override_needs_ids` (never
           bulk-override a whole bracket by accident). A targeted match that is already
           `format_locked` without `p_override` → `already_locked`. An empty target set →
           `no_eligible_matches` (never a silent no-op — the repo's fail-closed convention,
           [lib/roster.ts:180-182]).
        5. Blank/NULL `p_format`/`p_tie_policy` → `bad_format`.
        6. **Override branch only:** `perform set_config('inclusivcup.format_override','on',true)` →
           `UPDATE match SET format, tie_policy, format_locked=true, format_overridden_at=now()` →
           **immediately** `set_config(…,'off',true)` (closes the window even if this RPC is ever called
           inside a larger transaction — e.g. by 4.6). Non-override branch sets no flag and leaves
           `format_overridden_at` untouched.
        7. **One `audit_log` row per match**, INSIDE the transaction: `action='declare_format'` (**needs no
           migration** — `action` is uncapped `text` and `declare_format` is already the enumerated
           vocabulary at [supabase/migrations/0003_audit_snapshot.sql:25] + AD-17), `target_match_id` = the
           match id (**this is the first audit row in the codebase to populate it** — the roster/registration
           rows leave it NULL, and 0010's new FK is what makes it meaningful),
           `detail = {before:{format,tie_policy,format_locked}, after:{…}, override:bool}` (AD-17 before/after).
        8. Return `{ok:true, declared: <count>, override: <bool>}`.
  - [x] Grants: `revoke execute … from public;` **then** `grant execute … to service_role;` — `CREATE
        FUNCTION` grants EXECUTE to PUBLIC by default and anon/authenticated inherit it, so the revoke is
        load-bearing, not decoration ([0011:329-336] documents exactly this).

- [x] **Task 4 — pgTAP proof `supabase/tests/0012_format_lock_test.sql` (AC1, AC2, D1, D3)**
  - [x] `plan(N)` **exact** count; `begin … rollback`; `create extension if not exists pgtap with schema
        extensions; set local search_path = extensions, public;` (mirror [supabase/tests/0011_bracket_generation_test.sql:36-41]).
  - [x] **AC1 bites:** `update match set state='live'` on an **unlocked** match `throws_ok '23514'`. The
        same update on a **locked** match `lives_ok`. Repeat for `pending`/`resolved`/`manual_resolved`.
        **Prove the exclusions too:** `state='bye'` / `'void'` / `'forfeit'` / `'awaiting_grace'` all
        `lives_ok` while unlocked (a regression that "helpfully" tightened the CHECK would break 4.1's
        generated bracket and 4.5's forfeit — pin it).
  - [x] **`match_format_lock_complete` bites:** `format_locked=true` with a NULL or blank `format`/
        `tie_policy` `throws_ok '23514'`.
  - [x] **AC2 / D1 — the silent edit is IMPOSSIBLE:** `set local role service_role;` then a direct
        `update match set format='mr8' where …` on a locked row `throws_ok 'P0001'`. **Do this as
        `service_role`, not `postgres`** — proving it bites the privileged single writer (BYPASSRLS skips
        policies, never triggers) is the entire point of D1, and a test that only runs as `postgres`
        proves nothing about the writer that actually exists.
  - [x] **The unlock bypass is closed:** `update match set format_locked=false` on a locked row
        `throws_ok 'P0001'`.
  - [x] **The override path works and audits:** `select declare_match_format(…, p_override => true)` on a
        locked match → returns `ok:true`, the row's `format`/`tie_policy` changed, `format_locked` is
        **still true**, `format_overridden_at` is **not null** (D3), and **exactly one** new `audit_log`
        row exists with `action='declare_format'` + `target_match_id` = that match + a `detail` carrying
        both `before` and `after`. **Assert the audit row's COLUMN VALUES, not just its existence** — the
        4.1 review's headline lesson was that a suite asserting only counts stays green through a broken
        JSONB payload.
  - [x] **The override flag does not leak:** after the RPC returns, a plain `update match set format=…`
        on that same match in the **same test transaction** still `throws_ok 'P0001'` (proves the
        `set_config(…,'off')` reset in Task 3.6 actually happened — without it the flag would stay armed
        for the rest of the transaction and the lock would be open for every subsequent write).
  - [x] **Refusals:** `bad_tournament`, `bad_match` (an id from another tournament), `already_locked`
        (no override), `override_needs_ids` (`p_override=true` with `p_match_ids => NULL`),
        `no_eligible_matches`, `bad_format` (blank). Each returns the typed reason **and writes nothing**.
  - [x] **D2 bulk:** on a generated bracket, `p_match_ids => NULL` locks exactly the `state='declared'`
        rows and leaves every `bye`/`void` row untouched (`format_locked` still false). Assert both halves.
  - [x] **EXECUTE grant matrix:** `has_function_privilege` — `service_role` = true; `anon` /
        `authenticated` = **false**.

- [x] **Task 5 — `lib/match/format.ts` (AC1, AC2, D2)**
  - [x] **The format catalog (organizer config — see Dev Notes):**
        `export const MATCH_FORMATS = ['mr12','mr8','bo3_mr12'] as const;`
        `export const TIE_POLICIES = ['ot_mr3','ot_mr3_unlimited','draw'] as const;`
        These are **build-time config, editable without a migration** — that is the whole payoff of the
        DB column being free `text` (OQ-4: *"Organizer/content config, not code"*). Validate against them
        in TS → a friendly `bad_format` (422); the DB's non-blank CHECK is the backstop, not the vocabulary.
  - [x] `declareMatchFormat(admin, { actingAdmin, tournamentId, matchIds?, format, tiePolicy, override? })`
        → a typed refusal union, exactly like `generateAndPersistBracket` ([lib/bracket/generate.ts:494-507,542]):
        validate the format/tie_policy against the catalog **before** any I/O → `admin.rpc('declare_match_format', {…})`
        → map the RPC's typed reply. `import 'server-only'` at the top; the `admin` client is **injected**
        (never constructed here) so the function is pure and Vitest-testable.
  - [x] Refusal union: `bad_tournament | bad_match | bad_format | override_needs_ids | already_locked | no_eligible_matches | write_failed`.

- [x] **Task 6 — `lib/match/format.test.ts` (Vitest)**
  - [x] Reuse the chainable/thenable `makeAdmin` mock **with its `.rpc()` seam** — it already exists at
        [lib/bracket/generate.test.ts:536-575]. Do **not** rebuild it from `lib/roster.test.ts` (that one
        predates `.rpc()` and cannot reach it).
  - [x] Assert: an unknown `format` / unknown `tie_policy` / blank string → `bad_format` **with no RPC
        call at all** (`expect(rpc).not.toHaveBeenCalled()`); the happy path calls `declare_match_format`
        with the **exact** payload (pin the arg names — a typo'd RPC key would otherwise NULL a column and
        stay green); each RPC refusal reason maps through unchanged; an RPC transport error → `write_failed`.

- [x] **Task 7 — Admin command route `app/api/admin/match/format/route.ts` (AC1, AC2)**
  - [x] Mirror [app/api/admin/bracket/route.ts] **verbatim in shape**: `export const runtime='nodejs';
        export const dynamic='force-dynamic'`; `getAdminClient()` + `createSupabaseServerClient()`;
        `requireAdmin(ssr, admin)` **first** (401/403 on refusal, before any read or write) → strict
        `parseBody` returning `null → 400` → `declareMatchFormat(...)` → map the typed refusal via a
        `Record<reason, status>`; one `try/catch` → JSON 500.
  - [x] Body: `{ tournament_id: number; match_ids?: number[]; format: string; tie_policy: string; override?: boolean }`.
        `parseBody` must reject a non-integer/negative id anywhere in `match_ids`, and an empty
        `match_ids: []` (ambiguous with "bulk" — reject it rather than guess).
  - [x] `STATUS_FOR`: `bad_tournament` 404 · `bad_match` 404 · `bad_format` 422 · `override_needs_ids` 422 ·
        `already_locked` 409 · `no_eligible_matches` 409 · `write_failed` 500.
  - [x] JSON responses, **no i18n** (a machine surface — the precedent is documented at
        [app/api/admin/registration/route.ts:19]). The Spanish admin console is Epic 5.

- [x] **Task 8 — REGRESSION: the existing pgTAP suite WILL go red, and that is correct (AC1)**
  - [x] **[supabase/tests/0010_match_test.sql:359-368] currently `lives_ok`s exactly what AC1 forbids:**
        it inserts a match (`format_locked` defaults false) and then `update match set state = 'live'`,
        asserting *"service_role UPDATEs a match state"*. Task 1's CHECK turns that into a `23514`.
        **This is the AC working, not a bug.** Fix it properly: declare + lock the row first, keep the
        `lives_ok` (it still proves the UPDATE **grant**, which is what that assertion is really for), and
        **add** a sibling `throws_ok '23514'` proving the unlocked transition is now refused. Account for
        the `plan(N)` delta — the repo keeps exact assertion-accounting (a standing convention since the
        Epic-1 retro).
  - [x] Run the **whole** suite: `supabase test db` + `npm test` + `npm run lint` + `npm run build`. The Go
        worker is untouched by this story (no `match` writes in `worker/`) — confirm, don't assume.
  - [x] Nothing in `app/` or `lib/` currently UPDATEs `match` (grep: the only writer is the
        `generate_bracket` RPC's INSERT), so the new trigger has **no existing TS caller to break**.

- [x] **Task 9 — Live-QA (do NOT mark the ACs done on unit tests alone)**
  - [x] Against a fresh `supabase db reset` + [supabase/fixtures/live-qa-bracket-seed.sql] (the standing
        **11-player** field from 4.1 → bracketSize 16 → 30 match rows, 5 byes), generate the bracket, then:
  - [x] **Bulk declare** (`match_ids` omitted) → returns `declared: <count>`; verify in SQL that
        `count(*) filter (where state='declared')` **equals** that count, that every `bye`/`void` row still
        has `format_locked=false`, and that there is **one `declare_format` audit row per declared match**,
        each with a non-null `target_match_id`.
  - [x] **AC1 live:** `update match set state='live'` on a still-unlocked (bye) row → rejected; on a
        declared+locked row → succeeds.
  - [x] **AC2 live:** a direct `update match set format='mr8'` as `service_role` on a locked row →
        **rejected `P0001`**; the same change through the route with `override:true` → succeeds, and the
        row now shows `format_overridden_at` set (D3) with a second `declare_format` audit row carrying
        `before`/`after`.
  - [x] **Re-run the bulk declare** → `no_eligible_matches` (409): everything is already locked. Idempotent
        and honest, not a silent no-op.

### Review Findings

_Code review 2026-07-13 (bmad-code-review, 3 parallel layers: Blind Hunter / Edge Case Hunter / Acceptance
Auditor, all at Opus 4.8 capability). Baseline `5b398ec`. **2 decision-needed, 10 patch, 3 defer, 12
dismissed.** All three layers independently found the headline defect, and **two of them EXECUTED it against
the live database** — it is confirmed, not theorised._

**What holds.** The Acceptance Auditor re-ran every gate rather than trusting the Dev Agent Record: pgTAP
**497 PASS**, Vitest **190 PASS**, lint clean, build clean, `plan(63)` and `plan(68)→plan(69)` both reconcile
exactly, and **every one of the story's ~30 line citations is accurate**. **AC1 is SATISFIED** — the two CHECK
constraints are constraints, not policies, so no GUC and no BYPASSRLS opens them; they bind every writer.
**D2 (bulk) is SATISFIED. D3's column exists and `manual_override` was NOT hijacked** — the headline trap was
correctly avoided. **Rule A (the latch) genuinely bites**, including under a forged GUC. **No scope creep.**
Section F's no-leak assertion is real and non-vacuous (the auditor checked this expecting it to be false).

**Decisions taken (Cuatro, 2026-07-13):** both decision-needed items are RESOLVED and become patches → **12 patches total**.
- **Decision 1 → option (b): the audit row IS the gate.** Drop the forgeable GUC entirely. A `constraint trigger … deferrable initially immediate` refuses **any** change to `format` / `tie_policy` / `format_locked` unless an `audit_log` row for that match landed **in the same transaction** (so the RPC writes the audit row *first*, then updates). This makes AC2 **literally true as a mechanism** — a frozen format cannot change without leaving an audit row, by construction, for *every* writer including `service_role` — and it closes the unaudited-first-declare hole in the same move. Self-contained in `0012`; no grant surgery, no future-column trap. A determined `service_role` can still change a format, but **only by also writing the audit row**, which is exactly what AC2 asks for.
- **Decision 2 → option (a): drop `bo3_mr12`.** The catalog ships `mr12` / `mr8` only. `match` has one `score_a`/`score_b`, one `demo_id`, one `winner_entry` (AD-18 = single demo per match), so a best-of-three has no representation and the latch would make a mis-pick escapable only via an audited override. Re-add when a story supports multi-map — the free-text column keeps that door open with no migration.

- [x] **[Review][Patch ← Decision 1, resolved: option (b)] AC2/D1 are FALSE as shipped: the override gate is a forgeable USERSET GUC, so `service_role` CAN silently edit a frozen format with zero audit rows.** `inclusivcup.format_override` is a custom two-part GUC; PostgreSQL creates these as `PGC_USERSET` **placeholders that any role may `SET` with no privilege whatsoever**. The gate the trigger reads at [supabase/migrations/0012_format_lock.sql:134](supabase/migrations/0012_format_lock.sql#L134) is therefore a variable its adversary controls — and the adversary is exactly the writer D1 names. **Executed live, as `service_role`:** `select set_config('inclusivcup.format_override','on',true);` then `update match set format='FORGED' where id=<locked>` → **`UPDATE 1`, zero `declare_format` audit rows.** This falsifies verbatim the migration's own claim ([0012:98-100](supabase/migrations/0012_format_lock.sql#L98-L100) — *"the flag cannot exist without the audit row… Anything else that tries to edit a locked format — including `service_role`, including `postgres` — is refused"*), the identical sentence in the Completion Notes, and the pgTAP message at [supabase/tests/0012_format_lock_test.sql:223-227](supabase/tests/0012_format_lock_test.sql#L223-L227) (*"service_role CANNOT silently edit a locked format"* — it proves only that it cannot do so **without setting the GUC**). **Same gap, second face:** both trigger rules key on `old.format_locked`, so the `false → true` **first declare is unguarded too** — `update match set format='mr8', tie_policy='draw', format_locked=true` latches a format permanently with **no audit row, no actor, no RPC**, and the row then reads as legitimately declared (`format_overridden_at IS NULL` = "never overridden"). The pgTAP suite **depends** on that hole (Section C's final `lives_ok`; 0010's new fixture line). **Fair framing:** the story SPECCED this mechanism verbatim (Task 2, bullet 3), so the dev built exactly what was asked — but D1 is binding (*"must be provable against a direct `service_role` SQL write"*) and the shipped guarantee is provably false. **Options: (a)** column-level grants — `revoke update (format, tie_policy, format_locked, format_overridden_at) on public.match from service_role` + make the RPC `SECURITY DEFINER`; the gate becomes a *capability*, not a variable, and this closes the forged GUC, the unaudited first declare, AND patch P3 in one move (cost: pgTAP fixtures that latch by raw UPDATE must call the RPC instead). **(b)** a `DEFERRABLE INITIALLY DEFERRED` constraint trigger that at COMMIT requires an `audit_log` row per match whose format changed — makes "no format change without an audit row" true by construction (cost: commit-time check + its own assertion accounting). **(c)** accept the GUC as an anti-accident speed bump (it DOES defeat the practical threat D1 names — a future story's *innocent* `update match set format=…`) and correct the false claims in the comments, the test messages, and the Completion Notes.
- [x] **[Review][Patch ← Decision 2, resolved: option (a)] `bo3_mr12` ships in the catalog but the schema cannot represent a best-of-three.** [lib/match/format.ts:31](lib/match/format.ts#L31) makes `bo3_mr12` a first-class, permanently-latchable value, but `match` has exactly one `score_a`/`score_b`, one `demo_id`, one `winner_entry`, and AD-18 is single-demo-per-match. An admin who picks it creates a row the rest of the system cannot represent, and the latch means the only escape is an audited override. Lands directly on the story's own **Open Question #1**. **Options: (a)** drop `bo3_mr12` until a story supports Bo3; **(b)** keep it (aspirational — Cuatro simply won't pick it); **(c)** a different starter set.

- [x] **[Review][Patch] The targeted path has NO state filter — one route call irreversibly locks a format onto a `bye`/`void`/`forfeit` row.** The bulk branch filters `state='declared'`; the targeted branch does not. Executed live: `{match_ids:[<bye id>], format:'mr12'}` → `{ok:true, declared:1}`, row now `state='bye', format_locked=true`. **Unrecoverable** — Rule A's latch refuses `format_locked=false` even to `postgres`. Contradicts the migration's own claim at [0012:201-204](supabase/migrations/0012_format_lock.sql#L201-L204) and the pgTAP at [0012_format_lock_test.sql:369-374](supabase/tests/0012_format_lock_test.sql#L369-L374), which exercises **only the bulk path**. Also a TOCTOU: `state` is never re-validated after the `FOR UPDATE`, so a 4.5 forfeit committing mid-call gets locked too. [supabase/migrations/0012_format_lock.sql:211-231](supabase/migrations/0012_format_lock.sql#L211-L231)
- [x] **[Review][Patch] `override:true` on a never-locked match falsely stamps `format_overridden_at` and writes an `override:true` audit row for a FIRST declare.** The lock re-read is skipped entirely when `v_override` is true, so `v_override` is never validated against the rows' real `format_locked`. Executed live: a fresh never-declared match + `override:true` → flag stamped, `detail.before = {format:null, tie_policy:null, format_locked:false}`. Inverts the column's own contract (*"NULL = never overridden"*) — the negation an Epic-5 match card reads is now false. The Completion Notes claim this is *"asserted both ways"*; it is asserted one way (the bulk path only). [supabase/migrations/0012_format_lock.sql:251](supabase/migrations/0012_format_lock.sql#L251), [:303-308](supabase/migrations/0012_format_lock.sql#L303-L308)
- [x] **[Review][Patch] `format_overridden_at` is guarded by neither rule — the D3 flag can be forged or silently erased, with no GUC and no audit.** Executed live as `service_role` with no GUC set: `update match set format_overridden_at = now()` forges an override badge; `update match set format_overridden_at = null` erases one. Neither writes an audit row. **Disclosed honestly by the dev** ("Two things for the reviewer" #1) and deliberately not fixed unilaterally — but D3 is binding, and a flag any writer can null out is not "visible on the record". Fix: add the column to Rule B's `IS DISTINCT FROM` set. *(Subsumed if the decision above goes to option (a).)* [supabase/migrations/0012_format_lock.sql:131-140](supabase/migrations/0012_format_lock.sql#L131-L140)
- [x] **[Review][Patch] `btrim()` trims SPACES ONLY — a tab or newline is a "real" format and latches permanently.** `btrim(E'\t') = E'\t' <> ''`, so `declare_match_format(…, E'\t', E'\n', …)` sails past the `bad_format` guard **and** the `match_format_lock_complete` CHECK whose banner reads *"A LOCK MUST LOCK SOMETHING REAL"*. Reachable via a direct RPC call — the same privileged-writer threat model D1 names. Fix: `btrim(x, E' \t\r\n')` (or `~ '\S'`). [supabase/migrations/0012_format_lock.sql:74-75](supabase/migrations/0012_format_lock.sql#L74-L75), [:273-274](supabase/migrations/0012_format_lock.sql#L273-L274)
- [x] **[Review][Patch] The audit-`detail` assertions cover only the `format` key — `tie_policy` and `format_locked` in `before`/`after` are never asserted.** A typo in any of those four `jsonb_build_object` keys would NULL the payload with the suite fully green — **exactly the 4.1 lesson this file's own header invokes** at [:21-24](supabase/tests/0012_format_lock_test.sql#L21-L24). [supabase/tests/0012_format_lock_test.sql:307-318](supabase/tests/0012_format_lock_test.sql#L307-L318)
- [x] **[Review][Patch] `FOR UPDATE` runs BEFORE the pure-argument guards — a request that was always going to be refused row-locks the whole tournament first.** `override_needs_ids` and `bad_format` depend on nothing but the parameters, yet run after step 2 materialised every declared match and step 3 locked them all. A retrying client firing `{override:true}` with no `match_ids` blocks every concurrent writer for the transaction's life, then refuses. Move the parameter-only checks to the top. [supabase/migrations/0012_format_lock.sql:236-240](supabase/migrations/0012_format_lock.sql#L236-L240)
- [x] **[Review][Patch] The concurrency comment describes behaviour the code does not have; a raced bulk declare refuses the ENTIRE call with a misleading `already_locked`.** The comment claims the loser *"resolves it out of the target set"* — it does not: `v_target` is computed once and never recomputed, so the loser's re-read counts the now-locked row and refuses everything, though the rest were eligible. Fail-closed and retry-safe, but the code does not do what it says. Fix: re-resolve after the `FOR UPDATE` and let an emptied set fall to `no_eligible_matches`. [supabase/migrations/0012_format_lock.sql:233-235](supabase/migrations/0012_format_lock.sql#L233-L235)
- [x] **[Review][Patch] An out-of-range id (`1e21`) passes `parseBody` → PG `22003` → HTTP 500 where a malformed id should be 400.** `Number.isInteger(1e21)` is `true`. Fix: `&& v <= Number.MAX_SAFE_INTEGER`. [app/api/admin/match/format/route.ts:51-52](app/api/admin/match/format/route.ts#L51-L52)
- [x] **[Review][Patch] `{ok:true, declared:0}` is reported to the caller as a successful declare.** `typeof declared !== 'number'` accepts `0`, so the route returns 200 `{ok:true, declared:0}`. Unreachable today — but the fix for the targeted-path patch above adds exactly the predicate that makes it reachable. Fix: `if (!Number.isInteger(declared) || declared < 1) return write_failed`. [lib/match/format.ts:157](lib/match/format.ts#L157)
- [x] **[Review][Patch] `match_ids` is unbounded** — a 100k array becomes a 100k `unnest` + correlated `NOT EXISTS` + 100k-row `FOR UPDATE` + 100k audit inserts in one transaction. Admin-authenticated, so a foot-gun rather than an attack; a cap costs one line. [app/api/admin/match/format/route.ts:71](app/api/admin/match/format/route.ts#L71)

> **Test-coverage note attached to the patches above.** Three of the confirmed defects live in code paths the
> suite **never executes** — the forged GUC, a targeted declare on a non-`declared` row, and any direct write
> to `format_overridden_at`. Each patch must ship the pgTAP assertion that would have caught it, with
> `plan(63)` re-accounted (the standing exact-assertion-accounting convention).

- [x] **[Review][Defer] `P0001` is PL/pgSQL's GENERIC exception code — the `already_locked` mapping will misfire the moment a second `match` trigger raises it.** [lib/match/format.ts:89](lib/match/format.ts#L89) — deferred; verified that today the only `P0001` source in this RPC's blast radius is `match_format_lock_guard`, so no misclassification is currently reachable. Story 4.5's state-machine guard is the collision.
- [x] **[Review][Defer] Nothing in TypeScript maps `23514` — whoever lands `declared → live` inherits an opaque `check_violation`.** [supabase/migrations/0012_format_lock.sql:87-90](supabase/migrations/0012_format_lock.sql#L87-L90) — deferred; by design (4.2 lands the guard BEFORE the writer, the inverse of 4.1's D3). The story that adds the transition must map it to a friendly "declare the format first" refusal.
- [x] **[Review][Defer] The same unbounded-integer gap exists in the bracket route.** [app/api/admin/bracket/route.ts:52](app/api/admin/bracket/route.ts#L52) — deferred, pre-existing (Story 4.1), not introduced here.

**Dismissed as noise (12):** *"the migration hard-fails on existing rows / needs a backfill"* (**false** — no row can violate either CHECK: `generate_bracket` only emits `declared`/`bye`/`void`, nothing in the codebase sets a played state, the live-QA fixture seeds no match rows, and the migration applied cleanly on the live DB); *"`state` is nullable so the CHECK is vacuous"* (**false** — [0010:64](supabase/migrations/0010_match.sql#L64) is `not null default 'declared'`); *"`server-only` breaks Vitest"* (**false** — `npm test` = 190 passed); CSRF (out of scope, Epic 7, already in deferred-work.md); *"the catalog lives only in TS"* (by design — OQ-4; SOLUTION-DESIGN deliberately gives these two columns no CHECK); *"`awaiting_grace` may be a post-play state"* (by design — it is the pre-play no-show window, Story 4.5); *"no production caller / unmapped 23514"* (the route IS the caller; nothing sets `live` yet — the residual is deferred above); *"`throws_ok '23514'` doesn't assert WHICH constraint"* (repo convention, and no other `match` CHECK can fire on those updates); *"`p_actor_steamid64` is unvalidated"* ([0003:24](supabase/migrations/0003_audit_snapshot.sql#L24) is `not null references player(steamid64)`, so a bad actor aborts the whole transaction — fail-closed — and the route's only caller passes `requireAdmin`'s `gate.steamid64`); *"the `array_agg(distinct …)` dedup is inert"* (true but harmless — `= ANY(array[6,6])` matches once anyway); the story's shorthand context-doc paths (doc nit); and the Edge Case Hunter's own verified-handled list (empty array, NULL elements, duplicate ids, `FOR UPDATE`-under-`PERFORM` semantics, the GUC on the exception path, `search_path`, `STATUS_FOR` exhaustiveness, both `plan()` counts, and Section F's no-leak assertion — all confirmed non-findings).

### Review Fixes Applied (2026-07-13) — all 12 patches landed

| Gate | Before review | After fixes |
|---|---|---|
| pgTAP (`supabase test db`) | 497 | **512 PASS** (`0012` `plan(63) → plan(78)`; `0010` holds at 69) |
| Vitest (`npm test`) | 190 | **194 PASS** (`format.test.ts` 20 → 24) |
| ESLint / `npm run build` | clean | **clean** — `/api/admin/match/format` still registered |
| Go worker (`build`/`vet`/`test`) | clean | **clean** — re-confirmed by grep that it never touches `match` (0 hits) |
| **Live adversarial replay** | — | **6/6 attacks refused, 5/5 typed refusals, both legit paths intact** |

**The mechanism changed, and that is the headline.** `inclusivcup.format_override` is **gone**. The gate is now
`match_format_audited`, a constraint trigger that refuses any change to `format` / `tie_policy` /
`format_locked` / `format_overridden_at` unless a `declare_format` `audit_log` row for that match — written
by **this transaction**, and **describing this exact result** — already exists. `declare_match_format` writes
its audit rows **before** the UPDATE. The audit row is the override's **precondition**, not its receipt. AC2
(*"never a silent edit"*) is now true as a **mechanism**, for every writer including `service_role` and
`postgres`: a frozen format cannot change without leaving an accurate audit row. An *audited* change remains
possible, which is exactly and only what AC2 asks for.

**The live replay is what makes this a claim rather than a hope.** I re-ran the review's attacks against the
real database as `service_role` (`begin … rollback`, nothing persisted):

| Attack (as `service_role`) | Result |
|---|---|
| ⭐ Arm the old GUC by hand, then edit a frozen format — **the exact two lines that COMMITTED pre-fix** | **refused `P0001`** |
| Plain silent edit of a frozen `format` / `tie_policy` | **refused `P0001`** |
| Unlock the latch (`format_locked = false`) | **refused `P0001`** |
| ⭐ Unaudited raw declaration (`format_locked` false → true) | **refused `P0001`** |
| ⭐ Forge the D3 badge (`format_overridden_at = now()`) | **refused `P0001`** |
| ⭐ Re-edit the same match later in the same transaction, on the back of its own audit row | **refused `P0001`** |
| CONTROL — `score_a`/`score_b` on a locked match (4.3/4.5/4.6 must not break) | **permitted** ✓ |
| LEGIT — bulk declare | `declared: 3`, the `bye` untouched, 3 audit rows, all with `target_match_id` |
| LEGIT — audited override | `override: true`, `format_overridden_at` **stamped**, `before {mr12, ot_mr3, true}` / `after {mr8, draw, true}` |
| Typed refusals | `not_declarable` · `not_overridable` · `bad_format` (TAB) · `already_locked` · `no_eligible_matches` — all correct, all wrote nothing |

**⚠ THE LIVE RUN CAUGHT WHAT THE SUITE DID NOT — and that is the lesson worth keeping.** The first version of
the fix passed all 510 pgTAP assertions and *still* let the D3 badge be forged: a transaction that had
**legitimately declared** a match could then stamp `format_overridden_at` on it, because that declare's own
audit row satisfied the gate. The suite missed it because its forge target had no audit row at all — the easy
half. The fix ties the badge to the row that authorized it (`detail.override = true` ⟺ `format_overridden_at
IS NOT NULL`), and **both halves are now pinned in pgTAP** (`0012` Sections F2 and G10) so the suite catches
it next time instead of the human gate. `detail.override` is therefore **load-bearing**, not decoration.

**The other eleven:**
- **Targeted declare had no state filter** — one route call could irreversibly lock a format onto a
  `bye`/`void` row (the latch made it unrecoverable *even for `postgres`*). The targeted path now enforces
  the same `state = 'declared'` contract the bulk path always did → new typed refusal **`not_declarable`** (409).
- **`override:true` on a never-locked match** stamped `format_overridden_at` and wrote an `override:true`
  audit row for what was really a first declare — inverting the flag Epic 5 reads → new **`not_overridable`** (409).
- **`btrim()` trims spaces only**, so a TAB was a "real" format and latched forever. Both the CHECK and the
  RPC guard now use `~ '[^[:space:]]'`.
- **The audit `detail` was asserted on `format` only** — a typo in any of the other four `jsonb_build_object`
  keys would have NULLed the payload with the suite green (the 4.1 lesson, half-learned). All six keys of
  both halves are now asserted.
- **`FOR UPDATE` ran before the pure-argument guards**, so a doomed `{override:true}` with no ids row-locked
  every declared match in the tournament and only *then* refused. `bad_format` and `override_needs_ids` now
  run first, before any read.
- **The bulk path's concurrency comment described behaviour the code did not have** — a raced bulk declare
  refused the *entire* call with a misleading `already_locked`. It now genuinely re-resolves under the lock
  and lets an emptied set fall to `no_eligible_matches`.
- **`bo3_mr12` dropped** from the catalog (Decision 2): `match` has one `score_a`/`score_b`, one `demo_id`,
  one `winner_entry`, and AD-18 is single-demo-per-match — a Bo3 has no schema home, and the latch would have
  made a mis-pick escapable only through an audited override.
- **`1e21` passed `parseBody`** (`Number.isInteger(1e21)` is `true`) → PG `22003` → HTTP 500 where a malformed
  id is a 400. Bounded by `Number.MAX_SAFE_INTEGER`.
- **`{ok:true, declared:0}`** was reported to the admin as a successful declare. Now fails closed.
- **`match_ids` was unbounded** → capped at 256 (a 64-player field is 126 matches).
- **`0010_match_test.sql`'s fixture latched a format by raw UPDATE**, which the new gate correctly refuses. It
  now INSERTs a pre-locked row instead (INSERT is deliberately ungated — generation creates every row
  unlocked, and the two CHECKs already bind it). `plan(69)` unchanged.

**What was NOT re-executed.** The `declare_match_format` **signature is unchanged** (same name, same six
arguments), so the `supabase-js → PostgREST → RPC` seam proven at the original Task-9 run still holds, and the
lib's exact RPC payload is pinned argument-by-argument in Vitest. The full Task-9 HTTP live-QA on the standing
11-player fixture was **not** re-driven end to end; the DB layer — where AC1/AC2/D1/D3 actually live — was
proven live and adversarially, which is strictly more than the original sign-off did.

## Dev Notes

### Scope & boundaries — what 4.2 owns, and what it explicitly does NOT

**4.2 OWNS:** the AD-10 lock, end to end — the two CHECK constraints, the no-silent-edit trigger, the
`declare_match_format` RPC + route + lib, the `format_overridden_at` flag (D3), and the pgTAP that proves
all of it bites the service role.

**OUT OF SCOPE — do NOT build here** (each has an owning story; building it now is scope creep):
- **The `declared → live` transition itself.** Nothing in the codebase sets `state='live'` today, and no
  story explicitly claims it (see §"An ownership gap you should know about"). 4.2 installs the **guard**;
  whoever lands the transition inherits a lock they cannot bypass. Do **not** build a "start match" route.
- **Idempotent conditional advance** → Story 4.3. **GF-reset row (`gf_order=2`)** → 4.4.
- **Forfeit + grace timer** (`awaiting_grace`, the 10-min timer, `mark_walkover`) → Story 4.5.
- **Aprobar / demo-derived score / `state='resolved'`** → Story 4.6. **No score is written in 4.2.**
- **Rollback** → 4.7. **Manual score override (`manual_override`, `score_source='admin_manual'`)** → 4.8.
- **The reusable audited-command-route helper** → 4.9. 4.2 writes its audit rows inline in the RPC, the
  same way 4.1 did; 4.9 generalizes the boilerplate across all of them.
- **`score_source_guard` tightening.** [deferred-work.md] carries *"`score_source_guard` permits a score
  with no provenance"* — homed to **4.6**, explicitly not here. Do not touch that CHECK.
- **CSRF on admin POST routes.** Deferred to Epic 7, uniformly across *all* admin routes
  ([deferred-work.md], 4.1 review). The new route inherits the same posture as its siblings — do not
  bolt a one-off defence onto this route alone.
- **Viewer/admin UI, Spanish copy, realtime.** Epic 5. The route is JSON.
- **`tournament.format_default`.** See §"Two schema columns you should deliberately leave alone".

### What already exists — read this before you write a line of DDL

Story 4.1 shipped the columns and **named this story as their owner**:

| Column | Where | State after 4.1 |
|---|---|---|
| `match.format text` | [supabase/migrations/0010_match.sql:56] | NULL — *"declared + locked BEFORE start (AD-10) -> Story 4.2"* |
| `match.tie_policy text` | [supabase/migrations/0010_match.sql:57] | NULL — *"-> Story 4.2"* |
| `match.format_locked boolean not null default false` | [supabase/migrations/0010_match.sql:58] | false |

0010's own header is unambiguous [0010_match.sql:19-20]:
*"format/tie_policy DECLARATION + format_locked=true (AD-10) -> Story 4.2. The columns exist here; 4.1
leaves them NULL/false (the DDL defaults)."*
And its pgTAP already pins the pre-state [0010_match_test.sql:106]:
*"match: format_locked defaults to false (the AD-10 lock is Story 4.2)"*.

**So: you are NOT adding `format`/`tie_policy`/`format_locked`. You are adding the LOCK.** The only new
column is D3's `format_overridden_at`.

Likewise **`declare_format` needs no migration.** `audit_log.action` is uncapped `text` and the vocabulary
is already written down in three places: [0003_audit_snapshot.sql:25], [SOLUTION-DESIGN.md:251], and AD-17
[ARCHITECTURE-SPINE.md:163] — all list `declare_format` explicitly. `lib/roster.ts` established the same
"new action string, no migration" precedent ([lib/roster.ts:70-98]).

### The one shortcut that would be a disaster

**`match.manual_override` already exists and looks like it means "the admin overrode something". DO NOT
USE IT FOR THE FORMAT OVERRIDE.**

It is AD-5's **score-source** flag, and it is *read by a live CHECK constraint*
([supabase/migrations/0010_match.sql:124-128]):

```sql
alter table public.match add constraint score_source_guard check (
  score_source is null
  or (score_source = 'demo_derived' and demo_id is not null)
  or (score_source = 'admin_manual'  and (demo_id is null or manual_override = true))   -- ← here
);
```

Setting `manual_override = true` because an admin corrected a *format* would **silently legalize a
hand-typed `admin_manual` score on a match that has a demo** — precisely the "a demo-derived score and a
hand-entered score silently disagreeing" failure AD-5 exists to prevent, and it would land *before*
Story 4.6/4.8 (the stories that actually own scores) ever run. Two different overrides, two different
columns. Hence D3's separate `format_overridden_at`.

### Format values are organizer config, NOT a CHECK enum

The repo's convention is *"Closed-set text columns are CHECK-constrained enums"* [ARCHITECTURE-SPINE.md:234],
and you will be tempted to add `check (format in ('mr12','mr8'))`. **Don't.** The architecture deliberately
excludes these two columns from that convention:

- **SOLUTION-DESIGN §3's DDL gives every other closed-set column a CHECK and gives `format`/`tie_policy`
  none** ([SOLUTION-DESIGN.md:120-122] vs `bracket`, `state`, `score_source` right beside them). That is a
  signal, not an omission.
- **The Deferred list says so outright** [ARCHITECTURE-SPINE.md:471]: *"OQ-4 match formats … Organizer/
  content config, **not code**: `match.format`+`tie_policy` …"*. A CHECK enum would mean a **migration**
  every time Cuatro wants MR8 instead of MR12 for a round — for a casual private event that is exactly
  backwards.

**So:** the DB gets only a **non-blank** guard (inside `match_format_lock_complete`); the **vocabulary**
lives in `lib/match/format.ts` as a plain `as const` array the route validates against (→ friendly 422).
Editing the catalog is a one-line TS change with no migration. If Cuatro later wants a hard closed set,
it is a one-line `ALTER TABLE … ADD CONSTRAINT` in a future migration — the free-text column keeps that
door open; a CHECK enum does not keep the other one.

The starter catalog (`mr12` / `mr8` / `bo3_mr12`; `ot_mr3` / `ot_mr3_unlimited` / `draw`) is grounded in
PRD's *"e.g., MR12 + overtime rule"* [prd.md:518] and the admin mockup's `de_mirage · MR12`. Ship it;
Cuatro can edit the array.

### Why a trigger, and not "the RPC is the only writer, so it's fine"

This is the **exact** argument Story 4.1's D3 had to settle, and the answer has not changed:

- `service_role` holds `UPDATE` on `match` ([0010_match.sql:227]) — it must, because *every* later story
  moves a match through it (advance 4.3, GF 4.4, forfeit 4.5, approve 4.6, rollback 4.7, score 4.8).
- `service_role` has **BYPASSRLS**, so **no policy can constrain it** — and `match` deliberately has no
  viewer policy at all this slice.
- **BYPASSRLS does not skip triggers.** The trigger is the only mechanism that can make AC2's "never a
  silent edit" true against the writer that actually exists. 4.1 proved this bites for real (its D3 trigger
  rejected all three roster write paths at live-QA, executed as `service_role`).

A route-level or RPC-level-only guard would be a *convention* that the next story silently breaks with one
innocent `update match set …`. The repo's philosophy is stated plainly in 4.1's notes: **the lib is UX, the
DB is truth.** Keep the TS-side catalog validation as the friendly early exit; the trigger is the teeth.

### The `audit_log.target_match_id` milestone

This story writes the **first** audit rows in the codebase that populate `target_match_id`. The column has
existed since 0003 as a plain nullable `bigint` with its FK *deferred to Epic 4*
([0003_audit_snapshot.sql:26]); Story 4.1 closed that FK (D1). The roster/registration audit rows
([lib/roster.ts:85-98]) legitimately leave it NULL — they are tournament-scoped. A `declare_format` row is
**match**-scoped, so it must set it. Do not skip it: it is what makes the override "flagged on the record"
traceable back from the audit side, and what an Epic-5 match card will read.

### Command-route + RPC pattern — copy 4.1, do not invent

[app/api/admin/bracket/route.ts] is the closest reference and it is 40 lines. The whole stack:

```
route (thin: requireAdmin → parseBody → lib → STATUS_FOR map)
  └─ lib/match/format.ts (catalog validation + typed refusal union + admin.rpc(...))
       └─ declare_match_format RPC (0012: guards BEFORE writes → UPDATE → audit, one txn)
            └─ match_format_lock trigger + the 2 CHECKs (the teeth — bite even service_role)
```

- **Typed refusals, never exceptions**, for every expected outcome; the route maps them to HTTP via a
  `Record` ([app/api/admin/bracket/route.ts:29-42]).
- **Every guard before any write**, so a refusal commits nothing ([0011_bracket_generation.sql:136-138]).
- **Audit inside the transaction** — the RPC makes it atomic, which 4.1 flagged as a strict improvement on
  `lib/roster.ts`'s after-the-fact `writeAudit` ([0011:304-307]).
- **`requireAdmin` is the authorization gate** — use it verbatim, do not re-implement admin gating
  ([lib/auth/admin-guard.ts:34]; its docstring names Epic-4 command routes as its reason for existing).
  The RPC's `service_role`-only EXECUTE grant is the second lock on the same door.
- **Never a silent no-op:** a 0-row guarded write returns a typed refusal ([lib/roster.ts:180-182]).

### Two schema columns you should deliberately leave alone

1. **`tournament.format_default`** ([supabase/migrations/0001_core_schema.sql:31], nullable, unused since
   Story 1.2 landed it as a forward-looking shell). **Do not wire it in.** D2's bulk declare already gives
   the organizer "one format for the whole bracket" in a single call, which is all `format_default` was
   ever for — and there is **no `tie_policy_default` sibling**, so a fallback would be half a feature and
   would tempt you into inventing a column the spec does not have. Leave it dormant. (Raised as an open
   question below.)
2. **`match.manual_override`** — see the disaster above. It belongs to Story 4.8.

### An ownership gap you should know about (do not fix it here)

**No story in Epic 4 explicitly owns the `declared → live` transition.** The spine's match lifecycle has it
([ARCHITECTURE-SPINE.md:306] — *"Declared --> Live: both present"*), but 4.3 is advance-on-result, 4.5 is
bye/forfeit/grace, 4.6 is Aprobar (Pending → Resolved). Nothing sets `live`.

Two consequences, both intentional:
- **AC1 is provable only at the SQL layer in this story.** pgTAP drives the transition directly
  (`update match set state='live'`), which is exactly the right proof — the CHECK constrains *any* writer,
  not one route. Live-QA does the same. This is sufficient; do not build a route to make it demonstrable.
- **The guard must land BEFORE the writer, not after.** This is the *inverse* of 4.1's D3 (which waited
  until a concurrent `bracket_live` writer existed to close the roster TOCTOU). Here, the moment 4.5/4.6
  can flip a match to `live`, an unlocked match could go live and AD-10 would already have been violated.
  Landing the CHECK now means that transition is born safe.

Flagged for Cuatro in the questions below — it most likely rides with 4.5 (the match-lifecycle story) or
the Epic-5 admin console.

### Previous-story intelligence (Story 4.1 — the lessons that cost the most)

4.1 shipped, was code-reviewed hard (2 decision-needed + 11 patches, all applied), and the review's
findings map almost one-to-one onto the traps in this story:

- **"The suites proved materially less than they claimed."** The pre-fix pgTAP asserted **row counts**, so
  a broken JSONB key would have NULLed every column with the suite fully green. → Task 4 asserts **column
  values**, including the audit `detail`'s `before`/`after`.
- **"An empty `p_matches` committed an unrecoverable live tournament."** The RPC trusted its caller's
  payload. → Task 3 validates `p_format`/`p_tie_policy`/`p_match_ids` **before any write**, and `bad_match`
  fails the *whole* call rather than partially applying.
- **"The D3 trigger's `P0001` was unmapped → the one path it existed for reported HTTP 500."** → The new
  trigger's `P0001` must map to a typed refusal, not fall through to `write_failed`. (In this story the RPC
  owns the override path, so a `P0001` reaching TS means a *direct* illegal write — but map it anyway
  rather than 500; see [lib/roster.ts:26-54] for the classify-by-SQLSTATE pattern.)
- **"The trigger ignored `OLD` — a seeded entry could be moved OUT of a frozen roster."** Guard **both
  ends** of a state change. → Rule A (the `format_locked` latch) is the direct analogue: guard the
  transition *out* of locked, not just writes while locked.
- **Live-QA is a real gate.** 4.1's Task-9 sign-off drove an 11-player field that the review then proved
  could never complete; the re-run was recommended and **waived by Cuatro** (recorded honestly in the story
  and in sprint-status). Do not repeat the pattern of proving the happy path only.
- **This is app/lib (TypeScript) + SQL work.** Ground your patterns in Epic 2 + Story 4.1, **not** the Go
  worker (all of Epic 3). The worker does not touch `match`.

**Retro action items:** none are homed to 4.2. 4.1 closed **epic-2 #7** and **epic-3 #3**. The two still
open (**epic-3 #4**: 4.6 absorbs deferred 3.7; **epic-3 #5**: the Epic-5 conservation-gate relaxation)
belong to later stories and only inform the OUT-OF-SCOPE boundary above.

### Testing requirements (conventions — non-negotiable)

- **pgTAP** ([supabase/tests/NNNN_<name>_test.sql], `supabase test db`): `create extension if not exists
  pgtap with schema extensions; set local search_path = extensions, public;` then **`select plan(N)`** with
  an **exact** count (standing convention since the Epic-1 retro); `begin … rollback` so nothing persists;
  seed as `postgres` (bypasses RLS), then `set local role service_role` to prove the guards bite the real
  writer. SQLSTATEs: `23514` CHECK · `23502` not-null · `23503` FK · `23505` unique · `42501`
  insufficient_privilege · **`P0001`** the trigger's raise.
- **Vitest** (`npm test` → `vitest run`, pinned `vitest@4.1.9`): colocated `*.test.ts`; injected clients;
  the `.rpc()`-capable mock is at [lib/bracket/generate.test.ts:536-575].
- **Both layers required:** DDL/CHECK/trigger/RPC ⇒ pgTAP; catalog + orchestration + refusal mapping ⇒
  Vitest; the lock actually holding on a real bracket ⇒ the human gate (Task 9), never "unit tests pass"
  alone.

### Git intelligence (recent commits)

`5b398ec` (4.1 code-review → done, 11 patches) · `8cde0a2` (4.1 implementation) · `d8c5277` (Epic-3 retro
close-out) · `0bef580` (the standing live-QA fixture). The working tree is clean and `main` is the branch.
The immediately-relevant artifacts are 4.1's: migrations 0010/0011, `lib/bracket/`, `app/api/admin/bracket/`,
and `supabase/fixtures/live-qa-bracket-seed.sql` (the 11-player field Task 9 reuses). **4.2 builds directly
on 4.1's surface — read 0010 and 0011 before writing 0012.**

### Latest tech / versions (all pinned — no upgrade, no web lookup needed)

From [package.json] + [ARCHITECTURE-SPINE.md#Stack]: Next.js **16.2.10** (App Router, Node ≥20.9),
`@supabase/supabase-js` **2.110.0**, `@supabase/ssr` **0.12.0**, TypeScript **5.9**, Vitest **4.1.9**,
Supabase Postgres **15+**, pgTAP (in `extensions`). `admin.rpc(fn, args)` is standard supabase-js 2.x.
**No new dependency is required for this story** — no crypto, no clock beyond `now()` in SQL.
`set_config(name, value, is_local => true)` and `current_setting(name, missing_ok => true)` are stock
Postgres; a dotted custom GUC (`inclusivcup.format_override`) needs no prior definition.

### Project Structure Notes

New files land where the spine's source tree puts them ([ARCHITECTURE-SPINE.md:437-452]): `app/api/admin/`
= *"server-gated mutations"*; `supabase/migrations/` = the shared schema+RLS contract. Expected additions:
`supabase/migrations/0012_format_lock.sql`, `supabase/tests/0012_format_lock_test.sql`, `lib/match/format.ts`
(+ `.test.ts`), `app/api/admin/match/format/route.ts`. One modified file:
`supabase/tests/0010_match_test.sql` (Task 8 — the deliberate regression).

`lib/match/` is a **new directory**. It is the right home: `lib/bracket/` is scoped to *"double-elim
routing, idempotent advance, two-loss-from-edges"* [ARCHITECTURE-SPINE.md:445], and the format lock is a
match-lifecycle concern, not a routing one. Stories 4.5–4.8 will land beside it.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2 (lines 656-672)] — the two ACs + traces;
  #Epic 4 (630-632) — the epic owns the `match` + `audit_log` slice.
- [Source: ARCHITECTURE-SPINE.md] — **AD-10 (125-128)** the whole story in four lines; AD-17 (160-163,
  `declare_format` enumerated); AD-5 (100-103, why `manual_override` is off-limits); AD-8 (115-118);
  Match-lifecycle diagram (299-317, incl. `Declared: format+tie_policy locked` at 303 and
  `Declared --> Live` at 306); Consistency Conventions (225-235); Deferred **OQ-4 (471)** — formats are
  organizer config, not code; Structural Seed (435-452).
- [Source: SOLUTION-DESIGN.md] — §3 (110-139) the `match` DDL: `format`/`tie_policy`/`format_locked` at
  120-122 with **no CHECK**, `score_source_guard` at 135-139; `audit_log.action` vocabulary at 251;
  **§7 (365-366)** — *"Format lock (AD-10): `format`/`tie_policy` frozen before `live`; later change =
  audited override."*
- [Source: prd.md#FR-10 (209-216)] — the three testable consequences, incl. **"visible on the Match
  record"** (216) → D3; organizer sets the format before the event (518).
- [Source: EXPERIENCE.md] — Admin console / Bracket control declares format+tie policy (45); the FR-10
  state pattern (122) — *"logged + flagged on the record"* → D3.
- [Source: supabase/migrations/0010_match.sql] — the three columns (56-58), the header's explicit handoff
  to 4.2 (19-20), the `state` closed set incl. `void` (64-65), `score_source_guard` (124-128), the grant
  matrix (227). · [0011_bracket_generation.sql] — the RPC pattern (139-327), the trigger pattern (57-122),
  the EXECUTE-grant pattern (329-343). · [0003_audit_snapshot.sql] — `action` free text + the
  `declare_format` vocabulary (25), `target_match_id` (26). · [0001_core_schema.sql] —
  `tournament.format_default` (31, leave dormant).
- [Source: supabase/tests/0010_match_test.sql] — the pre-state assertion (106) and **the regression at
  359-368**. · [0011_bracket_generation_test.sql] — the pgTAP conventions for an RPC + trigger suite
  (plan/role-switch/refusal-and-nothing-written/column-value assertions).
- [Source: lib/auth/admin-guard.ts:34] (`requireAdmin`) · [lib/roster.ts] (typed refusals, `writeAudit`,
  SQLSTATE classification) · [lib/bracket/generate.ts:494-582] (the RPC-command shape to mirror) ·
  [lib/bracket/generate.test.ts:536-575] (the `.rpc()` mock seam) ·
  [app/api/admin/bracket/route.ts] (the route to copy).
- [Source: _bmad-output/implementation-artifacts/4-1-random-seeded-double-elimination-bracket-generation.md]
  — Review Findings + "Review Fixes Applied": the suite-proves-less-than-it-claims and untrusted-payload
  lessons this story is written against.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — `score_source_guard` → 4.6 (not here);
  CSRF → Epic 7 (uniform, not here).

### Open questions for Cuatro (answer at review; none block implementation)

1. **The format catalog values.** Shipping `mr12` / `mr8` / `bo3_mr12` and `ot_mr3` / `ot_mr3_unlimited` /
   `draw` as the starter set. Editing them is a one-line TS change (no migration) — say the word and the
   array changes.
2. **`tournament.format_default` stays dormant** (bulk declare replaces it, and there is no
   `tie_policy_default` sibling to make it symmetric). Overrule if you want a real tournament-level default.
3. **Who owns `declared → live`?** No Epic-4 story claims it. 4.2 guards it regardless. Likely 4.5 or the
   Epic-5 admin console — worth pinning before 4.5 is written.

## Dev Agent Record

### Agent Model Used

`claude-opus-4-8` (Amelia / bmad-dev-story), 2026-07-13. Baseline commit `5b398ec`.

### Debug Log References

**Gate results (final run, clean DB, final tree):**

| Gate | Result |
|---|---|
| pgTAP (`supabase test db`) | **PASS — 497 tests** (433 at 4.1 → **+64**: 63 new in `0012`, +1 in `0010`) |
| Vitest (`npm test`) | **PASS — 190 tests** (170 at 4.1 → **+20**, all in `lib/match/format.test.ts`) |
| ESLint (`npm run lint`) | **clean** |
| `npm run build` | **clean** — `/api/admin/match/format` registered as a dynamic route |
| Go worker (`go build`/`vet`/`test ./...`) | **clean** — and confirmed (not assumed) it never touches `match` |
| **Live-QA (Task 9)** | **PASS — 26/26 checks, 0 failed** (see Completion Notes) |

**One environment blocker, not a code problem.** `supabase db reset` released DB port 54322 and Windows'
WinNAT immediately swallowed it into a dynamic exclusion range (54307–54406), so Postgres could not
re-bind and every DB gate was blocked. Diagnosed via `netsh interface ipv4 show excludedportrange`;
resolved by Cuatro running `net stop winnat; net start winnat` in an elevated shell. **No repo file was
changed to work around it** (the alternative — temporarily repointing the `[db]` port in
`supabase/config.toml` — was offered and declined in favour of the root-cause fix). Worth knowing: it will
recur on any `supabase stop`/`db reset` on this box.

### Completion Notes List

**What shipped: the lock, not the columns.** Story 4.1 had already created `format` / `tie_policy` /
`format_locked` and named 4.2 as their owner, and `declare_format` was already the enumerated `audit_log`
action — so this story adds exactly **one** column (D3's `format_overridden_at`) and otherwise ships
**teeth**:

- **AC1 — frozen before Live.** Two CHECKs in `0012`. `match_live_requires_locked_format` refuses
  `live`/`pending`/`resolved`/`manual_resolved` on an unlocked match; `match_format_lock_complete` refuses
  a lock that locks nothing (`format_locked = true` with a NULL/blank format or tie policy), without which
  the first CHECK would be satisfiable by a lock that declared **nothing**. The four never-played states
  (`bye`/`void`/`forfeit`/`awaiting_grace`) are excluded **on purpose** and the pgTAP pins all four, so a
  future "helpful" tightening that would break 4.1's generated bye/void rows and 4.5's forfeit turns the
  suite red instead of shipping.
- **AC2 — an audited override, never a silent edit.** The `match_format_lock` BEFORE UPDATE trigger.
  **Rule A** makes `format_locked` a *latch* (no unlock — otherwise the silent edit is trivially reachable
  as unlock → edit → relock, leaving no audit trace at all). **Rule B** refuses any change to a locked
  `format`/`tie_policy` unless a **transaction-local GUC** (`inclusivcup.format_override`) is set — and
  `declare_match_format` is the only thing that sets it, and it always writes the `audit_log` row **in the
  same transaction**. That is what makes "audited override" a *mechanism* rather than a convention: **the
  flag cannot exist without the audit row.**
- **D1 — it bites `service_role`.** Proven, not asserted: the pgTAP silent-edit tests and the live-QA both
  run **as `service_role`** over the real Data API. BYPASSRLS skips policies; it never skips triggers.
- **D2 — bulk declare.** `p_match_ids => NULL` declares every still-`declared`, unlocked match in one
  transaction. On the live 11-player field that is **20 matches in one call** — a per-match API would have
  needed 20 HTTP calls before the first match could start.
- **D3 — flagged on the record.** `match.format_overridden_at`, stamped only on the override path. A first
  declare leaves it NULL (asserted both ways).

**Live-QA (Task 9) — 26/26, against the real stack.** Fresh `supabase db reset` + the standing
`live-qa-bracket-seed.sql` (11-player field → 30 match rows: **20 `declared`, 10 `bye`/`void`**). Drove the
**real `lib/match/format.ts`** over PostgREST **as `service_role`**, so every "silent edit" attempt below is
a genuine service-role write over the Data API — exactly the innocent `update match set …` a future story
would make:

- **Bulk declare** → `declared: 20`, matching `count(*) filter (where state='declared')` exactly. All 20
  locked with `mr12`/`ot_mr3`; **not one** `bye`/`void` row touched (still `format_locked=false`, `format`
  still NULL); **20 `declare_format` audit rows, one per match, every one with a non-null
  `target_match_id`** — the first rows in the codebase to populate that column.
- **AC1 live:** `update match set state='live'` on an unlocked (bye) row → **refused `23514`**; on a
  declared+locked row → **succeeds**.
- **AC2 live:** a direct `update match set format='mr8'` as `service_role` → **refused `P0001`**;
  `update match set format_locked=false` (the latch) → **refused `P0001`**; both left the row unchanged.
  The same change through `declareMatchFormat(..., override: true)` → **succeeds**, the row now shows
  `format_overridden_at` set (D3) and **still `format_locked=true`**, plus a second `declare_format` audit
  row carrying `before {mr12, ot_mr3}` / `after {mr8, draw}` / `override: true`.
- **The override flag does not leak:** immediately after the RPC returned, a plain edit of that same match
  was **refused `P0001`** again — proving the `set_config(…, 'off')` reset actually ran. Without it the flag
  would stay armed for the rest of the transaction and the lock would be wide open for every subsequent
  write (Story 4.6 *will* call this RPC inside a larger transaction). This is the single most load-bearing
  assertion in the story.
- **Idempotent and honest:** re-running the bulk declare → **`no_eligible_matches` (409)**, and it wrote
  nothing (audit count unchanged at 21).

**The known regression was real, and it is the AC working.** `0010_match_test.sql` previously `lives_ok`'d
`update match set state = 'live'` on a match with `format_locked = false` — *precisely* what AC1 forbids. It
now `throws_ok '23514'` on the unlocked transition, declares+locks the row, and keeps the original
`lives_ok` (which is really testing the service_role UPDATE **grant**, and still does). `plan(68) → plan(69)`,
exact assertion-accounting preserved.

**Traps avoided, deliberately:**
- **`manual_override` was NOT reused** for the format override. It is AD-5's *score-source* flag and is read
  by the live `score_source_guard` CHECK — setting it because an admin fixed a *format* would silently
  legalize a hand-typed `admin_manual` score on a demo-bearing match. Hence D3's separate column.
- **No CHECK enum on `format`/`tie_policy`.** They stay free text (OQ-4: organizer config, *not* code); the
  vocabulary lives in `lib/match/format.ts` as an editable `as const` array, so adding MR8 is a one-line TS
  change with **no migration**. The DB keeps only a non-blank backstop.
- **`tournament.format_default` left dormant** (bulk declare replaces it; there is no `tie_policy_default`
  sibling to make it symmetric).

**Scope discipline:** no `declared → live` transition/route (no Epic-4 story owns it — 4.2 installs the
guard so whoever lands it inherits a lock they cannot bypass), no advance (4.3), no GF-reset (4.4), no
forfeit/grace (4.5), no score or Aprobar (4.6), no rollback (4.7), no manual override (4.8), no command-route
helper (4.9), no `score_source_guard` change (4.6), no CSRF (Epic 7, uniform), no UI/i18n (Epic 5).

**Two things for the reviewer:**
1. **A considered boundary, not an oversight.** The trigger implements exactly Rule A + Rule B as specced.
   It does **not** guard `format_overridden_at` itself, so a future story could in principle NULL that flag
   and un-advertise a past override on the record — the `audit_log` row remains, append-only, so the
   override is never actually lost. Adding a "Rule C" (the flag is monotonic) was deliberately **not** done
   unilaterally: it is beyond the story's enumerated rules and would need its own assertion accounting.
   Flagging it as a cheap follow-up if you want the record-side flag to be as immutable as the audit side.
2. **Open questions (from the story, none blocking):** the starter catalog values (`mr12`/`mr8`/`bo3_mr12`,
   `ot_mr3`/`ot_mr3_unlimited`/`draw`) are yours to edit in one line; `tournament.format_default` stays
   dormant; and **no Epic-4 story owns `declared → live`** — worth pinning before 4.5 is written.

### File List

**Added**
- `supabase/migrations/0012_format_lock.sql` — `format_overridden_at` (D3), the two CHECKs (AC1), the
  `match_format_lock_guard()` trigger (AC2/D1), the `declare_match_format` RPC + service-role-only grants (D2).
- `supabase/tests/0012_format_lock_test.sql` — pgTAP, `plan(63)`.
- `lib/match/format.ts` — the format catalog + `declareMatchFormat` (typed refusal union). New directory.
- `lib/match/format.test.ts` — Vitest, 20 tests.
- `app/api/admin/match/format/route.ts` — `POST /api/admin/match/format`. New directory.

**Modified**
- `supabase/tests/0010_match_test.sql` — the correct-by-design regression (Task 8): `plan(68) → plan(69)`;
  Section E now proves the unlocked `→ live` transition is refused **and** that a locked one is permitted.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4-2` → `review`.
- `_bmad-output/implementation-artifacts/4-2-pre-declared-match-format-and-tie-policy.md` — this file.

## Change Log

| Date | Change |
|---|---|
| 2026-07-13 | **Code review → done.** 3 parallel layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor, all Opus 4.8); 2 decision-needed + 10 patch + 3 defer + 12 dismissed. **All three layers independently found that AC2/D1 were FALSE as shipped, and two of them PROVED it by execution:** the override gate was a `PGC_USERSET` custom GUC, so `service_role` — the exact writer D1 names — could arm it for itself and silently edit a frozen format with zero audit rows. **Decision 1(b), applied:** the GUC is gone; the gate is now `match_format_audited`, a constraint trigger requiring a `declare_format` audit row from the same transaction, describing the same result, before any format column may change — so the audit row is the override's PRECONDITION, not its receipt, and AC2 is true as a MECHANISM for every writer including `postgres`. **Decision 2(a), applied:** `bo3_mr12` dropped (no schema home for a Bo3; the latch would make a mis-pick escapable only via an override). Ten more patches: the targeted declare had no state filter (one call could irreversibly lock a format onto a `bye` — new `not_declarable`); `override:true` on a never-locked match forged the D3 badge (new `not_overridable`); `btrim()` trims SPACES ONLY so a TAB latched forever; the audit `detail` was asserted on `format` alone; `FOR UPDATE` ran before the pure-argument guards; the bulk path's concurrency comment described behaviour the code lacked; `1e21` passed `parseBody` → 500; `{ok:true, declared:0}` read as success; `match_ids` was unbounded; and `0010`'s fixture latched by raw UPDATE. **The LIVE adversarial replay caught what 510 green pgTAP assertions did not:** the first fix still let a transaction that had *legitimately declared* a match forge that match's D3 badge on the back of its own audit row — closed by tying the badge to the row that authorized it (`detail.override` ⟺ `format_overridden_at IS NOT NULL`), and both halves are now pinned in pgTAP. Final gates: **pgTAP 512** (`0012` plan 63→78) · **Vitest 194** · lint 0 · build 0 · go clean · **live replay 6/6 attacks refused, 5/5 typed refusals, both legit paths intact**. |
| 2026-07-13 | Story 4.2 implemented (baseline `5b398ec`). Migration `0012_format_lock.sql`: the AD-10 format lock — `format_overridden_at` (D3), `match_format_lock_complete` + `match_live_requires_locked_format` CHECKs (AC1), the `match_format_lock` no-silent-edit trigger (AC2/D1: `format_locked` is a latch; a locked format changes only under a txn-local GUC that only `declare_match_format` sets, and that cannot exist without the audit row in the same transaction), and the `declare_match_format` RPC with bulk + targeted + audited-override paths (D2). Added `lib/match/format.ts` (+ tests) and `POST /api/admin/match/format`. Regression: `0010_match_test.sql` flipped its unlocked `→ live` `lives_ok` to `throws_ok '23514'` and kept a locked-row `lives_ok` for the UPDATE grant (`plan(68) → plan(69)`) — the AC working, not a bug. Gates: pgTAP 497 · Vitest 190 · lint 0 · build 0 · go clean · **live-QA 26/26 on a real 11-player bracket, proven against `service_role`**. |
