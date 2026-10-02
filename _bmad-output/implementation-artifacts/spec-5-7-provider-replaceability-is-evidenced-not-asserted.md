---
title: 'Story 5-7: Provider replaceability is evidenced, not asserted'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: '7275275'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/identity-issuer.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** FR-23 (AD-11): substituting the identity provider is a configuration change, no participant holding provider-specific logic beyond issuer configuration and client credentials, demonstrated by pointing an application at a different issuer, never by reading the code. Each participant (the Hub, `cs-tracker`, the dashboard's forward-auth) was proven only against a stand-in its own suite wrote. `cs-tracker` keeps Steam OpenID 2.0 beside OIDC (DW-326).

**Approach:** A real, independently implemented OpenID Provider (dex, pinned by digest, test-time only) on a scratch network; each built production artefact pointed at it through its existing variables alone, a sign-in completed and the session minted, by a repeatable script and a CI job. Decide DW-326 and make `cs-tracker` hold one identity path once configured. The live estate's swap is the Operator's.

## Boundaries & Constraints

**Always:** production artefacts unmodified; only issuer and client variables (and the scratch authority's trust) differ; no secret printed or committed; Rule 19 review recorded.

**Never:** the box, the issuer, Cloudflare, GitHub settings, `.env.*`; `cs-tracker`'s `main`; a change to what `cs-tracker` serves unconfigured.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Swap | each artefact, issuer variables pointed at dex | 401, 302 to dex with S256, callback 302, `__Host-` session, no `Domain`, session 200 (forwardAuth 202) | any other answer: script exits 1 |
| One identity | `cs-tracker`'s owner set to the Hub's `sub` | equal subjects | differing: exit 1 |
| Steam, configured | `/auth/steam`, a Steam session | unrouted 404; admits nothing | none |
| Steam, unconfigured | today's `main` | identical to `faaa642` | none |

</frozen-after-approval>

## Code Map

- `apps/hub/lib/oidc.ts`: three variables, discovery only; redirect URI from `HUB_ORIGIN`.
- `cs-tracker` `lib/cs_tracker/auth/oidc.ex` (four variables; HTTPS issuer verified against the OS bundle), `router.ex` `:oidc_configured`, `plugs/require_owner.ex`, `live_assigns.ex`, `auth_controller.ex` `sign_out`.
- `ops/traefik/compose.yml` `forward-auth` (five interpolated names); `ops/identity-issuer.md` § 5.6 rehearsal (the shape reused).
- `ops/__tests__/contract-purity.test.ts`, `registry-schema.test.ts`: `ci.yml`'s job set; `identity-issuer.test.ts`: no literal value for a client variable.

## Tasks & Acceptance

**Execution:**
- [x] `ops/provider-swap.sh`, `ops/provider-swap-sign-in.mjs`; `ci.yml` job `provider-swap`; `ops/__tests__/provider-swap.test.ts`; both job pins.
- [x] `cs-tracker` `dev`: Steam unrouted and its session refused once configured; tests; deployment doc.
- [x] `ops/identity-issuer.md` § Provider replaceability (review, run, PS1 to PS3); DW-320, DW-326 notes.

**Acceptance Criteria:**
- AC1: Given dex and the Hub's production image given only its three variables, when the script runs, then the matrix's swap row holds.
- AC2: Given `cs-tracker`'s production image given only its four variables over its boot baseline, then the swap row holds and its `sub` equals the Hub's.
- AC3: Given the committed `forward-auth` given only its five names, then the swap row holds, the forwardAuth check answering 202.
- AC4: Given the second issuer, then its image is pinned by digest and its licence, advisories, storage and footprint are recorded, never on the box.
- AC5: Given the script, then it is repeatable and leaves nothing behind; the CI job runs it without an account and the record says why `cs-tracker` is not in it; a test holds each participant's variables as exact sets.
- AC6: Given DW-326, then the record states what FR-23 and AD-11 require; configured, Steam is unrouted and its session admits nothing; unconfigured, `cs-tracker` answers as `faaa642`.
- AC7: The typecheck and the full root suite pass; `cs-tracker`'s `mix precommit` passes; the adoption probe exits 0.
- AC8 (Operator-pending): PS1, the live estate's evidence ruled, and the swap recorded if ruled.
- AC9 (Operator-pending, ruling): PS2, the Steam code's deletion (DW-326).

## Design Notes

dex because it is small (one Go binary, memory store), lets client ids be chosen (DW-320), and differs from Clerk in login pages, `sub` format and logout support. The trust anchor is the only non-variable input: `cs-tracker` verifies HTTPS against the OS bundle, so a scratch issuer needs its authority trusted; a public issuer does not.

## Verification

**Commands:**
- `HUB_IMAGE=... CS_TRACKER_IMAGE=... bash ops/provider-swap.sh` (record § Provider replaceability, Repeatable).
- `corepack pnpm typecheck`, `corepack pnpm test --run`; `cs-tracker`: `mix precommit`; `node ops/cs-tracker-adoption-probe.mjs`.

## Implementation Notes

- Order, stated plainly: an unattended builder with no subagent tool. The demonstration was prototyped and run before this spec was written, and the spec states what it proved. Spec about 1316 tokens (5265 characters before § Implementation Notes, at 4 per token), under 1600, so no Split or Keep question arose; Checkpoint 1 answered Approve, no open question remained.
- Images: the Hub's production image built from `apps/hub/Dockerfile` at `7275275` (no Hub source changes in this story, so it is the final tree's Hub); `cs-tracker`'s from `git archive` of `faaa642` and of `ee33c71`. dex v2.45.1 by index digest; oauth2-proxy from the committed `compose.yml`.
- Demonstration (AC1 to AC3, AC5): 2026-10-02T22:55:32Z to 22:55:57Z exit 0, output in `ops/identity-issuer.md`; on the committed script 23:05:14Z to 23:05:44Z exit 0 with the same lines; CI form (no `CS_TRACKER_IMAGE`) exit 0; a wrong Hub client secret: callback 400, exit 1. Nothing left behind after each (no container, no network). The `provider-swap` job has not run on GitHub: nothing was pushed.
- AC6: `cs-tracker` `f1501ac` (code and tests), `ee33c71` (deployment doc) on `dev`. `mix precommit` (Elixir 1.19.5, OTP 28 native, scratch Postgres 18) exit 0, 726 tests, 0 failures, 4 excluded (723 before). Mutants, each failing one case: the plug's `is_nil(config())` dropped (once the plug was tested on its own; on `/` the live gate hid it), the live gate's dropped, `:oidc_unconfigured` after `:browser`, the pipeline removed, the Steam sign-out back to `/auth/steam`. Unconfigured production images of `faaa642` and `ee33c71`: seven probes identical (status, masked headers, body length), 22:55:24Z.
- `provider-swap.test.ts` 7 cases; mutants each failing one: an extra env on the Hub, the dex digest removed, `KILL_SWITCH` in `cs-tracker`'s baseline, a `command:` in the compose override.
- AC7: typecheck exit 0. Full root suite: 1913 passed, 1 skipped, 1 todo, 3 failed, all in the DW-135 WSL-bash suites; each then passed alone (deploy-remote 28, library-backup 59, postgres-backup 20 and 1 skipped). Adoption probe 19 of 19, exit 0 (23:05:58Z).
- Independent verification: see § Independent verification.

## Independent verification

- Round 1 (2026-10-02, tree `8f412f8`, cs-tracker `ee33c71`): **pass**, no blocker, major or minor finding. AC1 to AC7 met on this round's own runs; AC8 (PS1) and AC9 (PS2) stay Operator-pending, so the board row stays `awaiting-operator`. What it ran:
  - Its own images: the Hub from `apps/hub/Dockerfile` at `8f412f8`, `cs-tracker` from `git archive` of `ee33c71` and of `faaa642`. `ops/provider-swap.sh` with both, 2026-10-02 between 23:09:01Z and 23:09:37Z, exit 0: each participant 401, 302 to dex with `client_id`, S256, `state` and `nonce`, callback 302, a host-only `__Host-` cookie, Secure, HttpOnly, `Path=/`, no `Domain`, session 200; `cs-tracker`'s `sub` equal to the Hub's, `/auth/steam` 404; forwardAuth 202. No container and no `cs-tracker_default` network left behind.
  - Negative controls on scratch copies of the script: `CS_TRACKER_OIDC_OWNER_SUB` not the Hub's `sub`, the `cs-tracker` callback 401 and exit 1; `TRAEFIK_OIDC_OWNER_EMAIL` another address (the CI form, no `CS_TRACKER_IMAGE`, the Hub signed in first), the forward-auth callback 403 and exit 1.
  - AC4: `docker buildx imagetools inspect` gives the pinned index digest; `gh api` Apache-2.0, not archived; the repository's advisories and OSV for 2.45.1 match the record (GHSA-7qjx-gp9h-65qj affects later than 2.45.1, GO-2024-2476 is 2.37.0 only). A bare instance idled at 0.00% CPU and 10.0 MiB.
  - AC6: the unconfigured production images of `faaa642` and `ee33c71`, eight probes (`/`, `/auth/steam`, its callback, `/auth/sign-in`, `/auth/session`, `/auth/callback`, `/auth/backchannel-logout`, an unrouted path) with `X-Forwarded-Proto: https`: status, headers, location and decompressed body length identical; only the gzip `content-length` of the two pages carrying a random CSRF token differs by 1 to 3 bytes (23:22:03Z).
  - Mutants in `cs-tracker`, each killed: the plug's and the live gate's `is_nil(config())` dropped, the pipeline removed, placed after `:browser`, made inert, inverted (15 failures), the sign-out target back to `/auth/steam`. Against `provider-swap.test.ts`, each killed: an extra env on the Hub and on `cs-tracker`, an extra name in forward-auth's env file, dex by tag, `continue-on-error` on the job, an `--entrypoint`, an `environment:` in the compose override.
  - Gates: `corepack pnpm typecheck` exit 0. Full root suite 1911 passed, 1 skipped, 1 todo, 5 failed, all in DW-135 WSL-bash files at about 30 seconds with empty output, each of which then passed alone (deploy-remote 28, library-backup 59, postgres-backup 20 and 1 skipped, tournament-backup 15, tracker-backup 11). `cs-tracker` `mix precommit` natively (Elixir 1.19.5, OTP 28) exit 0, 726 tests, 0 failures, 4 excluded, tree unchanged. Adoption probe 19 of 19, exit 0 (23:27:57Z). No Hub source changed, so no Hub build or browser suite was due beyond the image build.

## Spec Change Log

## Review Triage Log

Review layers run inline by the builder (no subagent tool); the independent verifier is the context-free pass. Ponytail, the ECC verification loop and self-evaluation applied inline, not invoked as skills. Design review skipped: no `.scss`, no `.tsx`, no motion.

- high, patched: the script assigned literal client ids to the client variables, which Story 5.2's no-value scan refuses; each is interpolated from a derived variable now.
- medium, patched: dex forces a consent page when oauth2-proxy sends `approval_prompt=force`; the driver approves it as a person would, rather than the demonstration changing forward-auth's configuration.
- medium, patched: the plug's new Steam check passed every case because the live gate answered first on `/`; a case calls the plug alone.
- low, patched: the Postgres wait was unbounded; it gives up after 60 seconds. Compose's stderr is no longer hidden, so a CI failure names its cause.
- low, rejected: `node:24-slim` and `postgres:18` are tags, not digests. They are the driver and a scratch store, not participants; dex, the evidence, is pinned.
- low, deferred to the Operator: PS1 to PS3 in `ops/identity-issuer.md`.
