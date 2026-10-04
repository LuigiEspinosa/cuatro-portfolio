# Epic 5 Context: One login, and a Visitor who can use the real thing

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The Operator signs in once across his own tools, one identity demonstrably crosses the
JavaScript/Elixir boundary (the Hub and `cs-tracker`), and a Visitor uses real software through a
shared demo account without registering. Identity was sequenced behind the host rebuild (Epic 4,
done 2026-10-01), so the box this epic builds on is the Traefik ingress and the estate Postgres.

## Stories

- Story 5.1: Refresh Clerk's pricing and terms
- Story 5.2: One Clerk issuer and one OIDC client per application
- Story 5.3: The Hub authenticates over OIDC Authorization Code + PKCE
- Story 5.4: `cs-tracker` authenticates, the JavaScript/Elixir boundary
- Story 5.5: Sign-out reaches every session, including open LiveView sockets
- Story 5.6: ForwardAuth gates the surfaces with no authentication of their own
- Story 5.7: Provider replaceability is evidenced, not asserted
- Story 5.8: The demo principal contract
- Story 5.9: `demo:reset` and a baseline fixture, per application
- Story 5.10: One host-level reset scheduler for the estate
- Story 5.11: Demo and identity declarations verified against reality

## Requirements & Constraints

- One identity across the Operator's applications; the Hub and `cs-tracker` pairing is the
  demonstration of the polyglot claim and is observed by a person, not inferred from configuration.
- Sign-out reaches every session, including a LiveView socket already open at sign-out time.
- Replacing the identity provider is a configuration change: no application holds provider-specific
  logic beyond issuer configuration and client credentials.
- Every Registry entry declares `identity` as exactly one of `oidc`, `wallet`, `none`; `MaiCoin` is
  `wallet` and structurally exempt.
- Demo access: a Visitor uses a real application without registering; demo state is bounded and
  self-recovering; Demo Access is declared per entry and degrades honestly under capacity pressure.
- Cost: all-in spend stays within $100 a month (the top of NFR-4's $40 to $100 band), and only
  marginal spend counts because the box is prepaid to 2028-07-19. Any new recurring charge,
  identity included, is a named decision recorded against that ceiling, never an incidental
  subscription. A decision that is the Operator's is recorded as pending his ruling.
- Credentials live in GitHub Actions secrets and the on-box env file, never in a repository;
  `.env.example` documents every required variable. No Clerk, OIDC or issuer variable exists yet.

## Technical Decisions

- OIDC Authorization Code + PKCE per application against one Clerk issuer; client ids derive
  mechanically from the application id.
- Each application mints its own host-only `__Host-` session. No `Domain=.cuatro.dev` cookie exists
  anywhere in the estate.
- Logout is RP-Initiated plus Back-Channel; `cs-tracker` additionally broadcasts on `live_socket_id`.
  `oidcc` 3.8.0 is the Elixir client.
- Traefik ForwardAuth gates only surfaces with no authentication of their own (the Traefik dashboard,
  admin surfaces) and is never an application's identity path.
- Demo principal `demo@cuatro.dev` in every application, owning every demo row, undeletable and with
  credentials unchangeable from inside the application. Each application exposes an idempotent
  `demo:reset` (delete by owner, reseed a committed baseline fixture). One host-level scheduler,
  outside the containers, hourly by default with per-application override.
- Migrations are a discrete step before the rollout and backward-compatible with the version still
  serving; never on container boot.
- Settled inputs have a shelf life: Clerk pricing is on the bounded refresh list, and nothing outside
  that list re-opens because time passed.

## Cross-Story Dependencies

- 5.1 has no dependency; 5.2 depends on it. 5.3 on 5.2; 5.4 on 5.3; 5.5 and 5.7 on 5.4; 5.6 on 5.2
  and Story 4.2 (Traefik); 5.8 on 5.3; 5.9 on 5.8; 5.10 on 5.9; 5.11 on 5.9 and Story 2.23.
- Demo Access is additionally gated by the Capacity Gate (AD-9).
- `cs-tracker` lives in its own repository with no CI; its half of 5.4 and 5.5 is a two-repository
  change.
