-- supabase/migrations/0012_format_lock.sql
-- Logical migration 0012 — the AD-10 format lock (Story 4.2, AC1 + AC2 + D1/D2/D3).
--
-- ONE migration because it is ONE concern: the lock. Story 4.1 already shipped the three columns this
-- story locks (`format` / `tie_policy` / `format_locked`, 0010:56-58) and its header explicitly handed
-- the LOCK itself to 4.2. So this migration adds almost no schema — it adds TEETH.
--
-- WHAT "TEETH" MEANS HERE, AND WHY A TRIGGER (D1). `service_role` holds UPDATE on `match` (0010:227) —
-- it must, because every later story moves a match through it (advance 4.3, GF 4.4, forfeit 4.5,
-- approve 4.6, rollback 4.7, manual score 4.8) — and it has BYPASSRLS, so NO policy can constrain it.
-- But BYPASSRLS does NOT skip triggers. A route-level or RPC-only guard would be a CONVENTION that the
-- next story silently breaks with one innocent `update match set format = …`; a trigger is the only
-- mechanism that can bind the writer that actually exists. This is Story 4.1's D3 lesson applied.
--
-- ⚠⚠ THE AUDIT ROW IS THE GATE — AND THE FIRST CUT OF THIS FILE GOT IT WRONG (code review 2026-07-13,
-- decision 1b). The original gated the override on a transaction-local GUC (`inclusivcup.format_override`)
-- that only `declare_match_format` was supposed to set. That guarantee was FALSE, and the review proved it
-- by EXECUTION: a dotted custom GUC is a `PGC_USERSET` placeholder, so ANY role — including `service_role`,
-- the exact writer D1 names — can arm it for itself:
--
--     set local role service_role;
--     select set_config('inclusivcup.format_override', 'on', true);   -- no privilege required
--     update match set format = 'FORGED' where id = <a locked match>; -- UPDATE 1, ZERO audit rows
--
-- A gate whose key the adversary can mint is not a gate. So there is no flag any more.
--
-- `match_format_audited` (a CONSTRAINT TRIGGER) instead requires that a `declare_format` `audit_log` row
-- for THIS match, written by THIS transaction, DESCRIBING THIS EXACT RESULTING STATE, already exists
-- whenever a format column changes. `declare_match_format` therefore writes its audit rows BEFORE the
-- UPDATE. The audit row is not the receipt of the override — it is its PRECONDITION.
--
-- A determined `service_role` can still change a frozen format, but ONLY by also writing an accurate
-- audit row. That is exactly, and only, what AC2 asks for: *"permitted only as an explicit audited
-- override (writes an `audit_log` row), NEVER a silent edit."* The silent edit is now impossible for
-- every writer, `postgres` included. The audited one remains possible, which is the point.
--
-- SCOPE (whole deliverable):
--   (a) D3 — `match.format_overridden_at`: the override flag, ON THE MATCH RECORD. PRD FR-10 (prd.md:216)
--       and EXPERIENCE.md:122 both require the override be *visible on the record*, not merely logged;
--       an `audit_log` row satisfies "logged" and does not satisfy "flagged on the record".
--   (b) AC1 — two CHECK constraints: a lock must lock something REAL (`match_format_lock_complete`), and
--       a match cannot reach a PLAYED state without one (`match_live_requires_locked_format`). CHECKs are
--       not policies: BYPASSRLS is irrelevant to them and no flag opens them. They bind every writer.
--   (c) AC2/D1 — the LATCH (`match_format_lock`, BEFORE UPDATE: `format_locked` never goes true -> false)
--       plus the AUDITED-CHANGE GATE (`match_format_audited`, a constraint trigger: no format change
--       without its audit row, in the same transaction, describing the same result).
--   (d) AC1/AC2/D2/D3 — `declare_match_format(...)`: the atomic declare/override command (bulk or
--       targeted) + its service-role-only EXECUTE grant. Mirrors `generate_bracket` (0011): typed refusals
--       RETURNED not raised, every guard BEFORE any write.
-- OUT OF SCOPE — do NOT add here (each has an owning story; building it now is scope creep):
--   * `audit_log.action = 'declare_format'` needs NO migration: `action` is uncapped `text` and
--     `declare_format` is already the enumerated vocabulary (0003:25, SOLUTION-DESIGN:251, AD-17).
--   * a CHECK enum on `format`/`tie_policy`. DELIBERATELY ABSENT — see the note above the CHECKs.
--   * the `declared -> live` TRANSITION itself. Nothing in the codebase sets state='live' yet and no
--     Epic-4 story claims it. 4.2 installs the GUARD; whoever lands the transition inherits a lock they
--     cannot bypass — and owes a friendly mapping of the CHECK's 23514 (see deferred-work.md).
--   * idempotent advance (4.3), the GF-reset row (4.4), forfeit/grace (4.5), Aprobar + the demo-derived
--     score (4.6), rollback (4.7), the manual score override (4.8), the command-route helper (4.9).
--   * `match.manual_override` — see the warning on the D3 column below. It is AD-5's SCORE flag (4.8).
--   * tightening `score_source_guard` -> Story 4.6 (deferred-work.md). Do not touch that CHECK.

