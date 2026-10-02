---
title: 'Story 5-4: cs-tracker authenticates, the JavaScript/Elixir boundary'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: '43caa3b39d58b748d755c9886283451b6f60151b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/identity-issuer.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** FR-21's acceptance condition and SM-9's binary is one identity carried from the Hub (JavaScript) into `cs-tracker` (Elixir), observed by a person. The Hub signs in since Story 5.3; `cs-tracker` signs in with Steam OpenID 2.0 only. The issuer does not exist yet, and `cs-tracker`'s `main` is what the box pulls.

**Approach:** `cs-tracker` becomes the confidential client `cs-tracker` through `oidcc` 3.8.0, from discovery alone, pinned to what the Hub sends, minting its own `__Host-` session for the one allowlisted subject. Proven against a stand-in issuer in its suite; with any of its four variables unset it behaves exactly as today. The live sign-in, the rollout and the person's observation are Operator-pending.

## Boundaries & Constraints

**Always:** discovery only, no provider name (FR-23). PKCE `S256`, `state`, `nonce`, `client_secret_basic`, asymmetric ID token algorithms, as the Hub. No cookie `Domain`. Only `CS_TRACKER_OIDC_OWNER_SUB` is admitted. Work in the `cs-tracker-dev` worktree on `dev`; never touch the `cs-tracker` checkout or `main`.

**Never:** sign-out (Story 5.5); retiring Steam (DW-326); a Registry `identity` flip before the observation (NFR-9); the box, the issuer, GitHub settings or any `.env.*` file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unconfigured | any of the four values empty | `/auth/sign-in`, `/auth/callback`, `/auth/session` 404; cookie `_cs_tracker_key`; visitors to `/auth/steam` | none |
| Sign-in | configured | 302 to the discovered endpoint with S256, state, nonce, `<PHX_HOST>/auth/callback` | discovery names another issuer: 502; kill switch: 503 |
| Callback | Owner's subject, valid code | code exchanged, ID token verified, session minted, 302 to `/` | 401, no session: no or replayed transaction, state, `error`, `iss`, token refusal, any ID token check, another subject |
| Session | `GET /auth/session` | 200 `{ sub, email }`, `no-store` | 401 without one |

</frozen-after-approval>

## Code Map

- `cs-tracker` `controllers/auth_controller.ex`: the Steam flow and its logging style; untouched.
- `lib/cs_tracker_web/plugs/require_owner.ex`, `live_assigns.ex`: the two owner gates, which must agree.
- `endpoint.ex`: `@session_options` feeds the plug and the socket.
- `config/runtime.exs`: the `STEAM_ID` block is the pattern.
- `cuatro-portfolio` `apps/hub/lib/oidc.ts`: the Hub's half, the reference for every protocol pin.

## Tasks & Acceptance

**Execution:**
- [x] `apps/hub/lib/__tests__/oidc.test.ts`: close 5.3's two minor findings (own commit).
- [x] `cs-tracker` `mix.exs`, `mix.lock`: `oidcc` exactly 3.8.0.
- [x] `lib/cs_tracker/auth/oidc.ex`, `controllers/oidc_controller.ex`, `router.ex`: the client and three routes.
- [x] `plugs/require_owner.ex`, `live_assigns.ex`: admit the Owner's subject; send visitors to OIDC once configured.
- [x] `endpoint.ex`, `config/runtime.exs`, `config/test.exs`: runtime session key, the four values, the test-only HTTP quirk.
- [x] `test/cs_tracker_web/controllers/oidc_controller_test.exs`, `test/cs_tracker/config/prod_config_test.exs`, `docs/deployment.md`.
- [x] `ops/identity-issuer.md` § cs-tracker's sign-in (CT1 to CT6), `ops/cs-tracker-token-adoption.md` re-run, `deferred-work.md` DW-323 to DW-326.

**Acceptance Criteria:**
- AC1: Given any of the four values unset, when the suite and the production image run, then the matrix's unconfigured row holds, an OIDC subject in a session admits nothing, and the release answers six probes identically to `main`'s image.
- AC2: Given the stand-in issuer, when the suite signs in, then the issuer receives S256 PKCE and Basic client authentication, `/auth/session` returns its `sub`, and the HTTP and live gates admit the session.
- AC3: Given each error row of the matrix, then the callback answers 401 and mints no session; a used transaction is gone from the session.
- AC4: Given a discovery document offering `plain`, HS256, `client_secret_post`, request objects and ID token encryption, then only the Hub's choices are used and an HS256 or unsigned encrypted ID token is refused; removing any pin fails a case.
- AC5: Given OIDC configured over HTTPS, then the session cookie is `__Host-cs-tracker`, `Secure`, `HttpOnly`, `Path=/`, no `Domain`, in the suite and the production release, and the LiveView socket reads it through the same runtime options.
- AC6: Given the module and controller, then no provider is named.
- AC7: `oidcc`'s licence, dependencies, advisories and HTTP client are reviewed and recorded (Constitution rule 19).
- AC8: `mix precommit` passes on OTP 26, the suite on OTP 28.5, the production image builds; typecheck and the full root suite pass; the adoption probe exits 0.
- AC9: 5.3's HS256 and purpose-audience cases exist and each fails under its mutation.
- AC10 (Operator-pending): CT1 to CT3 done, `https://cs-tracker.cuatro.dev/auth/session` answers 401.
- AC11 (Operator-pending): CT5: a person sees the same `sub` at both `/auth/session` routes and no `.cuatro.dev` cookie (FR-21, SM-9).
- AC12 (Operator-pending): CT6: `cs-tracker`'s `.env.example` documents the four names.

