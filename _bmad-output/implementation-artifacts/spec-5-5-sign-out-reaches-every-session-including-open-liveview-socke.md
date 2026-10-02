---
title: 'Story 5-5: Sign-out reaches every session, including open LiveView sockets'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: '8de14df0d598a538c707f094c4a13036bb2aff7c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/ops/identity-issuer.md'
---

<frozen-after-approval reason="human-owned intent, do not modify unless human renegotiates">

## Intent

**Problem:** FR-22: after sign-out no application keeps serving the identity, an open LiveView socket included. AD-11 says RP-Initiated plus Back-Channel logout and a `live_socket_id` broadcast in `cs-tracker`. Neither application can sign out, `cs-tracker`'s session never expires (DW-327), and a live Clerk issuer advertises neither logout mechanism (DW-319, an Operator ruling).

**Approach:** Provider-neutral, holding whichever way DW-319 is ruled: each application's own sign-out ends every session of the subject in that application and follows `end_session_endpoint` when discovery advertises one; each receives Back-Channel logout tokens validated per the specification; `cs-tracker` broadcasts `disconnect` on the subject's `live_socket_id`. Proven against a stand-in issuer advertising both, an already-open socket held in the suite.

## Boundaries & Constraints

**Always:** discovery only, no provider name (FR-23). Unconfigured, both applications answer exactly as today. Revocation fails closed: a session minted before the process started is refused. Work in `cs-tracker-dev` on `dev`.

**Never:** rule on DW-319; `revocation_endpoint` (ruling option (a)); a sign-out affordance in pages; the box, the issuer, GitHub settings or any `.env.*` file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unconfigured | any value empty | `/auth/sign-out`, `/auth/backchannel-logout` answer 404: in `cs-tracker` as an unrouted path; in the Hub with an empty body, as its 5.3 routes, where an unrouted path answers the 404 page | none |
| Own sign-out | `GET /auth/sign-out` | the subject's sessions revoked, cookie cleared, its sockets disconnected; 302 to `end_session_endpoint` (`client_id`, `post_logout_redirect_uri`) when advertised, else local only | `Sec-Fetch-Site` cross-site or same-site, or a prefetch: 403, nothing revoked |
| Back-channel | `POST logout_token` | 200 `no-store`; sessions matching `sid` or `sub` revoked; sockets disconnected | 400 `no-store`, nothing revoked: not a signed JWS, key outside the JWKS, symmetric or `none` alg, `iss`, `aud`, `iat` missing or over 5 minutes old, `exp` missing or past, `events` without the back-channel member, a `nonce`, neither `sub` nor `sid`, no `jti`, a replayed `jti` |
| Lifetime | `cs-tracker` session 8 hours old | refused, as the Hub's | none |

</frozen-after-approval>

## Code Map

- Hub `apps/hub/lib/oidc.ts` (`discover`, `unseal`, `readSession`), `app/auth/*/route.ts`, `lib/__tests__/oidc.test.ts` (stand-in issuer).
- `tests/e2e/hit-target-floor.pw.ts` `AUTH_ROUTES`, `accessibility-floor.pw.ts` `NON_HUB_ROUTES`: both refuse an unregistered route.
- `cs-tracker` `lib/cs_tracker/auth/oidc.ex` (`client_context/1` holds the pins), `oidc_controller.ex`, `router.ex`, `plugs/require_owner.ex` and `live_assigns.ex` (must agree), `auth/nonce_store.ex` (the ETS GenServer pattern), `application.ex`.
- `oidcc` 3.8.0: `:oidcc_logout.initiate_url/3`, `:oidcc_jwt_util.verify_signature/3`. `Oidcc.Token.validate_jwt/3` requires `sub`, so it cannot take a `sid`-only logout token.
- `mint_web_socket` (locked) drives a real socket against the endpoint under Bandit.

## Tasks & Acceptance

**Execution:**
- [x] `apps/hub/lib/oidc.ts`, `apps/hub/app/auth/{sign-out,backchannel-logout}/route.ts`, `oidc.test.ts`: sign-out, receiver, revocation, the matrix.
- [x] the two floors, `ops/hit-target-floor.md`: register both routes.
- [x] `cs-tracker` `auth/revocations.ex`, `application.ex`, `oidc.ex`, `oidc_controller.ex`, `router.ex`, the two gates, tests, `docs/deployment.md`.
- [x] `ops/identity-issuer.md` § Sign-out (Story 5.5) and actions; `deferred-work.md` DW-327 closed, consequences filed.