-- ════════════════════════════════════════════════════════════════════════════
-- (a) D3 — the override flag, on the record.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.match add column format_overridden_at timestamptz;

-- ⚠ READ THIS BEFORE REACHING FOR `manual_override` INSTEAD. `match.manual_override` already exists and
-- reads like "the admin overrode something" — but it is AD-5's SCORE-SOURCE flag, and it is READ BY A
-- LIVE CHECK CONSTRAINT (`score_source_guard`, 0010:124-128):
--     (score_source = 'admin_manual' and (demo_id is null or manual_override = true))
-- Setting it because an admin corrected a FORMAT would silently LEGALIZE a hand-typed `admin_manual`
-- score on a match that HAS a demo — precisely the "demo-derived and hand-entered scores silently
-- disagreeing" failure AD-5 exists to prevent, and it would land before Stories 4.6/4.8 (which actually
-- own scores) ever run. Two different overrides, two different columns. This is that second column.
comment on column public.match.format_overridden_at is
  'AD-10: when the declared format/tie_policy was changed by an audited override (NULL = never overridden). Writes to this column are themselves gated by match_format_audited. The FORMAT override flag — NOT interchangeable with manual_override, which is AD-5''s SCORE-source flag (Story 4.8) and is read by score_source_guard.';

-- The audited-change gate below does a per-row EXISTS over `audit_log` keyed by `target_match_id`, and a
-- 30-match bulk declare fires it 30 times. 0003's only index is (tournament_id, occurred_at). This is the
-- lookup the trigger needs — and the one an Epic-5 match card will need to read the override off a match.
create index audit_log_target_match on public.audit_log (target_match_id)
  where target_match_id is not null;

-- ════════════════════════════════════════════════════════════════════════════
-- (b) AC1 — the two CHECKs.
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY THERE IS NO `check (format in ('mr12','mr8',…))` HERE. The repo's convention is "closed-set text
-- columns are CHECK-constrained enums" (SPINE:234) and these two columns are DELIBERATELY excluded from
-- it: SOLUTION-DESIGN §3 gives every other closed-set column a CHECK and gives `format`/`tie_policy`
-- none (L120-122, right beside `bracket`/`state`/`score_source` which all have one), and the Deferred
-- list says so outright (OQ-4, SPINE:471): match formats are "organizer/content config, NOT code". A
-- CHECK enum would mean a MIGRATION every time Cuatro wants MR8 instead of MR12 for a round. So the DB
-- guards only that a lock locks something NON-BLANK; the VOCABULARY lives in lib/match/format.ts as an
-- editable `as const` array the route validates against (-> a friendly 422).

