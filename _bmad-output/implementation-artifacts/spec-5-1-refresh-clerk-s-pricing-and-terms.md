---
title: 'Story 5-1: Refresh Clerk''s pricing and terms'
type: 'chore'
created: '2026-10-02'
status: 'done'
baseline_commit: '942833b2c3091ee5f77434308b1d411639b133c5'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Epic 5 commits the estate to Clerk on a price read 2026-08-15 (and re-read 2026-09-30 as one row of Story 4-1's refresh), and nothing yet records Clerk's terms or names the recurring identity charge against NFR-4's $100 a month ceiling. Story 5.2 cannot create the issuer until the plan it runs on is a named decision.

**Approach:** Re-read Clerk's own pricing page, Standard Terms and the two OAuth provider docs pages, quote what bears on AD-11's shape (one issuer, one OAuth client per application, PKCE, a shared demo user), write them with URL and retrieval time into a new record `ops/clerk-pricing-and-terms.md`, and record the plan choice as a named decision against NFR-4, pending the Operator's ruling with a recommendation. AD-22's bounded scope only: Clerk pricing, plus the terms the story names.

## Acceptance Criteria

- AC1: Given the record, when each price, limit and term it cites is read, then it carries a quotation from a Clerk-published page, that page's URL and the UTC retrieval time, and observation is never presented as decision (NFR-9).
- AC2: Given AD-11's shape, when the record is read, then it states for each AD-11 element (the issuer, one OAuth client per application, PKCE, the shared demo principal, the Operator's sign-in) which plan line prices or limits it, or that no Clerk page read prices it.
- AC3: Given the terms, when the record is read, then the terms' version date, the fee-change notice, refunds, suspension, the licence's purpose clause and the free-plan status are quoted, each with what it means for this estate.
- AC4: Given NFR-4, when the record is read, then the recurring identity charge is a named decision row: each option's monthly figure, the estate's recorded marginal spend today, the total against $100, and a recommendation, marked pending the Operator's ruling and listed as a Pending Operator action.
- AC5: Given AD-22's bounded scope, when the diff is read, then nothing outside Clerk's pricing and terms re-opens, and a consequence owned by a later story is filed in `deferred-work.md`, not built.
- AC6: Given the change, when typecheck and the full root suite run, then both pass.
- AC7: Given the Operator's ruling on the decision row, when it is recorded in the record with its date, then the story is done. (Met 2026-10-03T22:04Z: the Operator ruled Hobby at $0.)

## Boundaries & Constraints

**Always:** Clerk-published sources only (no listicles); retrieval time in UTC; the Operator's choice recorded as pending, never made for him.

**Never:** create a Clerk account or instance; add a Clerk, OIDC or issuer variable to any env file or secret; change application code; re-open Railway, versions or any other AD-22 item.

</frozen-after-approval>

## Code Map

- `ops/settled-inputs-refresh.md`: precedent shape (item table, decisions, Pending Operator actions); its Clerk row of 2026-09-30 is the prior reading.
- `ops/monitoring.md` § The cost against NFR-4: precedent for a $0 named decision and the escalation branch.
- `ops/backup-digital-library.md`, `ops/postgres-backup.md`: R2 at $0 a month; `prd.md` NFR-4: box prepaid to 2028-07-19.
- `AGENTS.md` line on `ops/` records: count 36 and list.
- `sprint-status.yaml`: `epic-5`, `5-1` rows. `deferred-work.md`: next id DW-319.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Pages read 2026-10-02 between 14:01:42Z and 14:01:53Z with `curl` and indexed for search; no Clerk account, no credential. Every double-quoted string in the record was checked by script against the fetched pages; the only misses were line-wrapped quotations, the spine's own words and one changelog card read from the page's embedded JSON.
- New record `ops/clerk-pricing-and-terms.md` rather than a section in `ops/settled-inputs-refresh.md`, whose title and scope are Epic 4's; its maintenance rule allows a new dated file. `AGENTS.md` record count 36 to 37 with the record named, as Story 4-1 did.
- Decision recorded as pending the Operator's ruling, recommendation Hobby at $0. The estate's recorded marginal spend today is $0 (box, UptimeRobot, R2, Cloudflare Free); the domain registration is in no ops record and is said so.
- Found in passing: neither OAuth docs page mentions logout. Not researched (outside pricing scope); filed as DW-319 for Stories 5.2 and 5.5.
- `epic-5-context.md` compiled for this epic (none existed).
- Tests: typecheck exit 0. Full root suite 1839 passed, 1 skipped, 5 failed, every failure in the WSL bash suites (`deploy-remote`, `library-backup`, `postgres-backup`, `tournament-backup`, `tracker-backup`), the DW-135 host flake. The five files re-run together failed the same five cases again; each file run alone then passed in full (28, 59, 20 plus 1 skipped, 15, 11). The diff touches no code. No Hub code changed, so no Hub build.

