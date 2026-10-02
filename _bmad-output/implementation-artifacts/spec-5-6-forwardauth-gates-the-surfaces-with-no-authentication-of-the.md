---
title: 'Story 5-6: ForwardAuth gates the surfaces with no authentication of their own'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: '3534a14'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/identity-issuer.md'
  - '{project-root}/ops/traefik-cutover.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** AD-11: Traefik ForwardAuth gates the surfaces with no authentication of their own (the Traefik dashboard, admin surfaces) and is never an application's identity path. The dashboard's only gate is Traefik's basic auth. Traefik reads `ops/traefik/` from the checkout every deploy resets to `main` (DW-299), and the issuer may not exist when Epic 5 merges.

**Approach:** A provider-neutral forward-auth service (oauth2-proxy, the OIDC client `traefik`, discovery only) in Traefik's stack, and the dashboard's gate switched to it by one by-hand step: an environment variable Traefik reads when its container is created, guarding every new router, middleware and service in `routes.yml`, with the service under a compose profile. Unset, the box serves exactly as today. Rehearsed in a real Traefik v3.7.13 with a stand-in issuer.

## Boundaries & Constraints

**Always:** the dashboard stays loopback-only; the Owner alone is admitted; `__Host-` host-only cookie, PKCE `S256`; no provider named (FR-23); names derived per AD-3; values only in gitignored env files and GitHub secrets.

**Never:** a public hostname for the dashboard; a forwardAuth middleware on any application router; a change to what the box serves before the by-hand step; the box, the issuer, Cloudflare, GitHub settings or any `.env.*` file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Switch unset | today's box | routers, middlewares, services and every response identical to `main`'s file | none |
| Switched, no session | `GET /dashboard/` | 302 to the issuer, PKCE `S256` | basic credentials or forged identity headers: 302 |
| Owner signs in | callback | `__Host-traefik-dashboard`, no `Domain`; dashboard 200 | another identity at the issuer: 403, no session |
| Application routes | either state | unchanged; no public router reaches the service | none |
| Switch removed | break-glass | basic auth again, identical to `main`'s | none |

</frozen-after-approval>

## Code Map

- `ops/traefik/dynamic/routes.yml`: watched, a Go template (`{{ env "TRAEFIK_DASHBOARD_USERS" }}` already). The `dashboard` router; comments are rendered too.
- `ops/traefik/compose.yml`: `ingress` (`env_file: .env`), network `cs-tracker_default`, volumes; started by hand.
- `ops/__tests__/traefik-config.test.ts`: reads the files as indented text; pins the compose keys and the dashboard router.
- `ops/identity-issuer.md`: the client derivation and every Pending Operator action; `ops/traefik-cutover.md` § Rehearsed off the box: the rehearsal shape.
- `ops/capacity-gate.yml` header: infrastructure (Umami, Postgres) is not a placement.
- `cs-tracker` `oidc_controller.ex` `refuse_under_kill_switch`, `config/runtime.exs` (`KILL_SWITCH` at boot): Story 5.5 finding 2.

## Tasks & Acceptance

**Execution:**
- [x] Story 5.5's three findings first, own commits: the Hub's unconfigured 404 prose; the kill-switch decision and a callback case in `cs-tracker`; the OTP 28 suite and the image comparison, recorded.
- [x] `routes.yml`, `compose.yml`: the guarded routers, middleware, service; `forward-auth` pinned by digest under a profile.
- [x] `traefik-config.test.ts`: both renders, AD-11, the service's settings.
- [x] `ops/forward-auth-stand-in-issuer.mjs`; `ops/identity-issuer.md` § The Traefik dashboard behind ForwardAuth (review, capacity, rehearsal, FA1 to FA7); `routing-inventory.md`; DW-329, DW-330.

**Acceptance Criteria:**
- AC1: Given the switch unset, when Traefik v3.7.13 loads this `routes.yml` in place of `main`'s, then every probe and `/api/rawdata` are byte-identical, and the test's off render names no forward-auth anything.
- AC2: Given the switch on and a stand-in issuer, then the matrix's switched rows hold in the rehearsal.
- AC3: Given either state, then no router but the dashboard's names a forwardAuth middleware, no public router reaches the service (the test), and every application probe is identical before and after the switch (the rehearsal).
- AC4: Given the switch removed, then the dashboard answers basic auth and the probes and `/api/rawdata` equal `main`'s.
- AC5: Given the new component, then its image is pinned by digest and its licence, advisories, storage, footprint and placement status are recorded; its configuration names no provider and derives its client per AD-3; the test holds each setting.
- AC6: Given Story 5.5's three findings, then each is closed with evidence produced here.
- AC7: The typecheck and the full root suite pass; `cs-tracker`'s `mix precommit` passes; the adoption probe exits 0.
- AC8 (Operator-pending): FA1 to FA5 run on the box and a person signs in to the dashboard through the tunnel, the cookie host-only and basic credentials refused.
- AC9 (Operator-pending, ruling): FA6 (DW-329), and FA7 if the issuer refuses the loopback redirect URI.