**Acceptance Criteria:**
- AC1: Given either application unconfigured, then the matrix's first row holds in its suite and the Hub's floor, and every earlier unconfigured case passes unchanged.
- AC2: Given the stand-in issuer, when the Hub's sign-out runs, then the old cookie reads 401, the cleared cookie is `__Host-` with no `Domain`, and the redirect is RP-Initiated when advertised and local when not; a sign-in after it works.
- AC3: Given an already-open LiveView socket over a real WebSocket, when `cs-tracker`'s own sign-out runs in another session of the subject, then the socket closes and its rejoin is redirected to sign-in.
- AC4: Given each back-channel row, then each application answers it in its suite: on success the matching sessions read 401; on each refusal 400 and the session still reads 200.
- AC5: Given an already-open LiveView socket, when a valid logout token reaches `cs-tracker`, then the socket closes and its rejoin is redirected (FR-22's case).
- AC6: Given a `cs-tracker` OIDC session older than 8 hours, or minted before the process started, then both gates refuse it; the Hub refuses one minted before its process started.
- AC7: Given the new modules and routes, then no provider is named and no cookie `Domain` is set.
- AC8: `mix precommit`, typecheck, the full root suite and both floors pass; the built Hub answers unconfigured as before; the adoption probe exits 0.
- AC9 (Operator-pending): the post-logout and back-channel URIs registered as far as the issuer allows, both rolled, and a person sees an open `cs-tracker` tab leave on sign-out.
- AC10 (Operator-pending, ruling): DW-319 ruled; until then, on an issuer advertising neither, sign-out reaches only the application signed out of.

## Design Notes

- Revocation is in process memory (`globalThis` in the Hub, ETS in `cs-tracker`), keyed `sub` and `sid`, kept one session lifetime. A restart forgets it, so a process refuses every session minted before it started: one sign-in after each rollout, never a revoked session revived.
- Own sign-out revokes by subject (every device): FR-22 says every session.
- `GET`, as sign-in is; Fetch Metadata refuses a cross-site or prefetched one.

## Verification

**Commands:**
- `cs-tracker`: `mix precommit`.
- `cuatro-portfolio`: `corepack pnpm typecheck`, `corepack pnpm test --run`, `corepack pnpm --filter hub build`, the two floors in the Playwright container, `node ops/cs-tracker-adoption-probe.mjs`.

## Implementation Notes

- Order: an unattended builder with no subagent tool planned, implemented and reviewed inline. Spec about 1591 tokens (6364 characters before § Verification, at 4 per token) at Checkpoint 1, under 1600, so no Split or Keep question arose; Checkpoint 1 answered Approve and continue, no open question remained. DW-319 was not ruled; AC10 waits on it.
- `cuatro-portfolio`: `apps/hub/lib/oidc.ts` (revocations on `globalThis` under `Symbol.for`, `signOut`, `backchannelLogout`, the ID token's `sid` kept in the session), `apps/hub/app/auth/sign-out/route.ts`, `apps/hub/app/auth/backchannel-logout/route.ts`, `oidc.test.ts` (24 to 52 cases), both floors and `ops/hit-target-floor.md`, `ops/identity-issuer.md` § Sign-out (S1 to S5), `deferred-work.md` (DW-319 amended, DW-327 closed, DW-328 filed).
- `cs-tracker` on `dev`, worktree `cs-tracker-dev`: `0bcce94` (code and tests), `0a89392` (`docs/deployment.md`). New `CsTracker.Auth.Revocations` (ETS, epoch, `jti`); `OIDC.signed_in?/1` is the one session check the HTTP gate, the live gate and `/auth/session` share; the callback writes `oidc_iat`, `oidc_sid` and `live_socket_id` (`oidc_sessions:<sub>`); `GET /auth/sign-out` and `POST /auth/backchannel-logout` (outside `:browser`, behind `:oidc_configured`); the Steam `DELETE /auth/sign_out` also ends an OIDC session's every session (review finding below).
- The open-socket cases serve the endpoint with Bandit on a loopback port and drive a real WebSocket with `Mint.WebSocket`: the dead render's CSRF token and cookie on the upgrade, `phx_join` with the page's session and static tokens, then the sign-out, then the server's close, then a rejoin with the same page and cookie, which is answered with a redirect to `/auth/sign-in`. A refused logout token leaves the socket open (500 ms with no frame).
- Mutation, Hub (`oidc.test.ts`): 28 mutants, every one failing at least one case: revocation check off, epoch off, `<=` made `<`, `sid` unread or unstored, sign-out revoking nothing, no `post_logout_redirect_uri`, no `end_session_endpoint` follow, `iss`, `aud`, HS256 allowed, `maxTokenAge`, required claims, `exp` not required, the events check (off, any value), nonce, sub-or-sid, the `jti` check (survived until the empty-`jti` case was added), replay, back-channel revoking nothing, Fetch Metadata (off, `same-site` allowed, prefetch), the cookie kept, the unconfigured 404, `no-store`.
- Mutation, `cs-tracker` (the OIDC file): 31 mutants, every one failing at least one case, including the broadcast removed and `live_socket_id` unwritten (each fails the open-socket cases: the socket stays open), revocation off, each gate reading only the subject, lifetime off, epoch off, every claim check, replay, HS256, Fetch Metadata, kill switch, `end_session_endpoint`, the cookie kept, the `sid`-only topic, the Steam sign-out's call. The HTTP gate reading only the subject survived the first run (the live gate also refused the dead render); a direct call of the plug now kills it.
- Built Hub (`next build` exit 0, `.next/standalone/apps/hub/server.js`, scratch loopback stand-in, not committed, 2026-10-02T19:13:30Z). Unconfigured: `/`, `/cv`, `/work`, `/celeste`, `/api/health` 200, `/projects` 301, an unknown path 404, and `/auth/sign-in`, `/auth/callback`, `/auth/session`, `/auth/sign-out`, `GET` and `POST /auth/backchannel-logout` 404 with an empty body, no `Set-Cookie` on any; the same statuses 5.3 recorded, not a comparison with another build. Configured: two sessions 200; sign-out 302 to the stand-in's `end_session_endpoint` with `client_id` and `post_logout_redirect_uri=https://cuatro.dev/`, cookie cleared (`Max-Age=0; Secure; HttpOnly; SameSite=lax`, `Path=/`, no `Domain`); both sessions then 401, so the revocations are shared across the built route bundles; a cross-site sign-out 403; a fresh session 200, a `sid` logout token 200 `no-store`, that session 401, the replay 400.
- Suites: `mix precommit` (Elixir 1.19.5, OTP 26, native, scratch Postgres 18 on loopback) exit 0, 722 tests, 0 failures, 4 excluded (687 at `a011f93`). One `Postgrex.Protocol ... disconnected` error line appears in both runs, also at `a011f93`, so it predates this story. Root: typecheck exit 0; 77 files, 1901 passed, 1 skipped, 1 todo. The full browser suite in `mcr.microsoft.com/playwright:v1.62.1-noble`: 344 passed, the floors' five-route case included, no baseline written. Adoption probe 19 of 19, exit 0 (2026-10-02T19:24:19Z). Not run: the OTP 28 builder image, and `cs-tracker`'s production image, so no claim is made that its release answers as `main`'s does; the unconfigured cases compare each new route with an unrouted path inside the suite.

## Independent verification

**Round 1, 2026-10-02: pass, pushed.** A context-free verifier read the diff `origin/dev..3c1f5cf` here and `origin/dev..0a89392` on `cs-tracker`'s `dev` against epics.md's acceptance intent for 5.5 and AD-11, and re-ran every stage itself.

- AC1 to AC10 as written honour the intent: RP-Initiated and Back-Channel logout in each application, the `live_socket_id` broadcast, and an already-open socket proven to close. The only narrowing (what sign-out reaches on an issuer advertising neither mechanism) is forced by the issuer, stated plainly in `ops/identity-issuer.md` § Sign-out, and left to action 11 with options and a recommendation. AC9 and AC10 are Operator-pending.
- Stages: typecheck exit 0. Full root suite 77 files, 1901 passed, 1 skipped, 1 todo, no DW-135 failure in that run. `corepack pnpm --filter hub build` exit 0, both new routes dynamic. Full browser suite in `mcr.microsoft.com/playwright:v1.62.1-noble`: 344 passed, the floors' unconfigured `/auth` case and `rendered-output.pw.ts` included, the tree unchanged afterwards. Adoption probe 19 of 19, exit 0 (2026-10-02T19:44:17Z). `cs-tracker`: `mix precommit` (Elixir 1.19.5, OTP 26, a scratch Postgres 18 on loopback) exit 0, 722 tests, 0 failures, 4 excluded, tree unchanged by `format`.
- Built Hub, unconfigured (2026-10-02T19:36:14Z): `/`, `/cv`, `/work`, `/celeste`, `/api/health` 200, `/projects` 301, an unknown path 404; `/auth/sign-in`, `/auth/callback`, `/auth/session`, `/auth/sign-out`, and `GET` and `POST /auth/backchannel-logout` 404 with an empty body; no `Set-Cookie` on any.
- Built Hub, configured against the verifier's own scratch loopback issuer (ES256, not committed, 2026-10-02T19:36:03Z): two sessions 200; a cross-site sign-out 403 with no cookie, both still 200; sign-out 302 to the issuer's `end_session_endpoint` with `client_id` and `post_logout_redirect_uri=https://cuatro.dev/`, `no-store`, the cookie cleared as `__Host-hub-session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax` with no `Domain`; both sessions then 401, so revocations are shared across the built route bundles; two fresh sessions 200; a `sid`-only logout token 200 `no-store`, that session 401 and the other 200; the replay 400; a token carrying a `nonce` 400 with the session still 200.
- Mutation, run by the verifier: 17 Hub mutants (the revocation check, `<=` made `<`, the epoch, nonce, events, replay, `maxTokenAge`, `exp` required, `aud`, sign-out revoking nothing, `sid` unstored, back-channel revoking nothing, sub-or-sid, prefetch, `same-site` allowed, the cookie kept, the unconfigured 404) and 21 `cs-tracker` mutants (the broadcast removed, `live_socket_id` unwritten, revocation off, lifetime off, epoch off, `<=` made `<`, nonce, events, `iss`, `aud`, `iat` window, `exp`, empty `jti`, replay, HS256 allowed, prefetch, own sign-out revoking nothing, the session kept, the Steam sign-out's call, each gate reading only the subject). Every one failed at least one case; the broadcast and `live_socket_id` mutants fail the real-WebSocket cases.
- Minor findings, none blocking. (1) On the Hub the two new routes answer an unconfigured request 404 with an empty body, Story 5.3's shape, while an unrouted path answers the 404 page; the matrix's "as an unrouted path" holds literally only in `cs-tracker`. (2) `cs-tracker` answers a back-channel logout 503 under its kill switch, so a logout sent then is lost for up to 8 hours; `ops/identity-issuer.md` § Sign-out does not say so. (3) Not run here either: the OTP 28 builder image and `cs-tracker`'s production image, so the claim that its release answers as `main`'s does rests on the suite's unrouted-path comparison.
- No dash or emoji in any added line in either repository; all five commits are subject only; no `.env*` file touched.
- The root suite on the tree holding this record: 1898 passed, 1 skipped, 1 todo, and 3 cases failed after about 30 seconds with empty output in `deploy-remote`, `library-backup` and `postgres-backup` (DW-135); each file re-run alone passed (28, 59, and 20 with 1 skipped).

## Spec Change Log

- 2026-10-02, after round 1 (its minor finding 1): the matrix's unconfigured row said both new routes answer "as an unrouted path". That holds in `cs-tracker`; the Hub answers 404 with an empty body, where an unrouted path answers 404 with its 404 page. The row and `ops/identity-issuer.md` § Sign-out now say what each application does. No code changed.

## Review Triage Log

Review layers run inline by the builder (no subagent tool); the independent verifier is the context-free pass. Ponytail, the ECC verification loop and self-evaluation were applied inline, not invoked as skills. Design review skipped: no `.scss`, no rendered `.tsx`, no motion. Ponytail: lean; the revocation store is two maps and an epoch per application, no new dependency, and `oidcc`'s own logout URL and signature check are reused.

- medium, patched: the Steam `DELETE /auth/sign_out` dropped an OIDC session's cookie without revoking it or broadcasting, a second sign-out that reached neither the subject's other sessions nor its open sockets. It now calls the same `end_sessions/1`; a case signs out through it and reads another session 401, and fails with the call removed.
- low, patched: an empty `jti` passed the Hub's receiver once `jose`'s required-claims check was relied on alone; a case now refuses it.
- low, rejected: each back-channel POST, valid or not, fetches discovery (and the JWKS) from the issuer, as each sign-in does; one Owner, and the edge rate-limits, as Story 5.4 recorded for sign-in.
- low, rejected: a `sid`-only logout token disconnects every socket of the Owner, not only the named session's; the others reconnect and are admitted (a case holds that), so the cost is one reconnect.
- low, rejected: no `id_token_hint` is sent at RP-Initiated logout, so an issuer may ask the person to confirm; keeping the ID token would grow the Hub's cookie for a confirmation the specification permits. Recorded in `ops/identity-issuer.md`.
- low, deferred (DW-328): revocations are per process, so a second replica or a logout landing on the old container in a rollout's overlap can miss one; neither application runs a second replica.
- false: a session minted in the same second (Hub) or millisecond (`cs-tracker`) as a sign-out could survive it. The comparison is `iat <= revoked_at`, so it is refused; the `<` mutant fails cases in both suites.