## Design Notes

- An owner allowlist, not any verified subject: `cs-tracker` holds one person's inventory, and the issuer may admit others (Story 5.8's demo principal). It is `STEAM_ID`'s counterpart, read from the Hub's `/auth/session`.
- The session key is decided at runtime so unconfigured is exactly today; `__Host-` needs `Secure`, so only production with OIDC gets it.
- Stateless like the Hub: discovery and JWKS per request, no `oidcc` worker, so an unreachable issuer at boot cannot crash the supervision tree.
- Spec about 1596 tokens (6382 characters before § Verification, at 4 per token) when written: under 1600, no Split or Keep question arose.

## Verification

**Commands:**
- `cs-tracker`: `mix precommit`; `mix test` in `hexpm/elixir:1.19.5-erlang-28.5-debian-trixie-20260610-slim`; `docker build`.
- `cuatro-portfolio`: `corepack pnpm typecheck`, `corepack pnpm test --run`, `corepack pnpm --filter hub build`, `node ops/cs-tracker-adoption-probe.mjs`.

## Implementation Notes

- Order: written by an unattended builder with no subagent tool, which read and implemented before writing this spec; the frozen block states the intent the code was built to, nothing found after it.
- `cuatro-portfolio` `43caa3b` (5.3 follow-up): the HS256 case pins the refusal message to the allow-list, since `jose`'s JWKS refuses HS* by itself; with `HS256` added the message becomes jose's own and the case fails. The purpose case seals tokens carrying both shapes' fields; removing `audience: purpose` fails both (200 for 401, 302 for 400). `oidc.test.ts` 24 passed.
- `cs-tracker` `3d613f2`, `0f10ed0`, `687edfb` on `dev`. `oidcc` refuses discovery without `scopes_supported`; `clerk.clerk.com` carries it (record). Hex 2.5.1 flagged EEF-CVE-2026-75759 in `oidcc` 3.8.0: the suite reproduces it (unsigned encrypted token admitted, 302) with the encryption fields left as discovery says, and refuses it with them unset (CT4, DW-324).
- Mutation, each failing at least one case: the asymmetric list, S256, no request object, `client_secret_basic`, `trusted_audiences`, `iss`, state, `error`, nonce, the owner check at callback, the single-use transaction, the plug's and live gate's owner checks and redirect targets, the `__Host-` key, the kill switch, the encryption pin.
- Suites: `mix precommit` exit 0, 686 tests, 0 failures, 4 excluded (baseline 653); the same 686 in the OTP 28.5 builder image at `687edfb` (2026-10-02T17:21:42Z). Root: typecheck exit 0; 77 files, 1873 passed, 1 skipped, 1 todo. Hub build exit 0. Adoption probe 19 of 19, exit 0 (first run exit 3, no Chromium).
- Production image at `0f10ed0`, against a scratch Postgres, kill switch on: `/`, `/auth/steam`, the three OIDC routes and `/browse` answered exactly as `main`'s image `bde2b3f` (2026-10-02T17:16:00Z). On an internal network with no egress, kill switch off: unconfigured `/auth/steam` set `_cs_tracker_key`; configured (issuer `https://issuer.invalid`) `/` 302 to `/auth/sign-in`, `/auth/steam` set `__Host-cs-tracker` (`path=/; secure; HttpOnly; SameSite=Lax`, no Domain), `/auth/sign-in` 502, `/auth/session` 401 `no-store`.

## Independent verification

No independent verifier has run yet.

## Spec Change Log

## Review Triage Log

Review layers run inline by the builder (no subagent tool); the independent verifier is the context-free pass. Ponytail, the ECC verification loop and self-evaluation were applied inline, not invoked as skills. Design review skipped: no `.scss`, no rendered `.tsx`, no motion. Ponytail: lean.

- medium, patched: the live gate was unproven, the plug answering first; it is now called directly.
- medium, patched: the socket's MFA session differs from the plug's only in production; a case now holds both transports to the endpoint's runtime options.
- low, rejected: each sign-in fetches discovery and the JWKS, as the Hub does; one Owner, and the edge rate-limits.
- low, rejected: `oidcc` uses `:httpc`, not `Req`; a `Req` adapter is code for no gain, and the kill switch and TLS verification are applied around it.
