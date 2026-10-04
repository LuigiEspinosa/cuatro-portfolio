---
title: 'Story 5-3: The Hub authenticates over OIDC Authorization Code + PKCE'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: '3c572a989e6c7f99b243b08d330b40cecab8cbfc'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/identity-issuer.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** The Hub cannot authenticate. AD-11 requires OIDC Authorization Code + PKCE against one issuer, a host-only `__Host-` session the Hub mints itself, and no `Domain=.cuatro.dev` cookie anywhere in the estate. The Clerk issuer of Story 5.2 does not exist yet, and `main` may deploy before it does.

**Approach:** Three route handlers under `/auth` drive the flow from the issuer's discovery document alone, with `OIDC_ISSUER` and the Hub's two client variables as the only inputs. Proven against a stand-in issuer inside the test suite; the live sign-in against Clerk is Operator-pending. With any variable absent the routes answer 404 and the Hub is unchanged.

## Boundaries & Constraints

**Always:** discovery only (FR-23, Story 5.7): no provider name, path or claim in Hub code. Confidential client, `client_secret_basic`, PKCE `S256`, `state` and `nonce` every time. Every cookie the Hub sets is `__Host-`, `Secure`, `HttpOnly`, `Path=/`, no `Domain`. No credential value in a tracked file or in output.

**Never:** sign-out or logout (Story 5.5); a sign-in affordance in the rendered pages; flip the Registry's `identity` before a person observes the live sign-in (NFR-9); touch `cs-tracker`, the box, Clerk or GitHub settings.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unconfigured | any of the three variables empty or unset | `/auth/sign-in`, `/auth/callback`, `/auth/session` answer 404; every other route as today | none |
| Sign-in | `GET /auth/sign-in` | 302 to the discovered `authorization_endpoint` with `code`, client id, `https://cuatro.dev/auth/callback`, `openid email profile`, state, nonce, S256 challenge; sets the signed transaction cookie | discovery `issuer` differs from `OIDC_ISSUER`: 502, no cookie |
| Callback | matching state, valid code | code exchanged with the verifier; ID token verified (JWKS signature, `iss`, `aud`, `exp`, `nonce`); session cookie set; transaction cookie cleared; 302 to `/` | 400 and no session on: missing or forged transaction cookie, state mismatch, `error` parameter, `iss` parameter mismatch, token endpoint refusal, any ID token check failing |
| Session | `GET /auth/session` | 200 `{ sub, email }` for a valid session; 401 without one, or forged, or expired | `Cache-Control: no-store` |

</frozen-after-approval>

## Code Map

