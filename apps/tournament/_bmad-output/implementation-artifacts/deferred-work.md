# Deferred Work

Tracked follow-ups surfaced during reviews. Each item names its origin and its intended home.

## Deferred from: code review of story-1.1 (2026-06-30)

- [ ] **First-build client-bundle leak scan (AC3 — deviation D1).** When the first Next.js app/build exists (Story 1.2+), run the production client-bundle scan to empirically confirm no server-only secret (Supabase service-role key, R2 write creds, worker↔MatchZy shared secret) is bundled. **Intended home:** Story 7.5 build-handoff checklist gate. **Reason deferred:** no app exists yet at Story 1.1; the structural guarantee (only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-exposed) stands in until the first real build.

## Deferred from: code review of story-1.2 (2026-06-30)

- [ ] **`granted_by` audit invariant unenforced (self-grant / grant-by-non-admin).** `app_role.granted_by` (`[supabase/migrations/0001_core_schema.sql:47]`) only checks existence in `player` via FK — nothing prevents `granted_by = steamid64` (self-grant) or a grantor who is not an admin. **Intended home:** Story 1.3 (RLS / `is_admin()` authorization slice). **Reason deferred:** authorization semantics belong to the RLS framework, not the 0001 identity/scope DDL.
- [ ] **Optional non-empty (`char_length > 0`) guards on text columns.** `display_name`, `season.name`, `tournament.name`, `avatar_url` (`[supabase/migrations/0001_core_schema.sql]`) are unbounded `text` with no non-empty CHECK, so `''` is a valid value. **Intended home:** future hardening pass (or fold into a later schema touch). **Reason deferred:** low value for a casual private-friends event; revisit only if empty names surface in the UI.

## Deferred from: second-opinion code review of story-1.2 (2026-07-01)

_A fresh independent review pass re-confirmed both story-1.2 deferrals above are still valid and added no new deferrals. The one new item it surfaced — missing `UNIQUE` on `season.name` / `tournament(season_id, name)` — is a **decision-needed**, not a defer; its disposition is tracked in the story file's "Review Findings — Second-Opinion Pass (2026-07-01)" section pending Cuatro's call. It also empirically **refuted** a claimed HIGH (trailing-newline regex bypass) against a live PostgreSQL 18.4 cluster — no action needed._
