# Deferred Work

Tracked follow-ups surfaced during reviews. Each item names its origin and its intended home.

## Deferred from: code review of story-1.1 (2026-06-30)

- [ ] **First-build client-bundle leak scan (AC3 — deviation D1).** When the first Next.js app/build exists (Story 1.2+), run the production client-bundle scan to empirically confirm no server-only secret (Supabase service-role key, R2 write creds, worker↔MatchZy shared secret) is bundled. **Intended home:** Story 7.5 build-handoff checklist gate. **Reason deferred:** no app exists yet at Story 1.1; the structural guarantee (only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-exposed) stands in until the first real build.

## Deferred from: code review of story-1.2 (2026-06-30)

- [ ] **`granted_by` audit invariant unenforced (self-grant / grant-by-non-admin).** `app_role.granted_by` (`[supabase/migrations/0001_core_schema.sql:48]`) only checks existence in `player` via FK — nothing prevents `granted_by = steamid64` (self-grant) or a grantor who is not an admin. **Intended home:** **Story 2.4** (roles admin gating — the grant/revoke server route) _(re-homed 2026-07-01 from Story 1.3)_. **Reason deferred:** this is an authorization invariant on a *write*, and every `app_role` write goes through the service-role, which **bypasses RLS** — so RLS / `is_admin()` structurally cannot enforce it. Enforcement belongs to the Epic-2 grant/revoke route (Story 2.4), which re-verifies `is_admin()` server-side and can reject self-grants / non-admin grantors before writing `app_role`. **Confirmed by Story 1.3** (migration 0002, `done`): it deliberately added no CHECK/trigger for this — a CHECK can't cheaply prove "grantor is an admin," and a trigger is over-engineering for a casual private-friends event. [Story 1.3 Dev Notes "OUT of scope" + Completion Notes.]
- [ ] **Optional non-empty (`char_length > 0`) guards on text columns.** `display_name`, `season.name`, `tournament.name`, `avatar_url` (`[supabase/migrations/0001_core_schema.sql]`) are unbounded `text` with no non-empty CHECK, so `''` is a valid value. **Intended home:** future hardening pass (or fold into a later schema touch). **Reason deferred:** low value for a casual private-friends event; revisit only if empty names surface in the UI.

## Deferred from: second-opinion code review of story-1.2 (2026-07-01)

_A fresh independent review pass re-confirmed both story-1.2 deferrals above are still valid and added no new deferrals. The one new item it surfaced — missing `UNIQUE` on `season.name` / `tournament(season_id, name)` — is a **decision-needed**, not a defer; its disposition is tracked in the story file's "Review Findings — Second-Opinion Pass (2026-07-01)" section pending Cuatro's call. It also empirically **refuted** a claimed HIGH (trailing-newline regex bypass) against a live PostgreSQL 18.4 cluster — no action needed._

## Deferred from: code review of story-1.3 (2026-07-01)

- [ ] **No catalog-level guard enforcing the ENABLE+FORCE+grant convention for future tables.** `0002_rls_test.sql` Section A (`[supabase/tests/0002_rls_test.sql:37]`) hard-codes the four current tables by name when asserting `relforcerowsecurity = true`; a table added by a later migration that forgets `FORCE` (or its base-table grants) would pass this suite unnoticed, quietly breaking the "framework provably bites" guarantee (AC #5) for the forward roadmap. Add a generic catalog assertion — e.g. "no base table in `public` has `relforcerowsecurity = false`" — so the convention bites for every future table, not just the four. **Intended home:** Story 1.4 (audit/snapshot, migration 0003) or a shared pgTAP helper. **Reason deferred:** forward-looking framework hardening, not a defect in the four-table 1.3 slice.
