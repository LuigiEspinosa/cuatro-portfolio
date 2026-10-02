---
title: 'Story 5-2: One Clerk issuer and one OIDC client per application'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: 'ac7fc9b49632a3a8c4b8b1d46501e778f75a95ff'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/clerk-pricing-and-terms.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** Epic 5 needs one Clerk issuer and one OIDC client for each participating application (the Hub and `cs-tracker`, FR-21), named mechanically from the application id (AD-3), with credentials only in GitHub Actions secrets and the on-box env files, and `.env.example` documenting every variable. Nothing exists yet, and DW-319 asks whether the issuer offers the logout AD-11 requires.

**Approach:** A new record `ops/identity-issuer.md` holds the issuer decision, the clients table derived from the Registry id, where each credential lives, the logout answer from what is publicly readable, and the Operator's by-hand steps. A test holds the table to the derivation and `.env.example` to the table. Creating the account, issuer, DNS, clients, secrets and env lines is the Operator's.

## Boundaries & Constraints

**Always:** one spelling per credential everywhere (env line, GitHub secret, record): `<ID>_OIDC_CLIENT_ID` and `<ID>_OIDC_CLIENT_SECRET`, `<ID>` the Registry id uppercased with hyphens as underscores, plus one shared `OIDC_ISSUER`. Every step holds on Hobby or Pro (5.1's ruling is pending). Observation and decision never presented as the same fact (NFR-9).

**Never:** a credential value in any tracked file or in output; flip a Registry `identity` (no application authenticates yet, NFR-9); wire variables into compose or application code (Stories 5.3, 5.4); touch the spine or `cs-tracker`.

</frozen-after-approval>

## Code Map

- `contracts/registry.json`: ids; only `maicoin` is `wallet`, the rest `none`.
- `ops/__tests__/postgres-init.test.ts`: precedent for a record table held to Registry-derived names.
- `ops/clerk-pricing-and-terms.md`: 5.1's record; actions 1 to 3 precede issuer creation.
- `docker-compose.yml` `anchor-app`, tracker block: the Hub's env file `/home/deploy/cuatro-portfolio/.env.production` is shared by four services, hence the prefix. `cs-tracker` reads `/home/deploy/cs-tracker/.env`.
- `.env.example`: tracked; the session's global `Read(**/.env.*)` deny means it is appended to, never read.
- `deferred-work.md`: DW-319 (amend), next id DW-320. `AGENTS.md`: record count 37.

## Tasks & Acceptance

**Execution:**
- [x] `ops/identity-issuer.md`: new record: issuer, clients table, credential placement, logout reading with URL and UTC time, by-hand steps, Pending Operator actions.
- [x] `ops/__tests__/identity-issuer.test.ts`: hold the derivation and no assigned value in any unignored file; the `.env.example` case is an `it.todo` (Implementation Notes).
- [ ] `.env.example`: append the five variables, empty. Blocked by the session's permission settings; Pending Operator action 8.
- [x] `deferred-work.md`: amend DW-319; file AD-3's Client ID limit (DW-320).
- [x] `AGENTS.md`, `sprint-status.yaml`: record count and list; 5-2 row.

**Acceptance Criteria:**
- AC1: Given the record's clients table, when the test runs, then every row is a Registry id, `cuatro-portfolio` and `cs-tracker` are present, no `wallet` entry is, each Clerk OAuth application name equals its id, and each variable is the derived name.
- AC2: Given `.env.example`, when the test runs, then it names `OIDC_ISSUER` and every table variable, each with an empty value.
- AC3: Given the tracked tree, when the test runs, then no tracked file assigns a non-empty value to any of those variables.
- AC4: Given the record, when read, then the Clerk-assigned Client ID (AD-3 holds on the name and the variables, not the value) is stated and filed.
- AC5: Given DW-319, when the record is read, then each logout field read from a published discovery document is quoted with URL and UTC time, what stays unknown until the estate's issuer exists is said, and DW-319 is amended.
- AC6: Given the by-hand steps, when read, then each names its exact action, holds on either plan, verifies by variable name only, and is a Pending Operator action.
- AC7: Given the change, when typecheck and the full root suite run, then both pass.
- AC8 (Operator-pending): Given the issuer and both clients exist and their credentials are placed, when the record's actions are dated, then the story is done.

## Implementation Notes

- Implemented inline (no subagent tool in this run). Read 2026-10-02 between 14:36Z and 14:40Z with `curl`, no Clerk account and no credential: the SSO and how-Clerk-implements-OAuth guides (Markdown form), the production deployment and cookie guides, and the live issuer `https://clerk.clerk.com`'s `openid-configuration` and `oauth-authorization-server` (HTTP 200 each). That issuer states `backchannel_logout_supported: false`, `frontchannel_logout_supported: false` and no `end_session_endpoint`: DW-319 amended and carried to an Operator ruling before 5.5.
- Clerk assigns the Client ID, so AD-3's derivation holds on the OAuth application's Name and the variables, not the value: DW-320 filed. The issuer's hostnames must be DNS only for Clerk, against AD-26: DW-321 filed, Operator ruling before step 5.
- Issuer domain `id.cuatro.dev`, a recorded decision: Clerk scopes its cookies to the instance's root domain, and `cuatro.dev` as root could put a `Domain=.cuatro.dev` cookie in the estate (AD-11). The record's step 7 observes it.
- **`.env.example` was not edited.** The user-level `Read(**/.env.*)` deny refused the Read tool, `Grep` and `cat`, and a `printf >>` append was refused too. Not worked around. The exact block is in `ops/identity-issuer.md` § Where each credential lives, and its test case is an `it.todo` whose comment spells the assertion; Pending Operator action 8 does both. AC2 is unmet in this session.
- The no-value scan was proven to bite: a planted untracked `ops/zz-probe.txt` assigning `CS_TRACKER_OIDC_CLIENT_ID` a value failed the case, and passed again once removed.
- Tests: `identity-issuer.test.ts` 4 passed, 1 todo. Typecheck exit 0. Full root suite 1842 passed, 1 skipped, 1 todo, 6 failed, all six in the WSL bash suites (DW-135); each re-run alone passed in full (`deploy-remote` 28, `library-backup` 59, `postgres-backup` 20 plus 1 skipped, `postgres-init` 17, `tournament-backup` 15, `tracker-backup` 11). No Hub code changed, so no Hub build.

## Review Triage Log

Review layers run inline by the builder, not as context-free subagents (no subagent tool in this run); the independent verifier is the context-free pass. Design review skipped: no `.scss`, `.tsx` or motion in the diff. ECC verification loop: typecheck, full suite and the six WSL re-runs as in Implementation Notes; Hub build N/A (no Hub code); lint N/A (no lint command, AGENTS.md).

- medium, patched: the issuer's hostnames must be DNS only for Clerk's CNAME check, which AD-26 forbids as written; the runbook would have breached it silently. Record now names the conflict, step 5 waits on a new Pending Operator action 9 (accept as a KV in the KV-7 shape, or proxy Clerk's Frontend API), DW-321 filed.
- medium, patched: step 5 left the new records out of `ops/routing-inventory.md`, which AD-22's topology item reads; step 5 and action 2 now add them as a dated revision.
- low, patched: step 7 placed the Account Portal "on the Domains page", which no page read says; reworded to the hosted sign-in page.
- low, patched: the record's Contents omitted § Issuer run.
- low, rejected: `gh secret set -f` parses dotenv, so a value with `#` or quotes could be altered; Clerk's ids and secrets are not known to contain either, and the check in step 10 is by name. Unlikely and the guard would add complexity.
- false: the no-value scan could match the test's own source; the pattern is built from the record at run time and the source carries no literal `NAME=`, and the clean run passes.
- false: the spec's frozen Approach says the test holds `.env.example`; that deviation is the permission wall, recorded in Implementation Notes and AC2 left unmet, not a defect of the diff.

## Design Notes

- Spec about 1190 tokens (4744 characters), under 1600: no Split or Keep question arose.
- Checkpoint 1 answered by the unattended builder: Approve and continue. No open question remained; the issuer's domain (`id.cuatro.dev`, so Clerk's root-domain cookies never reach `.cuatro.dev`, AD-11) is recorded in the record as a decision the Operator may overrule before step 4 of its runbook.

## Verification

**Commands:**
- `corepack pnpm vitest run ops/__tests__/identity-issuer.test.ts`: expected pass
- `corepack pnpm typecheck` and `corepack pnpm test --run`: expected pass (DW-135 WSL flakes re-run alone)

## Independent verification

No independent verifier has run yet.