-- A LOCK MUST LOCK SOMETHING REAL. Without this, `format_locked = true` with `format = NULL` would sail
-- through the live-gate CHECK below while having declared NOTHING — the lock would be a lie.
--
-- ⚠ `~ '[^[:space:]]'` ("has at least one non-whitespace character"), NOT `btrim(x) <> ''`. The first cut
-- used the latter, and `btrim(string)` with no second argument trims SPACES ONLY — so `btrim(E'\t')` is
-- E'\t', which is `<> ''`, and a TAB sailed through both this CHECK and the RPC's guard and latched
-- `format = E'\t'` PERMANENTLY (the latch means the only way back out is an audited override).
--
-- ⚠ The `is not null` tests are load-bearing and must stay: a CHECK treats a NULL result as SATISFIED,
-- so `format_locked = false or (NULL ~ '…')` would evaluate to NULL and PASS on a NULL format.
alter table public.match add constraint match_format_lock_complete check (
  format_locked = false
  or (format     is not null and format     ~ '[^[:space:]]'
  and tie_policy is not null and tie_policy ~ '[^[:space:]]')
);

-- AC1'S TEETH: a match cannot reach a PLAYED state with an unlocked format. This constrains ANY writer —
-- which is the point: no route owns the `declared -> live` transition yet, so the guard has to be here.
-- (`match.state` is `not null default 'declared'` (0010:64), so there is no NULL row to slip through.)
--
-- THE EXCLUDED STATES ARE DELIBERATE, NOT AN OVERSIGHT:
--   * 'bye' / 'void' / 'forfeit' / 'awaiting_grace' are NEVER PLAYED and produce zero stats (AD-9).
--     Requiring a format for them would make 4.1's already-generated bye/void rows unrepresentable and
--     would block Story 4.5's forfeit path, for no benefit whatsoever.
--   * 'declared' is the PRE-LOCK state by definition (it is what declare_match_format targets).
--   * 'rolled_back' only ever follows 'resolved', which was necessarily already locked to get there.
alter table public.match add constraint match_live_requires_locked_format check (
  state not in ('live', 'pending', 'resolved', 'manual_resolved')
  or format_locked
);

-- ════════════════════════════════════════════════════════════════════════════
-- (c1) AC2 — the LATCH. `format_locked` never goes true -> false.
-- ════════════════════════════════════════════════════════════════════════════
--
-- This is a STRUCTURAL rule, not an audit rule: there is no legitimate unlock, not even an audited one.
-- Without it the silent edit is trivially reachable as unlock -> edit -> relock, and the audited-change
-- gate below would never even see a locked row. A mis-declared format is corrected THROUGH the override
-- (which keeps the lock set), never by unlocking.
-- (The direct analogue of 4.1's "the trigger ignored OLD" review finding: guard the transition OUT of the
--  frozen state, not merely writes while frozen.)
create function public.match_format_lock_guard() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if old.format_locked and not new.format_locked then
    raise exception
      'match %: format_locked is a LATCH — a declared format is never unlocked (AD-10)', old.id
      using errcode = 'P0001',
            hint = 'Correct a mis-declared format with declare_match_format(..., p_override => true): it keeps the lock set and writes the audit row.';
  end if;
  return new;
end;
$$;

create trigger match_format_lock
  before update on public.match
  for each row execute function public.match_format_lock_guard();