- `apps/hub/app/api/health/route.ts`: route handler precedent; tests beside it in `__tests__/`.
- `apps/hub/lib/registry.ts` `HUB_ORIGIN`: the one origin literal; the redirect URI derives from it.
- `jose` 6.2.2: in `pnpm-lock.yaml` already (finance's `better-auth`); the root manifest carries the Hub's dependencies.
- `ops/__tests__/identity-issuer.test.ts`: the no-value scan; tests set variables with `vi.stubEnv`, never `NAME: 'v'`.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `pnpm-lock.yaml`: `jose` exact `6.2.2` in `dependencies`.
- [x] `apps/hub/lib/oidc.ts`: configuration, discovery, signed cookies, session key derivation.
- [x] `apps/hub/app/auth/{sign-in,callback,session}/route.ts`: the three handlers.
- [x] `apps/hub/lib/__tests__/oidc.test.ts`: a stand-in issuer on loopback driving the matrix, every cookie's attributes, no provider string in the module or routes, no cookie `Domain` naming `cuatro.dev` in tracked code.
- [x] `docker-compose.yml`: map the three variables into `anchor-app`, defaulting empty.
- [x] `ops/identity-issuer.md`: the redirect URI; Operator actions to register it and to observe the live sign-in.
- [x] `deferred-work.md`: the Registry `identity` flip after the live observation.
- [x] `tests/e2e/hit-target-floor.pw.ts`, `tests/e2e/accessibility-floor.pw.ts`, `ops/hit-target-floor.md`: register the three routes, which both floors derive from `app/` and refused unregistered (Implementation Notes).

**Acceptance Criteria:**
- AC1: Given the three variables unset, when the suite calls each `/auth` route, then each answers 404; and when the Hub is built and started without them, every existing route answers as before and the rendered-output suite passes.
- AC2: Given the stand-in issuer, when the suite runs sign-in then callback then session, then the issuer receives a valid PKCE pair and Basic client authentication, and the session route returns the issuer's `sub`.
- AC3: Given each error row of the matrix, when the suite runs it, then the callback answers 400 and sets no session cookie.
- AC4: Given every `Set-Cookie` the Hub emits, when the suite inspects it, then it is `__Host-`, `Secure`, `HttpOnly`, `Path=/` and has no `Domain`; and no tracked code sets a cookie `Domain` of `cuatro.dev`.
- AC5: Given `apps/hub/lib/oidc.ts` and the `/auth` routes, when the suite reads them, then no provider name appears.
- AC6: Given the change, when typecheck, the full root suite and the Hub build run, then all pass.
- AC7 (Operator-pending): Given the issuer and the Hub's client exist with the redirect URI registered and the variables on the box, when a person signs in at `https://cuatro.dev/auth/sign-in`, then `/auth/session` shows their subject and the browser holds no cookie with a `Domain` of `cuatro.dev`. (Met 2026-10-04T03:51Z: the Operator signed in live, `/auth/session` showed a `sub`, and the only `.cuatro.dev` cookies were KV-10's two; Registry 1.9.0 declares `oidc`.)

## Design Notes

