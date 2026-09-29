# Capability Map — InclusivCup CS2 Tournament (v1)

Companion to [SPEC.md](SPEC.md). The seam matrix `bmad-create-epics-and-stories` uses to turn
capabilities into epics and stories. Each SPEC capability maps 1:1 to a SOLUTION-DESIGN §12 epic; the
finer spine feature units (F1..F7) within a capability are listed so the epic skill can sub-divide
stories along real module boundaries.

Authority: the architecture spine wins on any conflict. AD IDs, FR IDs, and the F-unit names are
stable — preserve them.

## Seam matrix

| CAP | §12 Epic | Spine F-unit(s) | FRs | ADs | Owning modules |
|-----|----------|-----------------|-----|-----|----------------|
| CAP-1 Foundation & Schema | Epic 1 — Foundation & schema | substrate (AD-1..18) | NFR-Data, NFR-Security | AD-4, AD-7, AD-12, AD-17, AD-18, AD-25 | `supabase/migrations` (0001 schema, 0002 RLS), infra/secrets config |
| CAP-2 Identity & Roster | Epic 2 — Identity & roster | F1 Roster & Identity | FR-1, FR-2, FR-3, FR-4 | AD-4, AD-12 | `app/auth/steam`, `player` / `app_role` / `roster_entry`, RLS |
| CAP-3 Demo Ingestion Worker | Epic 3 — Demo ingest worker | F3 Demo Ingestion | FR-11, FR-12, FR-13, FR-14, FR-15, FR-16 | AD-1, AD-2, AD-3, AD-5, AD-16, AD-23, AD-26 | `worker/ingest`, `worker/store` (`DemoStore`→R2), `demo` / `stat_row` |
| CAP-4 Bracket & Admin Command Routes | Epic 4 — Bracket & admin command routes | F2 Bracket + F7 admin command routes | FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-13, FR-14, FR-16, FR-33 | AD-5, AD-6, AD-8, AD-9, AD-10, AD-13, AD-17, AD-21, AD-23 | `lib/bracket`, `match`, `api/admin`, `audit_log` |
| CAP-5 Stats, Leaderboards & Realtime Viewer Surfaces | Epic 5 — Leaderboards & realtime | F4 Derived Stats & Leaderboards + F5 Views + F7 feed reads | FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-31, FR-32, FR-34 | AD-2, AD-7, AD-9, AD-11, AD-20, AD-24 | `worker/ingest` derivations, leaderboard view/RPC, `app/` read surfaces + feed, realtime |
| CAP-6 Awards Roulette: Producer & Verifier | Epic 6 — Awards roulette | F6 Awards Roulette | FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30 | AD-13, AD-14, AD-15, AD-19, AD-22, AD-24 | `worker/awards` (producer), `lib/roulette` (verifier), `ceremony` / `spin` / `award_result`, `stat_snapshot`, `verification_bundle`, `roulette/vectors` |
| CAP-7 Hardening & Operations | Epic 7 — Hardening | Operations & environments | NFR-Reliability, NFR-Perf, NFR-Security | AD-11, AD-25, AD-26 | Vercel / Railway / R2 / Supabase config, secrets, observability, ingest job platform, build-handoff checklist |

**Cross-cutting seams** (shared contracts every capability touches; keep single-owner):
`supabase/migrations` (schema + RLS — each CAP adds its tables/policies, CAP-1 owns the substrate) and
`roulette/vectors` (language-neutral golden vectors gating the Go producer + JS verifier — CAP-6 owns,
CAP-7 gates the build on them).

## Notes on split capabilities

- **F7 is split across two capabilities by read/write axis.** The admin **command routes** (mutations
  — bracket advance, Aprobar, re-parse/rollback, forfeit, format lock, ceremony control) live in
  **CAP-4**; the viewer **timeline feed reads** (FR-31, FR-32) and read-only viewer mode (FR-34) live
  in **CAP-5**. The feed *write* (posting an entry) is part of CAP-4's Aprobar transaction (AD-6); the
  feed *read* is CAP-5.
- **CAP-5 bundles three spine F-units** (F4 derived-stats, F5 views, F7 feed) because §12 Epic 5
  groups them. Natural story seams inside CAP-5: (a) stat derivation in the worker (FR-18/19/20), (b)
  the single normalized leaderboard view with FR-21 floors + rate/volume classing (FR-21/22, AD-20),
  (c) Spanish mobile-first read surfaces + timeline feed + realtime nudge (FR-23/31/32/34, AD-11/24).