## Design Notes

The switch is inert because Traefik's environment is fixed at container creation: a deploy resetting `routes.yml` re-renders it with the variable unset, so the same configuration loads; only FA4 (env line plus `up -d ingress`) changes it, at a measured cost of under a second of refused connections. A gitignored file dropped into `dynamic/` would switch without a restart but leaves the box's routing in an untracked file; rejected.

## Verification

**Commands:**
- `corepack pnpm typecheck`, `corepack pnpm test --run`; `cs-tracker`: `mix precommit`; `node ops/cs-tracker-adoption-probe.mjs`.
- The rehearsal block in `ops/identity-issuer.md` § Rehearsed off the box.

## Implementation Notes

- Order, stated plainly: an unattended builder with no subagent tool. Story 5.5's three findings were closed first (`b54e310`, `48e6cfc`, `3534a14` here; `faaa642` on `cs-tracker`'s `dev`). For 5.6 the design was prototyped and rehearsed before this spec was written, then the spec was written from what the rehearsal proved; every result below is from the final tree. Spec about 1531 tokens (6122 characters before § Implementation Notes, at 4 per token), under 1600, so no Split or Keep question arose; Checkpoint 1 answered Approve, no open question remained.
- Surfaces: the dashboard is the only one on the box with no authentication of its own (`ops/identity-issuer.md` lists the rest and what authenticates each). Kept loopback-only: a public hostname is FA7's ruling, not this story's.
- Component: oauth2-proxy v7.15.5 (MIT, index digest pinned, OSV clean at 2026-10-02T20:12:23Z), cookie session store, so it stores nothing server-side; not a Capacity Gate placement (infrastructure, as Umami and Postgres). Client `traefik`, derived from the stack's compose name since it has no Registry id; kept out of § The clients, whose test requires Registry ids.
- Rehearsal (2026-10-02T20:45:30Z to 20:46:50Z, traefik:v3.7.13, the stand-in issuer): A against B identical, probes and `/api/rawdata` byte for byte; switched on, unauthenticated 302 to the issuer with `S256`, the Owner's callback set `__Host-traefik-dashboard` (`Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax`, no `Domain`) and the dashboard answered 200; basic credentials alone 302, forged identity headers 302, `demo@cuatro.dev` 403 at the callback, sign-out then 302; every application line identical to A; switched off again, identical to A. The recreate: 7 of 200 requests at 50 ms spacing got no answer. Footprint 0.00% CPU, 6.2 MiB. The record's re-run block, as written, ran end to end under `bash -e` (20:44:20Z to 20:45:06Z after the last change to the stand-in): `callback 302`, `dashboard 200`, nothing left behind.
- Today's box env (no new names): `docker compose config` exit 0 with and without the profile; `up -d --wait` started the ingress alone, dashboard 401 and 200, no forward-auth router, middleware or service.
- Tests: `traefik-config.test.ts` 26 to 32 cases. Mutants, each failing at least one case: an application router naming the gate; the middleware block made unconditional; the switch value changed; a cookie domain; the profile removed; an email domain instead of the Owner's address. `cs-tracker`: the callback's kill-switch case fails with `:callback` dropped from the plug.
- Suites on the final tree: typecheck exit 0. Full root suite: 1898 passed, 1 skipped, 1 todo, 9 failed, all in the six WSL-bash suites with empty output (DW-135); each of the six then passed alone (28, 59, 20 and 1 skipped, 17, 15, 11). An earlier full run on this change, before the record's last edits, had those six green and failed only the credential grep fixed below. `cs-tracker` `mix precommit` (Elixir 1.19.5, OTP 28 native, scratch Postgres 18) exit 0, 723 tests, 0 failures, 4 excluded, tree unchanged by `format`. Adoption probe 19 of 19, exit 0 (2026-10-02T20:39:50Z). No Hub source changed, so no Hub build or browser suite was due.

## Spec Change Log