## Review Triage Log

Blind Hunter layer run inline by the builder, not as a context-free subagent (no subagent tool in this run); the independent verifier is the context-free pass.

- medium, patched: the record's fee-change row said the free allowance was outside the notice clause; the clause covers "to institute new usage charges and Fees", so a new charge on Hobby gets the same 30 days. Rewritten, and the email shown to be a "may".
- medium, patched: retrieval times read 14:02Z to 14:03Z; the fetched files' mtimes are 14:01:42Z to 14:01:53Z. Corrected in the record and DW-319.
- low, patched: "may be permanently lost" is in capitals in the original; marked.
- low, patched: the record claimed NFR-4 asks for the cheapest arrangement; it does not. Reworded to what NFR-4 says.
- low, patched: the publicity row claimed the terms state no opt-out anywhere; only that clause was read. Narrowed to the clause.

## Verification

**Commands:**
- `corepack pnpm typecheck`: expected exit 0
- `corepack pnpm test --run`: expected all files pass

## Independent verification

Independent verifier, round 1, 2026-10-02: **pass**, no blocker, major or minor finding. A context-free
session that did not write the change ran the following against `f7f4c80` on `dev`.

- Spec against intent: AC1 to AC7 cover `epics.md` Story 5.1's intent (AD-22's bounded scope, the
  recurring cost as a named decision against NFR-4) and the spine's Recurring cost row. Nothing narrowed.
- AC1: re-fetched the four Clerk pages at 2026-10-02T14:17Z (all HTTP 200, the pricing page again
  624,478 bytes) and checked every double-quoted string in `ops/clerk-pricing-and-terms.md` against
  them by script: 62 found verbatim. Of the four misses, two are split by page markup and were found in
  the page source (the `id_token` lifetime, the "free trial" designation), one is the spine's own
  words (found in AD-22) and one is the record's own decision marker. The terms still read "Last
  updated: July 2, 2026". Plan assignments for MFA, branding removal, the fixed 7-day session and
  satellite domains were checked in the pricing page's comparison table.
- AC2: the eight-row table covers every AD-11 element; the pricing page names no OAuth application
  (zero matches), so "No Clerk page read prices or limits it" is accurate and carries action 2.
- AC3 and AC4: each term is quoted with its meaning; the decision row has three options, figures, the
  $0 recorded marginal spend with sources, the total against $100, a recommendation, pending the
  Operator, and is Pending Operator action 1.
- AC5: the diff touches only the record, `AGENTS.md`, this spec, `epic-5-context.md`,
  `deferred-work.md` and `sprint-status.yaml`; no code, env file or secret. DW-319's claim was
  re-checked: neither OAuth docs page contains `logout`, `end_session` or `backchannel`.
- AC6: `corepack pnpm typecheck` exit 0. `corepack pnpm test --run`: 1839 passed, 1 skipped, 5 failed,
  all five in WSL bash suites (DW-135). Each of the six WSL suites re-run alone passed in full
  (`deploy-remote` 28, `library-backup` 59, `tracker-backup` 11, `postgres-backup` 20 plus 1 skipped,
  `postgres-init` 17, `tournament-backup` 15). No Hub code changed, so no Hub build or rendered-output run.
- AC7: Operator-pending, correctly: the plan ruling is his (Pending Operator action 1).
- Prose and secrets: no em-dash, en-dash, spaced double-dash or emoji in any added line; no key,
  secret or password pattern.