- `jose` over hand-rolled WebCrypto, which verifies a signature but not key selection, algorithm allow-listing or claims; already locked, so no new package enters the supply chain.
- Session: a signed cookie, eight hours, no server store (the Hub has no database), keyed by HKDF-SHA256 from the client secret, so no new secret exists.
- Dependency record (Constitution rule 19): `jose` 6.2.2, exact pin, MIT, zero dependencies, by the author of `openid-client`. The ladder: the platform (Node 24 `fetch`, `node:crypto`) does discovery, PKCE, HKDF and the token request, and those are written here; it does not do JWS key selection from a JWKS, algorithm allow-listing or claim validation, which is the security-critical part. `jose` 6.2.2 was already in `pnpm-lock.yaml` (finance's `better-auth`), so the lockfile gains an importer edge and no package. `openid-client` 6 was not taken: it adds `oauth4webapi` for a flow of three requests.
- The redirect URI derives from `HUB_ORIGIN` (`apps/hub/lib/registry.ts`), never from the request's Host header, so it cannot be steered; the cost is that a local `next dev` cannot complete a sign-in against the real issuer, which only the production client is registered for.
- Spec about 1550 tokens (6183 characters) at Checkpoint 1, under 1600: no Split or Keep question arose. Checkpoint 1 answered by the unattended builder: Approve and continue; no open question remained.

## Verification

**Commands:**
- `corepack pnpm vitest run apps/hub/lib/__tests__/oidc.test.ts ops/__tests__/identity-issuer.test.ts`: pass
- `corepack pnpm typecheck`, `corepack pnpm test --run`, `corepack pnpm --filter hub build`: pass
- The rendered-output suite in the Playwright container (AGENTS.md): pass, no baseline written

## Implementation Notes

- Implemented inline (no subagent tool in this run). New: `apps/hub/lib/oidc.ts`, `apps/hub/app/auth/{sign-in,callback,session}/route.ts`, `apps/hub/lib/__tests__/oidc.test.ts`. Changed: `package.json` and `pnpm-lock.yaml` (an importer edge for `jose` 6.2.2, no new package), `docker-compose.yml`, `ops/identity-issuer.md` (redirect URI, § The Hub's sign-in, actions H1 to H3), `deferred-work.md` (DW-322), the two browser floors and `ops/hit-target-floor.md`.
- The first full browser run (338 passed, 5 failed) caught the three routes unregistered in both floors, which derive every route from `app/`. They are now `AUTH_ROUTES` in `hit-target-floor.pw.ts` with a standing case (404, empty body, no `Set-Cookie`, the suite's Hub being unconfigured) and excluded from `accessibility-floor.pw.ts`'s surfaces. Re-run of both floors and `rendered-output.pw.ts` in `mcr.microsoft.com/playwright:v1.62.1-noble`: 51 passed, and no baseline file was written (`git status` clean under the snapshots). No rendered page changed, so Lighthouse's inputs did not change; it was not run here.
- Every security check was mutation-tested: disabling the nonce, state, `azp`, `iss`-parameter or discovery-issuer check, sending `plain` for the PKCE method, or dropping `Secure` each failed at least one case. The cookie-`Domain` scan failed on two planted intent-to-add probes (`{ domain: '.cuatro.dev' }` in a `.ts`, `Domain=cuatro.dev;` in a `.conf`) and passed once they were removed.
- Built Hub, unconfigured (`next build` exit 0, then `.next/standalone/apps/hub/server.js` with no OIDC variable, 2026-10-02T15:49:53Z): `/`, `/cv`, `/work`, `/celeste`, `/api/health` 200; `/projects` 301; `/cv/` 308; an unknown path 404; `/auth/sign-in`, `/auth/callback`, `/auth/session` 404.
- Built Hub, configured against a scratch loopback stand-in issuer (not committed): session 401 before; sign-in 302 to the stand-in with `__Host-hub-oidc` (`Max-Age=600; Secure; HttpOnly; SameSite=lax`, `Path=/`, no `Domain`); the stand-in saw valid Basic client authentication, a matching PKCE pair and `https://cuatro.dev/auth/callback`; callback 302 to `https://cuatro.dev/` with `__Host-hub-session` (`Max-Age=28800`, same attributes) and the transaction cleared; session 200 `no-store` with the stand-in's `sub`.
- Live estate, read-only, 2026-10-02 from 15:37:01Z to 15:37:06Z, unauthenticated `curl -L` of every Registry `live` hostname plus `tracker`, `library` and `analytics`: the only estate cookie set was `cs-tracker`'s `_cs_tracker_key` (`path=/; secure; HttpOnly; SameSite=Lax`, host-only); no response set a `Domain` attribute. Signed-in cookies were not observed (no credential); action H3 observes the Hub's.
- Tests: `oidc.test.ts` 21 passed; `identity-issuer.test.ts` 5 passed, 1 todo; `hit-target-floor.test.ts` 21 passed after hyphenating a story id the record's own scan refused. Typecheck exit 0. Final full root suite: 1865 passed, 1 skipped, 1 todo, 5 failed, all five in the DW-135 WSL suites; each of the six re-run alone passed in full (28, 59, 20 plus 1 skipped, 15, 11, 17). The run before it had only the record-scan failure, now fixed.

## Independent verification

**Round 1, 2026-10-02: pass, pushed.** A context-free verifier read the diff `origin/dev..7060916` against epics.md's acceptance intent and AD-11, and re-ran every stage itself. Typecheck exit 0. Full root suite: 77 files, 1870 passed, 1 skipped, 1 todo, no failure (the DW-135 WSL suites passed in this run). `corepack pnpm --filter hub build` exit 0, the three routes dynamic. The built `server.js` with no OIDC variable (2026-10-02T16:11:37Z): `/`, `/cv`, `/work`, `/celeste`, `/api/health` 200, `/projects` 301, `/cv/` 308, an unknown path 404, the three `/auth` routes 404, no `Set-Cookie` on any. The built `server.js` configured against the verifier's own scratch loopback issuer (ES256, not committed): session 401 before; sign-in 302 with `__Host-hub-oidc` (`Path=/`, `Secure`, `HttpOnly`, `SameSite=lax`, no `Domain`); the issuer logged valid Basic client authentication, a matching S256 pair and `https://cuatro.dev/auth/callback`; callback 302 to `https://cuatro.dev/` with `__Host-hub-session` and the transaction cleared; session 200 `no-store` with the issuer's `sub`; a forged session 401; a wrong state 400. The full browser suite in `mcr.microsoft.com/playwright:v1.62.1-noble`: 344 passed, the new hit-target case and `rendered-output.pw.ts` included, no baseline written. Mutation: disabling the nonce, state, `aud` or discovery-issuer check, sending `plain`, or dropping `Secure` each failed `oidc.test.ts`; a planted intent-to-add `{ domain: '.cuatro.dev' }` failed the Domain scan, and a planted untracked JSON file assigning `CS_TRACKER_OIDC_CLIENT_ID` a value (colon straight after the closing quote) failed Story 5.2's no-value scan, each passing again once removed. Story 5.2's three findings are closed as the round 2 paragraph above them in spec-5-2 says. `cs-tracker` sets no cookie `Domain` in its tracked Elixir (read only). No dash or emoji in any added line; all three commits are subject only. AC1 to AC6 met; AC7 Operator-pending (H1 to H3). Two minor findings, neither blocking: removing `HS256`'s exclusion from `ID_TOKEN_ALGORITHMS` or the `purpose` audience in `unseal` fails no case, though each is backed by another layer (a JWKS holds no symmetric key; a session lacks the transaction's fields and a transaction lacks `sub`).

## Spec Change Log

- 2026-10-02, `43caa3b` (by Story 5.4's builder, before that story): round 1's two minor findings closed in
  `apps/hub/lib/__tests__/oidc.test.ts`, code unchanged. An ID token signed HS256 with the client secret is
  refused at the allow-list: the case pins the logged message, because `jose`'s remote JWKS refuses any HS*
  token by itself (`getKtyFromAlg`), so with `HS256` added to `ID_TOKEN_ALGORITHMS` the message becomes
  `Unsupported "alg" value for a JSON Web Key Set` and the case fails. Two tokens sealed with the Hub's key carry
  both purposes' fields, a transaction-sealed one with a `sub` presented as a session and a session-sealed
  one with the live state, nonce and verifier presented as a transaction; with `audience: purpose` removed
  from `unseal` they answer 200 and 302 and both cases fail. `oidc.test.ts` 24 passed; not yet independently
  verified.

## Review Triage Log

Review layers run inline by the builder, not as context-free subagents (no subagent tool in this run); the independent verifier is the context-free pass. Design review skipped: no `.scss`, no rendered `.tsx` and no motion in the diff. Ponytail: lean; the one exported constant only the test could use (`SCOPE`) stays because the module uses it.

- medium, patched: `fetch` to the issuer had no timeout, so a hung issuer held each `/auth` request open indefinitely. Discovery and the token request now abort after 10 s (`ISSUER_TIMEOUT_MS`); `jose`'s JWKS fetch has its own 5 s default.
- low, patched: no clock tolerance, so a box clock a second behind the issuer would refuse a fresh ID token on `nbf` or `iat`. `clockTolerance: 30`; the expired-token case (600 s past) still fails.
- low, patched: the issuer's `error` parameter, which an attacker controls, was logged raw, so a newline could forge a log line. Now logged through `JSON.stringify`.
- low, rejected: the callback cannot itself refuse a replayed code with a captured transaction cookie, being stateless; RFC 6749 § 4.1.2 makes the issuer refuse a second use of a code, the cookie is `HttpOnly` and cleared on first use, and a server store would be new state for a one-user Hub. The scratch end-to-end run below shows a lax issuer accepting the replay, which is the issuer's duty, not the Hub's.
- low, rejected: two tabs signing in at once overwrite one transaction cookie, so the first callback fails with a state mismatch and the person signs in again. Unlikely and harmless.
- false: the no-value scan of Story 5.2 would trip on the new code or compose lines. The routes read `process.env.NAME`, the tests use `vi.stubEnv('NAME', ...)` and compose uses `NAME=${NAME:-}`, none of which the pattern matches; the scan passes.
- false: the Hub's standalone build might not trace `jose`. The built `server.js` completed a full sign-in against a stand-in issuer (Implementation Notes).