- Fix round 1 (2026-10-02), after the independent verifier refused round 1 on AC5 ("the test holds each setting"): five security mutants passed all 32 cases. The test now holds the forward-auth service's whole environment as an exact map, its top-level keys as an exact list (so no `command:` or `entrypoint:` can pass flags), and the `dashboard-forward-auth` middleware as an exact block. The service also sends and checks a nonce now (`OAUTH2_PROXY_INSECURE_OIDC_SKIP_NONCE: 'false'`), the verifier's first minor finding; the record states the forged-state outcomes, its second. AC5's wording is unchanged: the fix makes the test meet it.
- Fix round 1 evidence, this session. `traefik-config.test.ts`: 32 cases pass. Mutants, each run against the file and each failing 1 case (`Tests 1 failed | 31 passed`): `WHITELIST_DOMAINS` set to `'*'`; added `INSECURE_OIDC_ALLOW_UNVERIFIED_EMAIL: 'true'`; added `SKIP_AUTH_ROUTES: '.*'`; added `SKIP_JWT_BEARER_TOKENS: 'true'`; added `trustForwardHeader: true` on the middleware; `SKIP_NONCE` set to `'true'`; `SKIP_NONCE` removed; an added `command: ['--skip-auth-route=.*']`; an added `authResponseHeaders` on the middleware. Rehearsal in traefik:v3.7.13 with the stand-in issuer, 2026-10-02 between 21:22:53Z and 21:25:41Z (two runs): A against B and A against D identical byte for byte, A against C identical on every application line; the authorize URL carries `S256`, `nonce` and `state`; the Owner's callback 302 and dashboard 200; replayed callback 403; a well-formed forged state 403 and an unparseable one 500, neither setting a session; `demo@cuatro.dev` 403; an issuer omitting the nonce 403 (oauth2-proxy logged the nonce mismatch).

## Review Triage Log

Review layers run inline by the builder (no subagent tool); the independent verifier is the context-free pass. Ponytail, the ECC verification loop and self-evaluation applied inline, not invoked as skills. Design review skipped: no `.scss`, no `.tsx`, no motion.

- high, patched: a comment holding template braces made Traefik refuse the whole routing file (`template: :93: missing value for if`, every hostname 404 in the first rehearsal). Comments now hold none, and a case refuses braces in any comment line.
- medium, patched: the record's rehearsal block wrote a literal `OIDC_ISSUER` value, failing the repository's credential grep; it is interpolated now.
- medium, patched: the block's scratch removal used a path built through `cd`, which resolves to the working directory if `mktemp` fails; it removes `mktemp`'s own path now. Its curl calls wrote to `/dev/null`, which Git Bash's curl cannot open under `MSYS_NO_PATHCONV` (exit 23); they write to a scratch file.
- low, patched (Ponytail): the stand-in's unused userinfo endpoint removed.
- low, rejected: `OAUTH2_PROXY_REVERSE_PROXY` with no trusted proxy list accepts `X-Forwarded-*` from any container on `cs-tracker_default`. Those headers steer only the post-sign-in redirect, which `WHITELIST_DOMAINS` bounds to `localhost:8080`, no trusted-IP bypass is configured, and forged identity headers through Traefik were refused (302).
- low, rejected: oauth2-proxy adds `approval_prompt=force` to the authorization request; an OpenID provider ignores a parameter it does not know (OIDC Core § 3.1.2.1).
- low, deferred: DW-329 (the pin's shelf life, FA6) and DW-330 (no sign-out but its own reaches the dashboard's session).
- false: the box's `.env` lacks the new names, so compose might refuse the file at the next by-hand command. Checked with an env file holding only today's two names: `config` and `up -d` succeed.

## Independent verification

- Round 1 (2026-10-02, tree `e7f4476`, cs-tracker `faaa642`): **refused**, nothing pushed. Its own rehearsal, gates, cs-tracker suite in the OTP 28 image and eight-probe image comparison all passed, and it met AC1 to AC4, AC6 and AC7. One major finding: AC5 unmet, because the test held a chosen subset of oauth2-proxy's settings, so five security mutants (`WHITELIST_DOMAINS '*'`, added `INSECURE_OIDC_ALLOW_UNVERIFIED_EMAIL`, `SKIP_AUTH_ROUTES`, `SKIP_JWT_BEARER_TOKENS`, and `trustForwardHeader` on the middleware) passed all 32 cases. Two minor: no nonce (oauth2-proxy's default), and the record silent on a forged state's 500. All three are addressed in fix round 1 (§ Spec Change Log).
- Round 2: not run yet.