- **CAP-3 and CAP-4 dual-own FR-13/14/16.** Ingest performs the staged Pending state, re-parse, and
  demo-derived score (CAP-3); the admin actions that publish (Aprobar), roll back, and apply a manual
  override are command routes (CAP-4). The `match`/`demo` row is the single arbiter (AD-23).
- **AD-13 spans two seeds.** `bracket_seed` (random bracket generation) is CAP-4; `fair_seed`
  (SHA-256 of the final demo, the ceremony RNG seed) is CAP-6. They are distinct fields with distinct
  lifecycles and are never reused for each other.

## FR coverage (FR-1..FR-34 → capability)

| FR | CAP | FR | CAP | FR | CAP |
|----|-----|----|-----|----|-----|
| FR-1 | CAP-2 | FR-13 | CAP-3 + CAP-4 | FR-25 | CAP-6 |
| FR-2 | CAP-2 (+CAP-1 key) | FR-14 | CAP-3 + CAP-4 | FR-26 | CAP-6 |
| FR-3 | CAP-2 | FR-15 | CAP-3 | FR-27 | CAP-6 |
| FR-4 | CAP-2 (+CAP-1 RLS) | FR-16 | CAP-3 + CAP-4 | FR-28 | CAP-6 |
| FR-5 | CAP-4 | FR-17 | CAP-5 | FR-29 | CAP-6 |
| FR-6 | CAP-4 | FR-18 | CAP-5 | FR-30 | CAP-6 |
| FR-7 | CAP-4 | FR-19 | CAP-5 | FR-31 | CAP-5 (read) + CAP-4 (post) |
| FR-8 | CAP-4 | FR-20 | CAP-5 | FR-32 | CAP-5 |
| FR-9 | CAP-4 | FR-21 | CAP-5 | FR-33 | CAP-4 |
| FR-10 | CAP-4 | FR-22 | CAP-5 | FR-34 | CAP-5 |
| FR-11 | CAP-3 | FR-23 | CAP-5 | | |
| FR-12 | CAP-3 | FR-24 | CAP-6 | | |

All 34 FRs covered.

## AD coverage (AD-1..AD-26 → capability)

| AD | CAP | AD | CAP |
|----|-----|----|-----|
| AD-1 | CAP-3 | AD-14 | CAP-6 |
| AD-2 | CAP-3, CAP-5 | AD-15 | CAP-6 |
| AD-3 | CAP-3 | AD-16 | CAP-3 |
| AD-4 | CAP-1, CAP-2 | AD-17 | CAP-1, CAP-4 |
| AD-5 | CAP-3, CAP-4 | AD-18 | CAP-1 |
| AD-6 | CAP-4 | AD-19 | CAP-6 |
| AD-7 | CAP-1, CAP-5 | AD-20 | CAP-5 |
| AD-8 | CAP-4 | AD-21 | CAP-4 |
| AD-9 | CAP-4, CAP-5 | AD-22 | CAP-6 |
| AD-10 | CAP-4 | AD-23 | CAP-3, CAP-4 |
| AD-11 | CAP-5, CAP-7 | AD-24 | CAP-5, CAP-6 |
| AD-12 | CAP-1, CAP-2 | AD-25 | CAP-1, CAP-7 |
| AD-13 | CAP-4 (bracket), CAP-6 (fair) | AD-26 | CAP-3, CAP-7 |

All 26 ADs cited.

## User journey & success-metric anchoring

| ID | Anchored in |
|----|-------------|
| UJ-1 — still in three races | CAP-5 (multiple live leaderboard tracks) + CAP-6 (awards alive to ceremony) |
| UJ-2 — ingest without a spreadsheet | CAP-3 (auto-parse) + CAP-4 (Aprobar in one tap) |
| UJ-3 — demo settles a dispute | CAP-3 (re-parse + re-hash) + CAP-7 (evidence view, DR durability) |
| UJ-4 — nobody leaves empty-handed | CAP-6 (anti-sweep + pity) |
| UJ-5 — clean no-show | CAP-4 (grace timer → forfeit, bye-style advance, zero phantom stats) |
| SM-1 — zero manual stat entry | CAP-3 |
| SM-2 — everyone stays in it | CAP-5 + CAP-6 |
| SM-3 — no unresolved rigging disputes | CAP-3 (demo referee) + CAP-6 (reproducible ceremony) |
| SM-4 — one event end-to-end in-app | all capabilities (the SPEC success signal) |
| SM-5 — demo→stats latency | CAP-3 + CAP-7 |
| SM-C1 — award credibility (no AFK farming) | CAP-5 (FR-21 floors/DQ) + CAP-6 |
| SM-C2 — admin effort < ~2 min/match | CAP-4 (one-tap Aprobar) + CAP-3 (auto-ingest) |
