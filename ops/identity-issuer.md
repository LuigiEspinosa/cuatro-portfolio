# The identity issuer and its OIDC clients

The estate's one Clerk issuer, the one OIDC client each participating application holds, where every
credential lives, and what the issuer can do about logout. It is the artifact Story 5.2 delivers under
AD-11 and AD-3, on the plan Story 5.1 leaves to the Operator (`ops/clerk-pricing-and-terms.md` § Decision:
the plan the issuer runs on).

This file is a record, not Registry data. Every value is marked as a decision or an observation, and the
two are never presented as the same kind of fact (NFR-9). Times are UTC.

**Nothing here exists yet. Written 2026-10-02, committed on `dev`.** No Clerk account, issuer, OAuth
application, GitHub secret or env line was created by the authoring session, which had no account and
no credential. The Operator runs § The sequence and dates each Pending Operator action at the end. No
application authenticates in this story: the Hub's client is used by Story 5.3 and `cs-tracker`'s by
Story 5.4, and every Registry entry keeps `identity: none` until its own story makes it true.

## Contents

1. [The issuer](#the-issuer)
2. [The clients](#the-clients)
3. [Where each credential lives](#where-each-credential-lives)
4. [Logout, as far as it can be read today](#logout-as-far-as-it-can-be-read-today)
5. [The sequence](#the-sequence)
6. [Issuer run](#issuer-run)
7. [Pending Operator actions](#pending-operator-actions)
8. [The Hub's sign-in (Story 5.3)](#the-hubs-sign-in-story-53)
9. [cs-tracker's sign-in (Story 5.4)](#cs-trackers-sign-in-story-54)

## The issuer

**Decision (Story 5.2, 2026-10-02):** one Clerk application named `cuatro`, its **production** instance
on the domain **`id.cuatro.dev`**, on whichever plan the Operator rules for Story 5.1. By Clerk's
documented pattern (`https://clerk.<INSERT_YOUR_APP_DOMAIN>.com` "for a production environment", the
how-Clerk-implements-OAuth page) its Frontend API, and so its issuer, is `https://clerk.id.cuatro.dev`. The
issuer URL is configuration, not a credential, and is held in the variable `OIDC_ISSUER`. The real value
is whatever the instance's discovery document states as `issuer`, recorded by § The sequence step 6.

**Why `id.cuatro.dev` and not `cuatro.dev`.** Clerk's production deployment guide (read 2026-10-02T14:40Z,
`https://clerk.com/docs/guides/development/deployment/production.md`) says: "When you set a root domain
for your production deployment, Clerk's authentication will work across all subdomains. User sessions
will also be shared across the subdomains." Clerk's cookie guide (same time,
`https://clerk.com/docs/guides/how-clerk-works/cookies.md`) says Clerk sets cookies on sign-in and "This
cannot be disabled." With `cuatro.dev` as the root, Clerk's own cookies could be scoped to `.cuatro.dev`,
which AD-11 forbids anywhere in the estate. With `id.cuatro.dev` as the root, anything Clerk scopes to its
root reaches `*.id.cuatro.dev` only, where no application lives. This is a reading of two docs pages, not
an observation of Clerk's cookies: § The sequence step 7 observes them, and a cookie with `Domain=.cuatro.dev`
stops the sequence. The Operator may overrule the domain before step 4; nothing after step 4 depends on
its spelling except the issuer URL.

**The issuer's DNS records breach AD-26 as written.** AD-26: "Every live `cuatro.dev` hostname is proxied
by Cloudflare". Clerk's production guide says its Frontend API CNAME fails Clerk's check behind a proxy:
"Set the DNS record for this subdomain to a "DNS only" mode on your host to prevent proxying." So
`clerk.id.cuatro.dev`, and any other serving hostname the Domains page lists, would be a `cuatro.dev`
hostname outside the proxy, terminating TLS at Clerk, the same shape as KV-7's two Vercel hostnames. The
alternative Clerk documents is to proxy its Frontend API through a hostname of the estate's own ("If
you're unable to add a CNAME record for the Frontend API, you can use a proxy instead", the same guide),
which would put a Clerk route on the box's Traefik. **Which one is the Operator's ruling** (Pending
Operator action 9, before step 5); this record does not make it. Filed as DW-321.

**Plan.** No step below needs a feature the pricing page puts on Pro only (custom domain, unlimited
applications, passwords and PKCE are on every plan, `ops/clerk-pricing-and-terms.md` § What prices each
part of AD-11), so the sequence is the same on Hobby or Pro. Whether OAuth applications are plan-gated is
5.1's Pending Operator action 2, checked at step 8.

## The clients

One OAuth application on the issuer per participating application. FR-21 names the pair, the Hub
(`cuatro-portfolio`) and `cs-tracker`; further applications are optional and each is a new row here
(AD-3 applies to it the same way). `maicoin` is `wallet` (AD-12) and never has a row.

**Derivation (AD-3).** Each name below is derived from the Registry id, never chosen: the OAuth
application's **Name** is the id itself, and each variable is the id uppercased with hyphens as
underscores (the Postgres convention, `ops/postgres.md`), then `_OIDC_CLIENT_ID` or `_OIDC_CLIENT_SECRET`.
`ops/__tests__/identity-issuer.test.ts` holds this table to that rule and to `contracts/registry.json`.

| Application id | Clerk OAuth application name | Client ID variable | Client secret variable | GitHub repository holding the secrets | On-box env file | Redirect URI |
|---|---|---|---|---|---|---|
| `cuatro-portfolio` | `cuatro-portfolio` | `CUATRO_PORTFOLIO_OIDC_CLIENT_ID` | `CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET` | `LuigiEspinosa/cuatro-portfolio` | `/home/deploy/cuatro-portfolio/.env.production` | `https://cuatro.dev/auth/callback` (Story 5.3, § The Hub's sign-in) |
| `cs-tracker` | `cs-tracker` | `CS_TRACKER_OIDC_CLIENT_ID` | `CS_TRACKER_OIDC_CLIENT_SECRET` | `LuigiEspinosa/cs-tracker` | `/home/deploy/cs-tracker/.env` | `https://cs-tracker.cuatro.dev/auth/callback` (Story 5.4, § cs-tracker's sign-in) |

**The Client ID value is not derivable (observed 2026-10-02T14:38Z).** Clerk's SSO guide
(`https://clerk.com/docs/guides/configure/auth-strategies/oauth/single-sign-on.md`) has the Operator
complete "`Name` - Helps you identify your application." and then "save the **Client ID**", and its CLI
note says "the create response includes the Client ID and Client Secret": Clerk assigns the value. So
AD-3's "Clerk client `<id>`" holds on the application's Name and on every variable that carries the value,
and the value itself is Clerk's opaque string. Client ID Metadata Documents, which let "a public OAuth
client use an HTTPS metadata-document URL as its `client_id`" (how-Clerk-implements-OAuth page), are for
public clients and would put a URL, not the id, in the value; not used. Filed as DW-320 for a spine
wording ruling.

**Each client is confidential**: the Hub and `cs-tracker` both exchange the code on their server, so each
holds a secret, and each still sends PKCE (AD-11; "Require PKCE is enabled by default for newly created
Clerk instances", `ops/clerk-pricing-and-terms.md`).

## Where each credential lives

**Decision (Story 5.2).** One spelling per value everywhere: the GitHub Actions secret, the on-box env
line and this record use the same name. Values live in exactly three places and never in a tracked file:

1. The Operator's local gitignored `.env` at the repository root, where each value is first pasted (the
   client secret is shown once: "Clerk does not store your Client Secret and cannot show it to you
   again", the SSO guide).
2. GitHub Actions secrets in the application's own repository (the table's column), each with
   `OIDC_ISSUER` beside them. No workflow reads them today; they are the durable copy a rebuilt box or a
   later deploy step reads from.
3. The application's on-box env file (the table's column). The Hub's `.env.production` is interpolated by
   `docker-compose.yml` for four services, which is why every name carries its id. Story 5.3 maps the
   Hub's three into `anchor-app` (read at its next rollout); `cs-tracker`'s compose file hands its whole
   `.env` to the app (`env_file`), so its lines need no mapping (Story 5.4). Each application sees only
   issuer configuration and client credentials (FR-23), and `cs-tracker` one more value, its Owner's
   subject (§ cs-tracker's sign-in).

`ops/__tests__/identity-issuer.test.ts` fails if any file in the repository that git does not ignore
assigns one of the five names a value, in the env form `NAME=value` or the YAML form `NAME: value` (a
compose `environment:` map, a workflow `env:` block); a `$` interpolation such as `${{ secrets.NAME }}` is
not a value.

**`.env.example` does not document them yet.** The authoring session's permission settings deny every
read and write of `.env.*`, `.env.example` included, and that wall was not worked around. Pending Operator
action 8 appends this block to the end of `.env.example`, exactly:

```text

# Identity (Story 5.2): the one Clerk issuer and one OIDC client per application.
# Names derive from the Registry id (AD-3); values live only in GitHub Actions
# secrets and the on-box env files, never here. See ops/identity-issuer.md.
OIDC_ISSUER=
CUATRO_PORTFOLIO_OIDC_CLIENT_ID=
CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET=
CS_TRACKER_OIDC_CLIENT_ID=
CS_TRACKER_OIDC_CLIENT_SECRET=
```

and, in the same commit, replaces the `it.todo` in the test with the case its comment spells out, which
holds every name in § The clients to an empty line in `.env.example`.

## Logout, as far as it can be read today

DW-319 asks whether the issuer advertises the logout AD-11 requires (RP-Initiated, which needs an
`end_session_endpoint`, and Back-Channel, which needs `backchannel_logout_supported: true`). The estate's
issuer does not exist, so its own discovery document cannot be read. Two published documents can:

| Source | Retrieved (UTC) | `end_session_endpoint` | `backchannel_logout_supported` | `frontchannel_logout_supported` | `revocation_endpoint` |
|---|---|---|---|---|---|
| `https://clerk.clerk.com/.well-known/openid-configuration`, the issuer `https://clerk.clerk.com` (a live Clerk production instance, by the `clerk.<domain>` pattern the one for `clerk.com`), HTTP 200, 1,181 bytes (see the note below on its hash) | 2026-10-02T14:38:31Z | Absent | `false` | `false` | `https://clerk.clerk.com/oauth/token/revoke` |
| The sample "authorization server metadata" document on `https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth.md` | 2026-10-02T14:38:18Z | Absent | Absent | Absent | Absent |

The same live instance's `/.well-known/oauth-authorization-server` (2026-10-02T14:38:31Z, HTTP 200) also
names no `end_session_endpoint`.

The document's bytes vary between reads, so no hash pins it: three reads of 1,181 bytes each hashed
differently (sha256 prefixes `5c2a1997` at 14:38:31Z, `e5ad925d` at 14:55:58Z in the independent verifier's
read, `91342d62` at 15:04:33Z), and all three carried the same values in the four columns above. The fields,
not a hash, are the evidence; re-read them rather than compare a digest. No Clerk page read documents RP-Initiated or Back-Channel logout
(`ops/clerk-pricing-and-terms.md` § Found in passing, filed, and this story's reading of the two OAuth
guides above).

**What this means (derived).** A live Clerk issuer states plainly that it does not support Back-Channel
logout, and advertises no RP-Initiated endpoint. Unless the estate's instance differs, AD-11's "Logout
is RP-Initiated plus Back-Channel" cannot be met as written, and FR-22 needs another mechanism (for
example each application ending its own session and revoking its tokens at `revocation_endpoint`, with
`cs-tracker`'s `live_socket_id` broadcast unchanged). That is a spine decision, not this story's: DW-319
is amended to carry it to a ruling before Story 5.5.

**What stays unknown until the issuer exists.** The estate instance's own values for the four fields
above, and whether any plan or instance setting changes them. § The sequence step 6 reads and records
them; that reading, not this one, is what Story 5.5 builds on.

## The sequence

From the workstation in Git Bash, never PowerShell (AGENTS.md: piping from PowerShell appends CRLF), at the
repository root, unless a step says otherwise. No step prints a credential: every check reads names
only.

1. **Prerequisites.** `ops/clerk-pricing-and-terms.md` Pending Operator action 1 (the plan) is dated,
   and so is this record's action 9 (AD-26). Action 3 there (the terms' date) is done at step 2.
2. **Create the Clerk account** at `https://dashboard.clerk.com` with an email address the Operator reads
   (the terms' fee-change email is a "may", `ops/clerk-pricing-and-terms.md` § Terms, as published). Pick
   the plan ruled at step 1.
3. **Create the application** named `cuatro`. Sign-in: email address with password (the demo principal of
   Story 5.8 signs in with one). A social connection is optional (Hobby allows three).
4. **Create the production instance** on the domain `id.cuatro.dev`. If Clerk refuses a subdomain as the
   production domain, stop, record what the dashboard said here, and re-open § The issuer.
5. **Add the DNS records** the instance's Domains page lists, in Cloudflare, as Pending Operator action 9
   ruled: each **DNS only** if the ruling accepts the breach (Clerk's guide: a proxied record fails its
   CNAME check), and then the KV entry the ruling names is added to `ops/known-violations.md`; or as the
   Frontend API proxy setup the ruling names, which is its own runbook and stops this sequence until it
   exists. Record each record's name, type, target and proxy status in § Issuer run below, and add them
   to `ops/routing-inventory.md` as a dated revision, since AD-22's topology item covers every hostname's
   address, TLS terminator and proxy status.
6. **Read the discovery document** once the Domains page shows the records verified:
   `curl -sS https://clerk.id.cuatro.dev/.well-known/openid-configuration | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));for(const k of ['issuer','end_session_endpoint','backchannel_logout_supported','backchannel_logout_session_supported','frontchannel_logout_supported','revocation_endpoint','code_challenge_methods_supported'])console.log(k,JSON.stringify(j[k]))"`.
   Record the output and the UTC time in § Issuer run and in DW-319. The `issuer` value is `OIDC_ISSUER`.
7. **Observe Clerk's cookies.** In a fresh browser profile, sign in once at the instance's hosted sign-in
   page (Clerk's Account Portal), open the developer tools' cookie list, and record every
   cookie's name and Domain, never its value. **A cookie with `Domain=.cuatro.dev` or `Domain=cuatro.dev`
   stops the sequence** (AD-11): record it and re-open § The issuer.
8. **Create one OAuth application per row** of § The clients, on the instance's OAuth applications page:
   Name exactly the row's id, scopes `openid`, `profile` and `email`, confidential (not public), PKCE
   required. Leave Redirect URIs for Stories 5.3 and 5.4. Paste the secret, which Clerk shows once, and the
   Client ID into the local `.env` as the row's two variables, and `OIDC_ISSUER` once. Record whether the
   page showed an upgrade prompt (`ops/clerk-pricing-and-terms.md` Pending Operator action 2).
9. **Check the local `.env` by name**: `grep -cE '^(OIDC_ISSUER|CUATRO_PORTFOLIO_OIDC_CLIENT_(ID|SECRET)|CS_TRACKER_OIDC_CLIENT_(ID|SECRET))=.+' .env`
   prints `5`.
10. **Set the GitHub Actions secrets**, one repository at a time, through a temporary file that is
    removed after:
    ```bash
    t="$(mktemp)"
    grep -E '^(OIDC_ISSUER|CUATRO_PORTFOLIO_OIDC_CLIENT_(ID|SECRET))=' .env | tr -d '\r' > "$t"
    gh secret set -f "$t" --repo LuigiEspinosa/cuatro-portfolio
    grep -E '^(OIDC_ISSUER|CS_TRACKER_OIDC_CLIENT_(ID|SECRET))=' .env | tr -d '\r' > "$t"
    gh secret set -f "$t" --repo LuigiEspinosa/cs-tracker
    rm -f "$t"
    gh secret list --repo LuigiEspinosa/cuatro-portfolio | grep OIDC
    gh secret list --repo LuigiEspinosa/cs-tracker | grep OIDC
    ```
    The two lists show three names each, with today's date.
11. **Append the on-box env lines**, refusing to append twice and never echoing a value:
    ```bash
    grep -E '^(OIDC_ISSUER|CUATRO_PORTFOLIO_OIDC_CLIENT_(ID|SECRET))=' .env | tr -d '\r' \
      | ssh deploy@177.7.52.248 'f=/home/deploy/cuatro-portfolio/.env.production; ! grep -qE "^(OIDC_ISSUER|CUATRO_PORTFOLIO_OIDC_)" "$f" && { [ -z "$(tail -c1 "$f")" ] || echo >> "$f"; cat >> "$f"; }'
    grep -E '^(OIDC_ISSUER|CS_TRACKER_OIDC_CLIENT_(ID|SECRET))=' .env | tr -d '\r' \
      | ssh deploy@177.7.52.248 'f=/home/deploy/cs-tracker/.env; ! grep -qE "^(OIDC_ISSUER|CS_TRACKER_OIDC_)" "$f" && { [ -z "$(tail -c1 "$f")" ] || echo >> "$f"; cat >> "$f"; }'
    ssh deploy@177.7.52.248 'grep -cE "^(OIDC_ISSUER|CUATRO_PORTFOLIO_OIDC_CLIENT_(ID|SECRET))=.+" /home/deploy/cuatro-portfolio/.env.production; grep -cE "^(OIDC_ISSUER|CS_TRACKER_OIDC_CLIENT_(ID|SECRET))=.+" /home/deploy/cs-tracker/.env'
    ```
    The last command prints `3` twice. An `ssh` exit of 1 from the first two means the lines were already
    there; nothing was appended. No container is restarted here: the Hub reads its lines at its next
    rollout (§ The Hub's sign-in, action H2), and nothing reads `cs-tracker`'s until Story 5.4.
12. **Date the Pending Operator actions** below and write § Issuer run.

## Issuer run

_Not yet run._ Step 5's DNS records, step 6's discovery output, step 7's cookie list and step 8's prompt
observation are written here, each with its UTC time.

## Pending Operator actions

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| 1 | **Create the account, the application and the production instance on `id.cuatro.dev`** (§ The sequence steps 1 to 4) | After `ops/clerk-pricing-and-terms.md` actions 1 and 3 | _not done_ |
| 2 | **Add the instance's DNS records as action 9 ruled, and record them** here and in `ops/routing-inventory.md` (step 5) | Cloudflare | _not done_ |
| 3 | **Read and record the issuer's discovery document** (step 6), and amend DW-319 with it | Answers what § Logout leaves unknown | _not done_ |
| 4 | **Observe and record Clerk's cookie Domains** (step 7) | A `.cuatro.dev` cookie stops the sequence | _not done_ |
| 5 | **Create the two OAuth applications** (step 8) and record the plan-gate observation | Closes `ops/clerk-pricing-and-terms.md` action 2 | _not done_ |
| 6 | **Set the GitHub Actions secrets in both repositories** (steps 9 and 10) | Names only in the check | _not done_ |
| 7 | **Append the on-box env lines** (step 11) | Story 5.2 is done when every cell in this table is dated | _not done_ |
| 8 | **Document the five names in `.env.example`** and turn the test's `it.todo` into its case (§ Where each credential lives) | A repository change, not a box one; it falls to the Operator only because the authoring session could not open the file. Independent of actions 1 to 7. Run `corepack pnpm vitest run ops/__tests__/identity-issuer.test.ts` after | _not done_ |
| 9 | **Rule on AD-26 for the issuer's hostnames**, before action 2: accept them DNS only as a new known violation in the KV-7 shape, or proxy Clerk's Frontend API through the estate (§ The issuer) | Closes DW-321. The domain decision (`id.cuatro.dev`) may be overruled at the same time | _not done_ |
| 10 | **Rule on AD-3's "Clerk client `<id>`"** (§ The clients, DW-320). Options: (a) narrow AD-3 to the OAuth application's Name and the variables that carry its credentials, which is what this record already holds; (b) keep AD-3 as written and require an issuer that lets the client id be chosen, which rules Clerk out and re-opens Story 5.1; (c) use Client ID Metadata Documents, which apply to public clients only and would make both confidential clients public. **Recommendation: (a)**, a spine wording amendment, since the name and every variable are derived and tested and nothing reads the opaque value but configuration | Closes DW-320. Any time before Story 5.7 | _not done_ |
| 11 | **Rule on AD-11's logout rule** once action 3 has recorded the estate issuer's own values (§ Logout, DW-319). Options, if those values match `clerk.clerk.com`'s: (a) amend AD-11 so logout is each application ending its own session and revoking its tokens at `revocation_endpoint`, with `cs-tracker`'s `live_socket_id` broadcast unchanged, and FR-22 met by that; (b) keep "RP-Initiated plus Back-Channel" and change issuer, which re-opens Story 5.1; (c) proxy or front the issuer with a component of the estate's own that implements both, a new service on a CPU-bound box. **Recommendation: (a)**, because it needs no new component and the Hub's session is already its own (Story 5.3). If action 3 finds both supported, record that and close DW-319 with no amendment | Closes DW-319. Before Story 5.5 opens | _not done_ |

**Maintaining this file.** When an action is performed, replace its cell with the ISO 8601 UTC date and
leave the row in place. A new participating application adds a row to § The clients in the same change
that adds its secrets.

## The Hub's sign-in (Story 5.3)

**What exists (built 2026-10-02 on `dev`, proven against a stand-in issuer only).** The Hub is the
confidential client `cuatro-portfolio` above. `GET /auth/sign-in` reads the issuer's discovery document and
sends the browser to its `authorization_endpoint` with PKCE `S256`, `state` and `nonce`; `GET /auth/callback`
(the redirect URI) exchanges the code with `client_secret_basic` and the verifier, verifies the ID token
against the issuer's JWKS (`iss`, `aud`, `exp`, `nonce`, `azp`), and mints the Hub's own session;
`GET /auth/session` answers `{ sub, email }` for a session and 401 without one. Every cookie the Hub sets is
`__Host-hub-session` or `__Host-hub-oidc`: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, never a
`Domain`. The session lasts eight hours and is signed with a key derived from the client secret, so
rotating the secret ends every session. Code: `apps/hub/lib/oidc.ts` and `apps/hub/app/auth/`; tests:
`apps/hub/lib/__tests__/oidc.test.ts`. Nothing in them names a provider (FR-23).

**Unconfigured is the default.** With any of `OIDC_ISSUER`, `CUATRO_PORTFOLIO_OIDC_CLIENT_ID` or
`CUATRO_PORTFOLIO_OIDC_CLIENT_SECRET` empty, the three routes answer 404 and the Hub serves as before;
`docker-compose.yml` maps each into `anchor-app` defaulting empty. So `main` may deploy before the issuer
exists. No page links to sign-in: the routes are reached by URL.

**By hand, in order, after this record's actions 5 and 7:**

1. **H1. Register the redirect URI.** On the issuer's OAuth applications page, open `cuatro-portfolio` and
   add exactly `https://cuatro.dev/auth/callback` to its Redirect URIs. Nothing else on the client changes.
2. **H2. Roll the Hub onto the variables.** The Hub reads `.env.production` at its next rollout. If the
   lines from action 7 are on the box before Epic 5's merge to `main`, that deploy does it. Otherwise
   dispatch the Deploy on `main`: `gh workflow run deploy.yml --ref main --repo LuigiEspinosa/cuatro-portfolio`,
   then wait for it to finish green. Check, printing no value:
   `curl -s -o /dev/null -w '%{http_code}\n' https://cuatro.dev/auth/session` prints `401`. A `404` means the
   Hub still reads no configuration: check the three names with action 7's last command.
3. **H3. Observe the live sign-in.** In a fresh browser profile open `https://cuatro.dev/auth/sign-in`,
   sign in at the issuer, and confirm the browser lands on `https://cuatro.dev/`. Open
   `https://cuatro.dev/auth/session`: it shows a JSON `sub`. Then open the developer tools' cookie list for
   `cuatro.dev` and for the issuer's hostnames, and record each cookie's name and Domain, never its value.
   Expected: `__Host-hub-session` on `cuatro.dev` with no leading dot (host-only), and **no cookie with
   Domain `.cuatro.dev` or `cuatro.dev` set by any other hostname**; a cookie like that fails the story
   (AD-11). Write the result, with the UTC time, under § Hub sign-in run below.

### Hub sign-in run

_Not yet run._ H2's status code and H3's observations are written here, each with its UTC time.

### Pending Operator actions, Story 5.3

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| H1 | **Register `https://cuatro.dev/auth/callback`** on the `cuatro-portfolio` OAuth application | After action 5 | _not done_ |
| H2 | **Roll the Hub onto its three variables** and check `/auth/session` answers 401 | After action 7 and H1; a box change | _not done_ |
| H3 | **Sign in at `https://cuatro.dev/auth/sign-in` and record the session and every cookie's Domain** | Story 5.3 is done when this cell is dated with no `.cuatro.dev` cookie; then DW-322 flips the Registry's `identity` | _not done_ |

## cs-tracker's sign-in (Story 5.4)

**What exists (built 2026-10-02 on `cs-tracker`'s `dev` branch, proven against a stand-in issuer only).**
`cs-tracker` is the confidential client `cs-tracker` above, through `oidcc` 3.8.0, and nothing in it names a
provider (FR-23). `GET /auth/sign-in` reads the issuer's discovery document and sends the browser to its
`authorization_endpoint`; `GET /auth/callback` (the redirect URI) exchanges the code and admits only the
Owner's subject into `cs-tracker`'s own session; `GET /auth/session` answers `{ sub, email }` for that
session and 401 without one, the counterpart of the Hub's route, so a person can compare the two. The
request is pinned to what the Hub sends, whatever discovery offers: PKCE `S256` only, a plain query (no
request object, no PAR), `client_secret_basic`, `RS256`, `PS256`, `ES256` or `EdDSA` for the ID token, an
audience naming this client only, and no encrypted ID token. Steam's sign-in stays beside it (DW-326). Code:
`lib/cs_tracker/auth/oidc.ex`, `lib/cs_tracker_web/controllers/oidc_controller.ex`; tests:
`test/cs_tracker_web/controllers/oidc_controller_test.exs`, all in `LuigiEspinosa/cs-tracker`.

**Four values, all or none.** `OIDC_ISSUER`, `CS_TRACKER_OIDC_CLIENT_ID`, `CS_TRACKER_OIDC_CLIENT_SECRET`, and
`CS_TRACKER_OIDC_OWNER_SUB`, the Owner's subject at the issuer. The last is the allowlist, the OIDC
counterpart of `STEAM_ID`: `cs-tracker` holds one person's inventory, so a subject the issuer verifies is
still refused unless it is that one. It is an identifier, not a credential, and the Hub shows it at
`https://cuatro.dev/auth/session`. With any of the four empty `cs-tracker` is unconfigured and behaves
exactly as before: the three routes answer 404, a visitor without a session is sent to Steam, and the
session cookie keeps the name `_cs_tracker_key`. With all four set (and in production, where the cookie is
`Secure`) the session cookie is `__Host-cs-tracker`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, never a
`Domain`, and a visitor without a session is sent to `/auth/sign-in`. The rename ends every session once, at
the rollout that first reads all four.

**The dependency (Constitution rule 19).** `oidcc` 3.8.0, exact pin, Apache-2.0, maintained by the Erlang
Ecosystem Foundation, the version the architecture's Stack table names. It adds `jose` 1.11.12 and
`telemetry_registry` 0.3.2 to `mix.lock`. It calls the issuer through Erlang's `:httpc`, where
`cs-tracker`'s own code uses `Req`; `cs-tracker` passes it a 10 second timeout and certificate and hostname
verification (`:httpc.ssl_verify_host_options(true)`), and checks the kill switch before any sign-in
request. **3.8.0 carries EEF-CVE-2026-75759** (GHSA-533g-4vf3-xwrj, HIGH, published 2026-08-30, fixed in
3.9.0, read at `https://api.osv.dev/v1/vulns/EEF-CVE-2026-75759` 2026-10-02T17:06Z): it accepts an encrypted
ID token with no signature inside. It is reachable only when the client holds a decryption key, which
`oidcc` derives from the client secret when discovery lists an `HS*` algorithm among the ID token
encryption algorithms. `cs-tracker` unsets both encryption fields after discovery, so it never decrypts an
ID token; the suite reproduces the bypass on 3.8.0 with that line removed (an unsigned encrypted token
admitted, 302) and refuses it with the line in place (401). The move to 3.9.0 is the Operator's ruling,
action CT4. Hex 2.5.1's audit also flags twelve packages `cs-tracker` already locked before this story
(DW-325); `jose` and `telemetry_registry` carry no advisory.

**What `oidcc` needs from discovery.** It refuses a document without `scopes_supported`,
`response_types_supported`, `subject_types_supported` or `id_token_signing_alg_values_supported`. A live
Clerk production instance, `https://clerk.clerk.com/.well-known/openid-configuration` read
2026-10-02T16:53:36Z, carries all four, lists `RS256`, `S256` and `client_secret_basic`, and lists no
request object, PAR or ID token encryption field. The estate issuer's own document is read by § The
sequence step 6; if it lacks one of the four, sign-in answers 502 and the rest of `cs-tracker` is unaffected.

**By hand, in order, after this record's actions 5 and 7 and the Hub's H3:**

1. **CT1. Register the redirect URI.** On the issuer's OAuth applications page, open `cs-tracker` and add
   exactly `https://cs-tracker.cuatro.dev/auth/callback` to its Redirect URIs. Nothing else changes.
2. **CT2. Set the Owner's subject.** In the browser H3 signed in with, open `https://cuatro.dev/auth/session`
   and copy its `sub` into the local `.env` as `CS_TRACKER_OIDC_OWNER_SUB=<sub>`. Then, from Git Bash at the
   repository root, printing no value:
   ```bash
   grep -E '^CS_TRACKER_OIDC_OWNER_SUB=' .env | tr -d '\r' \
     | ssh deploy@177.7.52.248 'f=/home/deploy/cs-tracker/.env; ! grep -q "^CS_TRACKER_OIDC_OWNER_SUB=" "$f" && { [ -z "$(tail -c1 "$f")" ] || echo >> "$f"; cat >> "$f"; }'
   t="$(mktemp)"; grep -E '^CS_TRACKER_OIDC_OWNER_SUB=' .env | tr -d '\r' > "$t"
   gh secret set -f "$t" --repo LuigiEspinosa/cs-tracker; rm -f "$t"
   ssh deploy@177.7.52.248 'grep -cE "^(OIDC_ISSUER|CS_TRACKER_OIDC_(CLIENT_ID|CLIENT_SECRET|OWNER_SUB))=.+" /home/deploy/cs-tracker/.env'
   ```
   The last command prints `4`. Nothing reads the line until CT3.
3. **CT3. Merge and roll `cs-tracker`.** Once the independent verifier has pushed `dev`, merge it into
   `cs-tracker`'s `main` (nobody else commits there): `gh pr create --repo LuigiEspinosa/cs-tracker --base main
   --head dev --title "Story 5.4: OIDC sign-in"`, then merge it. On the box, in an interactive `ssh
   deploy@177.7.52.248` session, `cs-tracker`'s own redeploy (the order `ops/cs-tracker-cutover.md` records
   for it; this change adds no migration, and the step is idempotent):
   ```bash
   cd /home/deploy/cs-tracker
   git pull --ff-only && git log -1 --format='%H %s'
   docker compose build app
   docker compose run --rm migrate
   docker rollout -w 20 app
   ```
   Then from the workstation: `curl -s -o /dev/null -w '%{http_code}\n' https://cs-tracker.cuatro.dev/auth/session`
   prints `401`. A `404` means `cs-tracker` reads fewer than four values: check them with CT2's last
   command. The rollout signs the Owner's Steam session out once (the cookie's new name).
4. **CT4. Rule on `oidcc` 3.8.0** (DW-324). Options: (a) move to 3.9.0 now, amending the Stack table's row in
   `ARCHITECTURE-SPINE.md` and the epic's wording, a one-line change to `cs-tracker`'s `mix.exs` and its lock,
   re-run with `mix precommit`; (b) keep 3.8.0, relying on the unset encryption fields and the case that
   proves them, until AD-22's next refresh; (c) keep 3.8.0 and add `oidcc` to AD-22's refresh scope so the
   pin is re-read on a schedule. **Recommendation: (a)**, because the fix is on the sign-in path, its cost is
   one line and one suite run, and the unset fields stay as defence in depth. Any time; before CT3 if the
   ruling should reach the box with the first rollout.
5. **CT5. Observe one identity cross the boundary** (FR-21, SM-9). In a fresh browser profile:
   1. Open `https://cuatro.dev/auth/sign-in`, sign in at the issuer, then open `https://cuatro.dev/auth/session`
      and note its `sub`.
   2. Open `https://cs-tracker.cuatro.dev/`. It sends the browser to `/auth/sign-in` and on to the issuer;
      record whether the issuer asked for the password again (its own session may answer without asking).
      The browser lands on the dashboard.
   3. Open `https://cs-tracker.cuatro.dev/auth/session`: its `sub` equals step 1's.
   4. Open the developer tools' cookie list for `cuatro.dev`, `cs-tracker.cuatro.dev` and the issuer's
      hostnames, and record each cookie's name and Domain, never its value. Expected: `__Host-hub-session` on
      `cuatro.dev` and `__Host-cs-tracker` on `cs-tracker.cuatro.dev`, each host-only, and **no cookie with
      Domain `.cuatro.dev` or `cuatro.dev`**; one fails the story (AD-11).

   Write the result under § cs-tracker sign-in run with the UTC time, and whether the two subjects were equal
   (the value itself need not be written). Equal subjects is FR-21's acceptance condition, observed.
6. **CT6. Document the four names in `cs-tracker`'s `.env.example`**, which the authoring session's
   permission settings deny it to open. Append, then commit on `cs-tracker`'s `dev` with a subject line only:
   ```text

   # OIDC sign-in (cuatro-portfolio Story 5.4): all four or none. See docs/deployment.md.
   OIDC_ISSUER=
   CS_TRACKER_OIDC_CLIENT_ID=
   CS_TRACKER_OIDC_CLIENT_SECRET=
   CS_TRACKER_OIDC_OWNER_SUB=
   ```
   `docs/deployment.md` already lists them. Independent of CT1 to CT5.

### cs-tracker sign-in run

_Not yet run._ CT3's status code and CT5's observations are written here, each with its UTC time.

### Pending Operator actions, Story 5.4

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| CT1 | **Register `https://cs-tracker.cuatro.dev/auth/callback`** on the `cs-tracker` OAuth application | After action 5 | _not done_ |
| CT2 | **Set `CS_TRACKER_OIDC_OWNER_SUB`** on the box and as a GitHub secret, and check the four names | After H3 and action 7; a box change | _not done_ |
| CT3 | **Merge `cs-tracker`'s `dev` into `main` and roll the app**, then check `/auth/session` answers 401 | After the verifier pushes `dev`; a box change | _not done_ |
| CT4 | **Rule on `oidcc` 3.8.0 against EEF-CVE-2026-75759** | Closes DW-324 | _not done_ |
| CT5 | **Observe one identity cross the JavaScript/Elixir boundary** and record every cookie's Domain | Story 5.4 is done when this cell is dated with equal subjects and no `.cuatro.dev` cookie; then DW-323 flips the Registry's `identity` | _not done_ |
| CT6 | **Document the four names in `cs-tracker`'s `.env.example`** | A repository change the authoring session could not make | _not done_ |
