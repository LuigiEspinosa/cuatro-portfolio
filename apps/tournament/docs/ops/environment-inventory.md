# InclusivCup — Environment Inventory (single environment, v1)

> **Provisioned by Story 1.1.** One low-cost footprint; **every secret server-side only** (AD-25).
> This committed file is a **template (placeholders + generic facts)**. Account-specific refs live in
> the gitignored `environment-inventory.local.md`; credentials belong only in provider env vars +
> the gitignored `.env.local` (the canonical stores — the repo itself never holds a real value).
> **Never commit real secret values.** *(One-time exception logged: during provisioning the Railway
> CLI echoed 4 secret values into a local dev-session transcript; reviewed and accepted for this
> private event — see Story 1.1 deviations. Values never reached the repo.)*

## Services (single env — no staging/prod split, AD-25/AD-26)

| Service | Purpose | Plan / tier | Key identifier (see `*.local.md`) |
| --- | --- | --- | --- |
| Supabase | Postgres + Auth + Realtime | Free | project ref `<…>`, region `<…>` |
| Vercel | Next.js 16 app host (Node 20.9+) | Hobby | project `inclusivcup`, scope `<…>` |
| Railway | Go 1.26 worker host | Hobby | project `inclusivcup`, service `worker` |
| Cloudflare R2 | Raw `.dem` object store (free egress) | Standard, pay-as-you-go | bucket `inclusivcup-demos`, account `<…>` |

## Secret model (AD-25)

- **Client-exposed (`NEXT_PUBLIC_`):** Supabase project URL + anon key **only**.
- **Server-only (never `NEXT_PUBLIC_`):** service-role key, R2 write creds, worker↔MatchZy shared
  secret, Steam config, (legacy) JWT secret.
- **Sessions:** signed with **asymmetric ES256**; verify via JWKS
  `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (no shared secret required).
- Variable names: see `/.env.example`. Real values: provider env vars + gitignored `.env.local`.

## Cost guards (input for Epic 7 · Story 7.2 — billing alerts)

| Service | Included / free | Expected | Ceiling / watch | Billing alert |
| --- | --- | --- | --- | --- |
| Supabase | Free: ~500 MB DB, ~1 GB storage, ~200 concurrent realtime; pauses after ~7 days idle | $0 | DB size, realtime conns | n/a (free) |
| Railway | Hobby: $5/mo incl. $5 usage | ~$5–10/mo | bills CPU/RAM; **~$20–30 ceiling for 24/7** | **set alert (7.2)** |
| Cloudflare R2 | 10 GB-month storage; egress free | ~pennies/mo | raw-demo storage growth | **set alert (7.2)** |
| Vercel | Hobby free | $0 | bandwidth / build minutes | n/a |

## DR posture (AD-25)

Raw demos in R2 are the **durable source of truth**; all derived DB state is re-derivable by
re-parse. Object-lock / delete-guard hardening is **Story 7.1** — do not treat derived DB state as
canonical.

## Notes

- Railway `worker` service is created but **Offline** (no deployment until Epic 3) → $0 until deployed.
- Steam config (`STEAM_API_KEY` / `STEAM_REALM` / `STEAM_RETURN_URL`) is **finalized in Story 2.1**
  (needs the deployed domain + a Steam Web API key).