-- ════════════════════════════════════════════════════════════════════════════
-- (c2) AC2 / D1 — the AUDITED-CHANGE GATE. No format change without its audit row.
-- ════════════════════════════════════════════════════════════════════════════
--
-- THE MECHANISM, IN ONE SENTENCE: a format column cannot change unless an `audit_log` row for THAT match,
-- written by THIS transaction, ALREADY DESCRIBES the resulting state. `declare_match_format` satisfies it
-- by writing the audit rows first; nothing else in the codebase can satisfy it by accident.
--
-- WHY `occurred_at = transaction_timestamp()` AND NOT `xmin = pg_current_xact_id()`. The xmin test looks
-- more rigorous and is WRONG here: a plpgsql caller with an EXCEPTION block runs its body in a
-- SUBtransaction, so the audit row's `xmin` would be the SUBtransaction's xid while `pg_current_xact_id()`
-- returns the TOP-level xid — the check would falsely REJECT a perfectly legal call. Story 4.6 will call
-- this RPC inside a larger transaction, so that is not hypothetical. `transaction_timestamp()` (= `now()`)
-- is fixed at transaction start and is IDENTICAL across every subtransaction of it, and it is exactly what
-- `audit_log.occurred_at` defaults to (0003:28). It cannot match a row from any EARLIER transaction, which
-- is the reuse this must prevent.
--
-- WHY THE `after` PAYLOAD IS MATCHED, NOT JUST THE ROW'S EXISTENCE. An audit row authorizes exactly the
-- ONE change it describes — not an open window for the rest of the transaction. Without this, a caller who
-- legitimately declared match X could then silently re-edit X's format later in the same transaction (the
-- same "set once, edit many" weakness the old GUC had, which its `set_config(…,'off')` reset existed to
-- close). Matching `after` closes it structurally instead.
--
-- AND WHY `detail.override` IS MATCHED AGAINST `format_overridden_at`. Found by the post-patch live run,
-- not by the test suite: the first three keys alone still let a transaction that had LEGITIMATELY declared
-- match X go on to forge X's D3 badge (`update match set format_overridden_at = now()`), because the
-- declare's own audit row satisfied them. Tying the badge to the row that authorized it — an override row
-- means the badge IS set, a declare row means it is NOT — closes the forge AND the erase, in every
-- transaction, with no extra payload:
--       (detail.override = true)  <=>  (format_overridden_at IS NOT NULL)
-- So `detail.override` is not decoration; like the three `after` keys, it is LOAD-BEARING. The pgTAP pins
-- all four (Section E), which is what keeps a future typo in `jsonb_build_object` from quietly unlocking
-- this gate.
create function public.match_format_audit_guard() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.audit_log a
     where a.target_match_id = new.id
       and a.action          = 'declare_format'
       and a.occurred_at     = transaction_timestamp()
       and  a.detail -> 'after' ->> 'format'                   is not distinct from new.format
       and  a.detail -> 'after' ->> 'tie_policy'               is not distinct from new.tie_policy
       and (a.detail -> 'after' ->> 'format_locked')::boolean  is not distinct from new.format_locked
       and (a.detail            ->> 'override')::boolean       =  (new.format_overridden_at is not null)
  ) then
    raise exception
      'match %: a format change requires a declare_format audit_log row, written by THIS transaction, describing THIS result (AD-10) — the audit row is the PRECONDITION, not the receipt', new.id
      using errcode = 'P0001',
            hint = 'Use declare_match_format(...). It writes the audit row before the update, in one transaction. There is no unaudited path — not for service_role, not for postgres.';
  end if;
  return null;   -- AFTER trigger: the return value is ignored
end;
$$;

-- Fires ONLY on the writes that must be audited. Everything else is untouched, which is what keeps this
-- trigger a no-op for Story 4.3 (`winner_entry`), 4.5 (`state`) and 4.6 (`score_*`) — none of them touch a
-- format column, so none of them are gated. Do NOT gate the whole UPDATE.
create constraint trigger match_format_audited
  after update on public.match
  deferrable initially immediate
  for each row
  when (
    -- The DECLARATION itself (false -> true). The first cut guarded only writes to an ALREADY-locked row,
    -- so a raw `update match set format=…, format_locked=true` latched a format PERMANENTLY with no audit
    -- row, no actor and no RPC — and the row then read as legitimately declared.
    new.format_locked is distinct from old.format_locked
    -- The OVERRIDE of a frozen format/tie_policy (AC2 proper).
    -- `is distinct from`, not `<>`: both columns are nullable, and `new.format <> old.format` is NULL —
    -- not true — whenever either side is NULL, so a NULL-ing edit would slip straight through.
    or (old.format_locked and (new.format     is distinct from old.format
                            or new.tie_policy is distinct from old.tie_policy))
    -- D3's flag itself. NOTHING guarded it before: service_role could forge an override badge onto a
    -- never-overridden match, or NULL one away, silently. `audit_log` survived either way — but "visible
    -- ON THE MATCH RECORD" (FR-10, prd.md:216) is not satisfied by a column any writer can quietly rewrite.
    or new.format_overridden_at is distinct from old.format_overridden_at
  )
  execute function public.match_format_audit_guard();

-- An UNLOCKED match's `format` stays FREELY editable: it is scratch space until it is declared. The
-- trigger guards the LOCK, not the column.
--
-- INSERT is deliberately unguarded. `generate_bracket` (0011) is the only INSERT path and it creates every
-- row unlocked, and the two CHECKs above already make an INSERT that claims a lock without a format — or a
-- played state without a lock — impossible. A row born locked is a fixture, not a reachable app path.
--
-- No REVOKE on either guard function: a `returns trigger` function cannot be invoked as a normal call
-- (Postgres refuses: "trigger functions can only be called as triggers") and PostgREST does not expose it,
-- so PUBLIC's default EXECUTE is not a reachable surface. Same posture as 0011's roster_entry_lock_guard.
-- The RPC below is a NORMAL function, and that one IS revoked — see the grants at the bottom.

-- ════════════════════════════════════════════════════════════════════════════
-- (d) AC1/AC2/D2/D3 — declare_match_format: the atomic declare/override command.
-- ════════════════════════════════════════════════════════════════════════════
--
-- D2 — BULK, OR THE FEATURE IS UNUSABLE. An 11-player field generates 30 `match` rows (verified at 4.1's
-- live-QA). A per-match-only declare API would mean 30 HTTP calls before the first match could start, so
-- `p_match_ids => NULL` means "every still-`declared`, still-unlocked match of this tournament".
--
-- REFUSALS ARE RETURNED, NOT RAISED (the 0011 convention). Every expected outcome returns a typed
-- `{ok:false, reason}` the route maps to an HTTP status, and EVERY GUARD RUNS BEFORE ANY WRITE — so a
-- refusal commits nothing. Only a genuine fault raises, and that aborts the whole transaction.
--
-- THE PAYLOAD IS NOT TRUSTED (4.1's review lesson: "an empty p_matches committed an unrecoverable live
-- tournament"). `p_match_ids` is verified to belong to THIS tournament AND to be in a declarable state
-- before a single row is touched, and a bad id fails the WHOLE call rather than partially applying.
create function public.declare_match_format(
  p_tournament_id   bigint,
  p_match_ids       bigint[],   -- NULL = the D2 bulk path: every still-`declared`, unlocked match
  p_format          text,
  p_tie_policy      text,
  p_actor_steamid64 text,
  p_override        boolean
) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_override boolean := coalesce(p_override, false);
  v_target   bigint[];
  v_bad      int;
  v_before   jsonb;
  v_after    jsonb;
  v_declared int;
begin
  -- ══ 1. PARAMETER-ONLY GUARDS — they depend on NOTHING but the arguments, so they run FIRST.
  --    (Code review: these used to run AFTER step 4's `FOR UPDATE`, so a doomed `{override:true}` with no
  --    ids row-locked every declared match in the tournament and only THEN refused. A retrying client
  --    could block every concurrent writer with a request that was never going to apply.)

  -- THE FORMAT ITSELF MUST BE REAL. The TS catalog (lib/match/format.ts) rejects an unknown value long
  -- before this, so this is only reachable on a DIRECT RPC call — which is exactly why it is here: the DB
  -- is the authority, not the caller. It is also the backstop that keeps `match_format_lock_complete` from
  -- ever being the thing that fires (a CHECK violation raises 23514 and would surface as an untyped 500
  -- instead of a typed 422). `~ '[^[:space:]]'` — see the CHECK above for why not `btrim`.
  if p_format     is null or p_format     !~ '[^[:space:]]'
  or p_tie_policy is null or p_tie_policy !~ '[^[:space:]]' then
    return jsonb_build_object('ok', false, 'reason', 'bad_format');
  end if;

  -- An override is a SURGICAL act. Never bulk-override a whole bracket by accident.
  if v_override and p_match_ids is null then
    return jsonb_build_object('ok', false, 'reason', 'override_needs_ids');
  end if;

  -- ══ 2. THE TOURNAMENT MUST EXIST.
  if not exists (select 1 from public.tournament t where t.id = p_tournament_id) then
    return jsonb_build_object('ok', false, 'reason', 'bad_tournament');
  end if;

  -- ══ 3. RESOLVE THE TARGET SET (D2).
  if p_match_ids is null then
    -- The bulk path. `state = 'declared'` is doing real work: bye/void rows are NEVER played (AD-9) and are
    -- therefore naturally excluded. Already-locked matches are excluded too, which is what makes a re-run
    -- idempotent (it resolves to the empty set -> `no_eligible_matches`, an honest refusal, never a no-op).
    select coalesce(array_agg(m.id order by m.id), '{}')
      into v_target
      from public.match m
     where m.tournament_id = p_tournament_id
       and m.state         = 'declared'
       and m.format_locked = false;
  else
    -- The targeted path. EVERY id must belong to THIS tournament — otherwise an admin could declare a
    -- format onto another event's bracket by id. A NULL element fails this too (the NOT EXISTS is true for
    -- it), which is the fail-closed direction.
    select count(*)::int
      into v_bad
      from unnest(p_match_ids) as t(id)
     where not exists (
       select 1 from public.match m
        where m.id = t.id and m.tournament_id = p_tournament_id
     );
    if v_bad > 0 then
      -- Fail the WHOLE call, never partially apply (4.1's review lesson).
      return jsonb_build_object('ok', false, 'reason', 'bad_match');
    end if;

    -- Deduplicate: a repeated id must not produce two audit rows.
    select coalesce(array_agg(distinct t.id order by t.id), '{}')
      into v_target
      from unnest(p_match_ids) as t(id);
  end if;

  -- ══ 4. SERIALIZE on the target rows. Two concurrent declares on the same match now queue instead of
  --    racing: the loser re-reads the committed row UNDER the lock at step 5 and acts on what it finds.
  perform m.id
     from public.match m
    where m.id = any(v_target)
    order by m.id
      for update;

  -- ══ 5. GUARDS, RE-READ UNDER THE LOCK. All of them before any write.
  if p_match_ids is null then
    -- BULK: RE-RESOLVE. Step 3 read an UNLOCKED snapshot; a concurrent declare may have locked part of it.
    -- DROP those from the target set rather than failing the whole call — which is what the first cut did,
    -- refusing an entire tournament's declare with a misleading `already_locked` because one match had been
    -- taken. (Its comment claimed it "resolves it out of the target set". It did not. Now it does.)
    select coalesce(array_agg(m.id order by m.id), '{}')
      into v_target
      from public.match m
     where m.id            = any(v_target)
       and m.state         = 'declared'
       and m.format_locked = false;

  elsif v_override then
    -- OVERRIDE: every target must ACTUALLY be frozen. Without this, `p_override => true` on a
    -- never-declared match stamped `format_overridden_at` and wrote an `override:true` audit row for what
    -- was really a FIRST declaration — inverting the column's own contract (NULL = never overridden), which
    -- is precisely the flag an Epic-5 match card reads.
    select count(*)::int into v_bad
      from public.match m
     where m.id = any(v_target) and not m.format_locked;
    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'reason', 'not_overridable');
    end if;

  else
    -- TARGETED FIRST DECLARE: the same contract the bulk path enforces. The first cut applied it to the
    -- BULK path only, so one route call could irreversibly lock a format onto a `bye`/`void`/`forfeit` row
    -- — and the LATCH made that unrecoverable (not even `postgres` can unlock it).
    select count(*)::int into v_bad
      from public.match m
     where m.id = any(v_target) and m.state <> 'declared';
    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'reason', 'not_declarable');
    end if;

    -- An already-frozen match, without an explicit override, is the silent edit this story exists to
    -- refuse. Say so, rather than letting the trigger raise.
    select count(*)::int into v_bad
      from public.match m
     where m.id = any(v_target) and m.format_locked;
    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'reason', 'already_locked');
    end if;
  end if;

  -- NEVER A SILENT NO-OP (the repo's fail-closed convention, lib/roster.ts:180-182). Nothing to declare is
  -- a typed refusal, not an `ok:true, declared:0`.
  if coalesce(array_length(v_target, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_eligible_matches');
  end if;

  -- ── Past this line everything writes, and it all commits or none of it does. ──

  -- ══ 6. Capture the BEFORE state (AD-17) while it is still true. PG15 has no `RETURNING OLD.*`, so the
  --    snapshot has to be taken here, keyed by match id.
  select coalesce(
           jsonb_object_agg(m.id::text, jsonb_build_object(
             'format',        m.format,
             'tie_policy',    m.tie_policy,
             'format_locked', m.format_locked
           )),
           '{}'::jsonb
         )
    into v_before
    from public.match m
   where m.id = any(v_target);

  -- The AFTER payload is the state step 7 is about to write. `match_format_audited` matches the UPDATE
  -- against exactly this — so the audit row does not merely accompany the change, it AUTHORIZES it.
  v_after := jsonb_build_object(
    'format',        p_format,
    'tie_policy',    p_tie_policy,
    'format_locked', true
  );

  -- ══ 7. THE AUDIT ROWS — WRITTEN FIRST, BECAUSE THEY ARE THE PRECONDITION, NOT THE RECEIPT.
  --    `match_format_audited` refuses the UPDATE at step 8 for any match that does not already have a
  --    matching `declare_format` row from THIS transaction. That is what makes "audited override" a
  --    MECHANISM rather than a convention: the write is IMPOSSIBLE without the audit row — for every
  --    writer, `service_role` and `postgres` included.
  --
  --    ⭐ target_match_id: these are the FIRST audit rows in the codebase to populate it. The column has
  --    existed since 0003 as a bare nullable bigint (its FK deferred to Epic 4, closed by 4.1's 0010); the
  --    roster/registration rows legitimately leave it NULL because they are tournament-scoped. A
  --    `declare_format` row is MATCH-scoped, so it sets it — that is what an Epic-5 match card reads.
  insert into public.audit_log (tournament_id, actor_steamid64, action, target_match_id, detail)
  select
    p_tournament_id,
    p_actor_steamid64,
    'declare_format',   -- needs NO migration: audit_log.action is uncapped text (0003:25) and this string
                        -- is already the enumerated vocabulary there + in AD-17.
    m.id,
    jsonb_build_object(
      'before',   v_before -> m.id::text,
      'after',    v_after,
      'override', v_override
    )
    from public.match m
   where m.id = any(v_target);

  -- ══ 8. THE WRITE. Every row here has its authorizing audit row from step 7.
  if v_override then
    update public.match m
       set format               = p_format,
           tie_policy           = p_tie_policy,
           format_locked        = true,   -- stays locked: an override never unlocks (the LATCH)
           format_overridden_at = now()   -- D3: FLAGGED ON THE RECORD, not only in audit_log
     where m.id = any(v_target);
  else
    -- The first declaration. `format_overridden_at` is deliberately LEFT UNTOUCHED: a first declare is not
    -- an override, and the flag means OVERRIDDEN — not "has a format".
    update public.match m
       set format        = p_format,
           tie_policy    = p_tie_policy,
           format_locked = true
     where m.id = any(v_target);
  end if;
  get diagnostics v_declared = row_count;

  return jsonb_build_object(
    'ok', true, 'declared', v_declared, 'override', v_override
  );
end;
$$;

-- ── EXECUTE grants — the RPC is service-role-only (AD-8) ─────────────────────
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and anon/authenticated inherit from PUBLIC — so
-- without this REVOKE the function would be callable straight off the Data API by any visitor. It is
-- SECURITY INVOKER (a viewer would 42501 at the first write anyway), but a defence that depends on a
-- later grant check is not a defence: revoke first, then grant to the single writer. The route's
-- `requireAdmin` is the authorization gate; this is the second lock on the same door. (0011:329-336.)
revoke execute on function public.declare_match_format(bigint, bigint[], text, text, text, boolean) from public;
grant  execute on function public.declare_match_format(bigint, bigint[], text, text, text, boolean) to service_role;
