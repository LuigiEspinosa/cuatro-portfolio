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
10. [Sign-out (Story 5.5)](#sign-out-story-55)
11. [The Traefik dashboard behind ForwardAuth (Story 5.6)](#the-traefik-dashboard-behind-forwardauth-story-56)
12. [Provider replaceability (Story 5.7)](#provider-replaceability-story-57)
13. [The demo principal (Story 5.8)](#the-demo-principal-story-58)

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
which would put a Clerk route on the box's Traefik. **Ruled by the Operator 2026-10-03** (Pending
Operator action 9): the records are added DNS only and the breach is accepted as standing, recorded as
KV-9 in `ops/known-violations.md`. DW-321 is done. The domain `id.cuatro.dev` was kept in the same ruling.

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

**Story 5.5 built what holds either way** (§ Sign-out): each application's own sign-out, RP-Initiated
Logout driven by whatever discovery advertises, and a Back-Channel receiver in each application. What the
estate can claim on an issuer advertising neither is action 11's ruling, which stays open.

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
| 9 | **Rule on AD-26 for the issuer's hostnames**, before action 2: accept them DNS only as a new known violation in the KV-7 shape, or proxy Clerk's Frontend API through the estate (§ The issuer) | Closes DW-321. The domain decision (`id.cuatro.dev`) may be overruled at the same time | 2026-10-03T22:10Z. Ruled: add the hostnames DNS only, accepted as standing, KV-9 in `ops/known-violations.md`. The domain `id.cuatro.dev` kept |
| 10 | **Rule on AD-3's "Clerk client `<id>`"** (§ The clients, DW-320). Options: (a) narrow AD-3 to the OAuth application's Name and the variables that carry its credentials, which is what this record already holds; (b) keep AD-3 as written and require an issuer that lets the client id be chosen, which rules Clerk out and re-opens Story 5.1; (c) use Client ID Metadata Documents, which apply to public clients only and would make both confidential clients public. **Recommendation: (a)**, a spine wording amendment, since the name and every variable are derived and tested and nothing reads the opaque value but configuration | Closes DW-320. Any time before Story 5.7 | 2026-10-03T22:10Z. Ruled (a): AD-3 narrowed in the spine |
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
| H3 | **Sign in at `https://cuatro.dev/auth/sign-in` and record the session and every cookie's Domain** | Story 5.3 is done when this cell is dated with no `.cuatro.dev` cookie; then DW-322 flips the Registry's `identity`, by `ops/registry-verification.md` § The release the live steps unlock, order 1, whose job reads this cell | _not done_ |

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
exactly as before: the three routes answer what an unrouted path answers (404, `Not Found`), a visitor without a session is sent to Steam, and the
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
| CT5 | **Observe one identity cross the JavaScript/Elixir boundary** and record every cookie's Domain | Story 5.4 is done when this cell is dated with equal subjects and no `.cuatro.dev` cookie; then DW-323 flips the Registry's `identity`, by `ops/registry-verification.md` § The release the live steps unlock, order 2, whose job reads this cell | _not done_ |
| CT6 | **Document the four names in `cs-tracker`'s `.env.example`** | A repository change the authoring session could not make | _not done_ |

## Sign-out (Story 5.5)

**What exists (built 2026-10-02, the Hub on this repository's `dev` and `cs-tracker` on its `dev`, proven
against a stand-in issuer only).** Nothing below names a provider (FR-23), and with OIDC unconfigured both
applications answer as before. In `cs-tracker` the new routes answer what an unrouted path answers (404,
`Not Found`). In the Hub they answer 404 with an empty body, as its Story 5.3 routes do, while an unrouted
path answers 404 with the Hub's 404 page: the status is the same, the body is not.

- **Each application's own sign-out**, `GET https://cuatro.dev/auth/sign-out` and
  `GET https://cs-tracker.cuatro.dev/auth/sign-out`, reached by URL as sign-in is. It revokes every session
  of the signed-in subject in that application, on every device (FR-22 says every session), deletes the
  session cookie, and in `cs-tracker` broadcasts `disconnect` on the subject's `live_socket_id`
  (`oidc_sessions:<sub>`), which closes every LiveView socket open on those sessions; the client reconnects
  at once and its mount refuses the revoked session, sending it to `/auth/sign-in`. Then, when discovery
  advertises an `end_session_endpoint`, the browser goes there with `client_id` and
  `post_logout_redirect_uri` (`https://cuatro.dev/` and `https://cs-tracker.cuatro.dev/`), which is
  RP-Initiated Logout 1.0, so the issuer's own session ends too. Without one, or when discovery fails, the
  Hub sends the browser to `/` and `cs-tracker` answers `Signed out of cs-tracker.` No `id_token_hint` is
  sent (neither application keeps the ID token), so an issuer may ask the person to confirm. A request
  whose `Sec-Fetch-Site` is `cross-site` or `same-site`, or that a browser marks as a prefetch, answers 403
  and revokes nothing.
- **A Back-Channel Logout receiver in each application**, `POST https://cuatro.dev/auth/backchannel-logout`
  and `POST https://cs-tracker.cuatro.dev/auth/backchannel-logout`. It validates the `logout_token` as
  Back-Channel Logout 1.0 § 2.6 requires: a compact JWS signed by a key in the issuer's JWKS with the ID
  token's asymmetric algorithms (so `none`, HS* and an encrypted token are refused), `iss` the configured
  issuer, `aud` naming this client, `iat` present and under five minutes old, `exp` present and not past,
  `events` carrying `http://schemas.openid.net/event/backchannel-logout` as an object, no `nonce`, `sub` or
  `sid` present, and a `jti` not seen before. A valid token revokes every session matching its `sub` or
  `sid` and answers 200; `cs-tracker` also broadcasts the disconnect. Anything else answers 400
  `invalid_request` and revokes nothing. Both answer `Cache-Control: no-store`.
- **Revocation lives in each process's memory** (the Hub's `globalThis`, `cs-tracker`'s ETS). A restart
  forgets it, so each process refuses every OIDC session minted before it started: **the Owner signs in
  again after every rollout of either application**, the Hub's included, which every push to `main` that
  deploys causes. A revoked session is never revived. During `docker-rollout`'s overlap a logout reaching
  the old container is lost for a session minted on the old container after the new one started, a window
  of seconds (DW-328).
- **`cs-tracker`'s OIDC session now lasts 8 hours**, the Hub's lifetime (DW-327 closed).
- **Under `cs-tracker`'s kill switch a back-channel logout answers 503 and revokes nothing, and nothing is
  lost by it** (decided 2026-10-02 from the code, after the 5.5 verifier's finding 2). The receiver must
  fetch discovery and the JWKS to verify the token, and NFR-5 forbids any outbound call under the kill
  switch, so it cannot verify; acting on an unverified token would let anyone sign the Owner out. Refusing
  loses nothing because a kill-switched process holds no OIDC session: `KILL_SWITCH` is read once at boot
  (`config/runtime.exs`; `docs/deployment.md` § Toggle the kill switch recreates the container), the new
  process refuses every session minted before it started, and under the kill switch its sign-in and its
  callback answer 503 and mint none (each held by a case in `oidc_controller_test.exs`, the callback's
  added at `cs-tracker` `faaa642`). The Hub has no kill switch. A logout sent while the kill switch is on is
  not retried and need not be.

**What sign-out reaches, by what the issuer advertises.**

| The issuer advertises | Signing out of the Hub | Signing out of `cs-tracker` |
|---|---|---|
| `end_session_endpoint` and `backchannel_logout_supported: true`, each client registered for both | Every Hub session; the issuer's session; the issuer's back-channel call ends every `cs-tracker` session and closes its open sockets | The same, mirrored |
| `end_session_endpoint` only | Every Hub session and the issuer's session. `cs-tracker`'s sessions and open sockets keep serving, up to 8 hours | The same, mirrored |
| Neither (a live Clerk production issuer, read 2026-10-02, § Logout) | **Every Hub session only.** The issuer's session survives, so the next sign-in at either application may not ask for the password, and `cs-tracker`'s sessions and open sockets keep serving, up to 8 hours | **Every `cs-tracker` session and every socket open on them only.** The Hub's sessions keep serving |

So on an issuer advertising neither, sign-out reaches only the application signed out of, its open
LiveView sockets included; FR-22's reach across applications is not met, and nothing in either
application can meet it without the issuer. That is action 11's ruling (DW-319), which this record does
not make.

**By hand, in order, after the issuer's action 3 has recorded its discovery document:**

1. **S1. Register the post-logout redirect URIs**, only if discovery advertises an `end_session_endpoint`:
   on the issuer's OAuth applications page, add exactly `https://cuatro.dev/` to `cuatro-portfolio` and
   `https://cs-tracker.cuatro.dev/` to `cs-tracker`, wherever the issuer takes post-logout redirect URIs.
   If it advertises none, or its page offers no such field, write that under § Sign-out run instead.
2. **S2. Register the Back-Channel Logout URIs**, only if discovery says `backchannel_logout_supported:
   true`: `https://cuatro.dev/auth/backchannel-logout` on `cuatro-portfolio` and
   `https://cs-tracker.cuatro.dev/auth/backchannel-logout` on `cs-tracker`. Otherwise record that it was not
   offered.
3. **S3. Roll both applications onto Story 5.5.** The Hub at the epic's merge to `main` (or H2's dispatch);
   `cs-tracker` by CT3's merge and redeploy once the verifier has pushed its `dev`. Then, from Git Bash,
   printing no value:
   ```bash
   for h in cuatro.dev cs-tracker.cuatro.dev; do
     curl -s -o /dev/null -w "$h backchannel %{http_code}\n" -X POST -d logout_token=x "https://$h/auth/backchannel-logout"
     curl -s -o /dev/null -w "$h sign-out cross-site %{http_code}\n" -H 'Sec-Fetch-Site: cross-site' "https://$h/auth/sign-out"
   done
   ```
   Expected: `400` and `403` for each host. A `404` means that application reads no OIDC configuration.
4. **S4. Observe an open socket leave on sign-out** (FR-22's case; it holds on any issuer). In the browser
   CT5 signed in with, open `https://cs-tracker.cuatro.dev/` in tab A and the developer tools' Network
   panel on its WebSocket (`/live/websocket`). In tab B type `https://cs-tracker.cuatro.dev/auth/sign-out`.
   In tab A, record: the socket closing, the reconnect's `phx_reply` carrying
   `"redirect":{"to":"/auth/sign-in"}`, and the page leaving the dashboard. If the issuer's session is still
   alive it may sign straight back in; record whether the issuer asked for the password.
5. **S5. Observe sign-out cross the boundary**, only if S2 registered both URIs. With the Hub and tab A of
   `cs-tracker` both signed in, open `https://cuatro.dev/auth/sign-out` in another tab, complete the
   issuer's page if it shows one, and record that tab A left the dashboard as in S4 and that
   `https://cs-tracker.cuatro.dev/auth/session` answers 401 before any new sign-in. If S2 was not possible,
   this step waits on action 11.

### Sign-out run

_Not yet run._ S1 and S2's registrations (or that the issuer offered none), S3's status codes and S4 and
S5's observations are written here, each with its UTC time.

### Pending Operator actions, Story 5.5

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| S1 | **Register the post-logout redirect URIs**, or record that the issuer advertises no `end_session_endpoint` | After action 3 | _not done_ |
| S2 | **Register the Back-Channel Logout URIs**, or record that the issuer does not support it | After action 3 | _not done_ |
| S3 | **Roll both applications onto Story 5.5** and check the status codes | After H2 and CT3; a box change | _not done_ |
| S4 | **Observe an open `cs-tracker` socket leave on sign-out** | After S3 | _not done_ |
| S5 | **Observe sign-out cross from the Hub to an open `cs-tracker` socket** | Only with S2 done; otherwise action 11 decides what stands in for it | _not done_ |

## The Traefik dashboard behind ForwardAuth (Story 5.6)

**What exists (built 2026-10-02 on `dev`, rehearsed off the box against a stand-in issuer only).** AD-11 keeps
Traefik ForwardAuth for surfaces with no authentication of their own and never for an application's identity.
On the box that is one surface: **the Traefik dashboard** (`api@internal`), whose only gate today is Traefik's
own basic auth (`TRAEFIK_DASHBOARD_USERS`, the `dashboard-auth` middleware). Every other surface authenticates
itself and is not gated: Umami's login, the tracker's `/admin` (`next-auth`, `apps/tracker/middleware.ts`), the
tournament's admin (Supabase Auth), `cs-tracker` (the Owner's sign-in), the Hub (Story 5.3); qBittorrent's
WebUI has its own login and no hostname (`ops/routing-inventory.md` § How qBittorrent is administered).
`ops/__tests__/traefik-config.test.ts` holds that no router but the dashboard's names a forwardAuth middleware
and no public router reaches the service, whichever way the switch below is set.

- **The service** is `forward-auth` in `ops/traefik/compose.yml`: oauth2-proxy as the confidential OIDC client
  `traefik`, with PKCE `S256`, a `nonce` it sends and checks in the ID token as the Hub's and `cs-tracker`'s
  clients do (`OAUTH2_PROXY_INSECURE_OIDC_SKIP_NONCE: 'false'`; oauth2-proxy skips it by default), the issuer
  read from discovery (`OIDC_ISSUER`, no provider named, FR-23), and a session cookie `__Host-traefik-dashboard`: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`,
  eight hours as the Hub's. It admits one address, the Owner's (`TRAEFIK_OIDC_OWNER_EMAIL`, handed to it as a
  file), and only when the issuer states that address verified; a domain allowlist would admit anyone the
  issuer knows at that domain, `demo@cuatro.dev` included. It sits on `cs-tracker_default` beside Traefik and
  publishes no port. `ops/__tests__/traefik-config.test.ts` holds its whole environment, its top-level keys
  and the `dashboard-forward-auth` middleware as exact sets, so an added setting (a skip-auth route, JWT
  bearer bypass, unverified email, `trustForwardHeader`) or a widened one fails a case. Its `/oauth2/` paths, the callback among them, are a router of their own on the
  dashboard's loopback entrypoint.
- **What changes for the dashboard, once switched:** its router's middleware becomes `dashboard-forward-auth`,
  so a request without the session is sent to the issuer and back to `http://localhost:8080/oauth2/callback`,
  and basic auth no longer admits anyone. **What does not change:** the dashboard stays on the loopback
  entrypoint (`127.0.0.1:8081` on the box), reached only through `ssh -N -L 8080:127.0.0.1:8081
  deploy@177.7.52.248`; `api.insecure` stays off; no hostname, DNS record or published port is added; and
  `TRAEFIK_DASHBOARD_USERS` stays in the env file, unused while switched on and the gate again once switched
  off. Every public router is untouched.
- **Why nothing merged changes the box (the hazard of DW-299).** Traefik renders `dynamic/routes.yml` as a Go
  template. The dashboard's two routers, the middleware and the service sit inside
  `eq (env "DASHBOARD_FORWARD_AUTH") "on"`; with the variable unset the file renders to the same routers,
  middlewares and services as before this story, and Traefik reads its environment once, when its container
  is created. The service is under the compose profile `forward-auth`, which the plain `up -d` never starts.
  So the deploy that resets the checkout to `main` changes nothing; FA3 and FA4 below, by hand, do. With an
  env file holding only today's two names, `docker compose config` accepts the new `compose.yml` (with and
  without the profile), and `up -d --wait` starts the ingress alone, its dashboard answering 401 and 200 and
  no router, middleware or service naming the service (checked 2026-10-02 around 20:41Z).
- **Sign-out.** `http://localhost:8080/oauth2/sign_out` ends the dashboard's session. Signing out of an
  application or of the issuer does not reach it: oauth2-proxy receives no Back-Channel logout, so the
  session serves up to eight hours (DW-330). The dashboard is not an application, so FR-22 does not bind it.
- **Break-glass.** If the issuer is down or refuses the client, the dashboard cannot be reached while
  switched on. Delete the `DASHBOARD_FORWARD_AUTH` line from `ops/traefik/.env` and recreate the ingress as
  FA4 does: basic auth is back, as the rehearsal's phase D shows.

**The component (Constitution rule 19).** `quay.io/oauth2-proxy/oauth2-proxy:v7.15.5`, pinned by its
multi-platform index digest `sha256:8498b0d0ef0a7b29686414000a08aee467f02d0299c9ed1e006a8f33fc017916` (read
2026-10-02). MIT (`gh api repos/oauth2-proxy/oauth2-proxy`, not archived). v7.15.5 was published 2026-10-01
and is the first release outside GHSA-63jm-59jj-478j and GHSA-wr5q-7wxw-x568 (both critical, authentication
bypasses) and GHSA-hhqp-vx7f-5c6m (moderate), each patched after v7.15.4; `api.osv.dev` listed no
vulnerability for 7.15.5 at 2026-10-02T20:12:23Z. The image runs as UID 65532 with `/bin/oauth2-proxy` as its
entrypoint, and refuses to start on an empty value (`invalid configuration`, observed 2026-10-02 with the
cookie secret empty). **What it stores: nothing on disk and nothing server-side.** The session store is the
default cookie store, so the session is an encrypted cookie in the Owner's browser, sealed with
`TRAEFIK_FORWARD_AUTH_COOKIE_SECRET`. It holds the client secret and that cookie secret in its environment
and calls only the issuer. Its version is not on AD-22's refresh list (FA6, DW-329).

**Capacity (AD-9).** Not a placement: `ops/capacity-gate.yml` lists applications, and its header names Umami
and Postgres as infrastructure rather than Estate applications; this service belongs to the Traefik stack, is
started by hand and never by a deploy, so no id is added and no workflow's gate reads it. Its footprint in the
rehearsal, idle after a sign-in: 0.00% CPU and 6.2 MiB of memory (`docker stats`; 5.8 MiB in an earlier run), beside the gate's
threshold of load15 0.60 on 2 vCPU (`ops/capacity-threshold.md`).

**The client (AD-3).** The Traefik stack has no Registry id, so the derivation is applied to its compose
project name, `traefik` (`name: traefik` in `ops/traefik/compose.yml`): the OAuth application's Name is
`traefik`, and its variables are `TRAEFIK_OIDC_CLIENT_ID` and `TRAEFIK_OIDC_CLIENT_SECRET`. It is not a row of
§ The clients, whose rows are Registry ids. Two more names belong to the service: `TRAEFIK_OIDC_OWNER_EMAIL`
(an identifier, not a credential) and `TRAEFIK_FORWARD_AUTH_COOKIE_SECRET` (generated on the box, never
copied anywhere else). The values live in the box's gitignored `/home/deploy/cuatro-portfolio/ops/traefik/.env`
beside `TRAEFIK_DASHBOARD_USERS`, and the two client values also as GitHub Actions secrets of
`LuigiEspinosa/cuatro-portfolio`, the durable copy. That file is the ingress's `env_file` too, so Traefik's own
container sees them: the same file, on the same box, with the same reader. The redirect URI is
`http://localhost:8080/oauth2/callback`, the SSH tunnel's local end: plain `http` on a loopback name, which
some issuers refuse for a confidential client. If the issuer refuses it, FA1 stops and FA7 is the ruling.

### Rehearsed off the box

**Observed 2026-10-02 between 20:45:30Z and 20:46:50Z on the authoring machine** (Docker 29.8.1, Compose
5.5.1), with copies of the committed `ops/traefik/` files in a scratch directory and a scratch override that
replaced the ingress's `env_file` with a throwaway file and pointed `acme-v02.api.letsencrypt.org` at
loopback, as `ops/traefik-cutover.md` § Rehearsed off the box did: a network `cs-tracker_default`, a volume
`traefik-origin-ca` holding a self-signed pair for `cuatro.dev` and `*.cuatro.dev`, one `traefik/whoami:v1.11`
per upstream alias, and `ops/forward-auth-stand-in-issuer.mjs` in `node:24-slim` as the issuer
`http://issuer:9000` (client `traefik`, the redirect URI above, PKCE `S256` required). Requests went to 443
with `curl --resolve`, and to the dashboard with `--connect-to localhost:8080:127.0.0.1:8081`, the tunnel's
shape. Everything was removed afterwards. Each phase probed the seven hostnames with a router of their own
and `www`, the `library` split, `cuatro.dev/oauth2/sign_in` (an application path, which must reach the
application), an unknown hostname, plain HTTP, the dashboard over 443, the dashboard with and without basic
credentials, and Traefik's `/api/rawdata`:

```
A, main's routes.yml          every hostname 200 from its own stand-in; cuatro.dev/oauth2/sign_in 200 Name: anchor-app
                              dashboard: no credentials 401, basic credentials 200; 13 routers, all enabled
B, this routes.yml, unset     A against B: IDENTICAL, probes and /api/rawdata byte for byte; no configuration error
FA3, forward-auth started     /ping OK; nothing names it yet
FA4, switch on, recreated     7 of 200 requests to cuatro.dev, sent every 50 ms through the recreate, got no answer
C, switched on                dashboard, no session: 302 http://issuer:9000/authorize?...code_challenge_method=S256&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Foauth2%2Fcallback...
                              issuer authorize (the Owner): 302 http://localhost:8080/oauth2/callback?code=...&state=...
                              callback: 302 http://localhost:8080/dashboard/
                              Set-Cookie: __Host-traefik-dashboard=...; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax
                              dashboard, session: 200; routers add dashboard-oauth2, middlewares dashboard-forward-auth, services forward-auth
                              basic credentials only: 302; forged X-Forwarded-Email, X-Auth-Request-Email, X-Forwarded-User: 302
                              callback as demo@cuatro.dev (signed in at the issuer, not the Owner): 403; dashboard then 302
                              /oauth2/sign_out 302, dashboard then 302
                              A against C, every application line: IDENTICAL
D, switch removed, recreated  A against D: IDENTICAL, probes and /api/rawdata byte for byte
```

**Re-run with the nonce on, 2026-10-02 between 21:22:53Z and 21:25:41Z** (two runs of the same phases, the
committed `compose.yml` with `OAUTH2_PROXY_INSECURE_OIDC_SKIP_NONCE: 'false'`; Story 5.6's fix round 1):

```
A, B                          as above; A against B: IDENTICAL, probes and /api/rawdata byte for byte
FA3                           /ping OK
C, switched on                A against C, every application line: IDENTICAL; dashboard no session 302, basic credentials 302
                              authorize URL carries code_challenge_method=S256, nonce and state
                              the Owner's callback 302 to /dashboard/, the same __Host- cookie; dashboard 200
                              replayed callback 403
                              callback with a well-formed forged state: 403, no session cookie; dashboard then 302
                              callback with a state that does not parse (`state=forged`): 500, no session cookie
                                ("Error while parsing OAuth2 state: invalid length"); a refusal, not a fault
                              demo@cuatro.dev: callback 403, dashboard 302
                              an issuer that omits the nonce from the ID token: callback 403, dashboard 302
                                ("nonce verification failed: id_token nonce claim does not match the session nonce")
                              footprint 0.00% CPU, 6.0 to 6.2 MiB
D                             dashboard 401 and 200 with basic credentials; A against D: IDENTICAL, probes and /api/rawdata
```

**The allowlist ignores case** (Story 5.6's verifier, round 2, and re-observed in fix round 2's run ending
2026-10-02T22:04:18Z): an issuer-verified `OWNER@EXAMPLE.TEST`, the Owner's address in capitals, is admitted
(callback 302, the `__Host-` cookie, dashboard 200), because oauth2-proxy compares addresses case-insensitively.
`owner@example.test.evil.example` is refused (callback 403), as `demo@cuatro.dev` is. Acceptable for one address
the issuer verifies: the issuer, never the browser, asserts it, and a domain is case-insensitive anyway.

The recreate refuses connections on every hostname for under a second, once at FA4 and once at a
break-glass. Not proven here: the real issuer (whether it accepts the loopback redirect URI, its
`email_verified` claim), the box's aliases, the edge, and a browser's handling of a `__Host-` cookie on
`http://localhost`, which FA5 observes. To re-run it, from the repository root in Git Bash, probing each phase
with the lines of `ops/traefik-cutover.md`'s block on port 443 and saving
`curl -s "${D[@]}" -u operator:throwaway http://localhost:8080/api/rawdata` per phase for `cmp`. The block as
written ran end to end under `bash -e` between 2026-10-02T20:43:02Z and 20:43:48Z, printing `callback 302`
and `dashboard 200` and leaving no container, network or volume behind. Bodies go to `$W/body`, never
`/dev/null`, which Git Bash's curl cannot open while `MSYS_NO_PATHCONV` is set:

```bash
T0="$(mktemp -d)"; W="$(cygpath -m "$T0")"; export MSYS_NO_PATHCONV=1
cp ops/traefik/compose.yml ops/traefik/traefik.yml "$W/"; mkdir "$W/dynamic"
git show origin/main:ops/traefik/dynamic/routes.yml > "$W/dynamic/routes.yml"
printf 'services:\n  ingress:\n    env_file: !override [rehearsal.envfile]\n    extra_hosts: ["acme-v02.api.letsencrypt.org:127.0.0.1"]\n' > "$W/rehearsal.yml"
ISS=http://issuer:9000
{ printf "TRAEFIK_DASHBOARD_USERS='operator:%s'\nCF_DNS_API_TOKEN=throwaway\n" "$(openssl passwd -apr1 throwaway)"; echo "OIDC_ISSUER=$ISS"
  printf 'TRAEFIK_OIDC_CLIENT_ID=traefik\nTRAEFIK_OIDC_CLIENT_SECRET=throwaway-client-secret\nTRAEFIK_OIDC_OWNER_EMAIL=owner@example.test\n'
  printf 'TRAEFIK_FORWARD_AUTH_COOKIE_SECRET=%s\n' "$(head -c 32 /dev/urandom | base64 | tr -- '+/' '-_')"; } > "$W/rehearsal.envfile"
T="docker compose -f $W/compose.yml -f $W/rehearsal.yml --env-file $W/rehearsal.envfile"
docker network create cs-tracker_default && docker volume create traefik-origin-ca
docker run --rm -v traefik-origin-ca:/data alpine:3 sh -c 'apk add -q openssl && openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=throwaway-origin -addext "subjectAltName=DNS:cuatro.dev,DNS:*.cuatro.dev" -keyout /data/origin.key -out /data/origin.pem'
for a in anchor-app:3000 anchor-umami:3000 app:4000 cuatro-app:3000 library-web:3000 library-api:4000 list-wheel:80 tournament:3000; do
  docker run -d --name "stand-in-${a%%:*}" --network cs-tracker_default --network-alias "${a%%:*}" traefik/whoami:v1.11 --port "${a##*:}" --name "${a%%:*}"
done
docker run -d --name stand-in-issuer --network cs-tracker_default --network-alias issuer -p 127.0.0.1:9000:9000 -v "$(pwd -W)/ops/forward-auth-stand-in-issuer.mjs:/issuer.mjs:ro" \
  -e ISSUER=http://issuer:9000 -e CLIENT_ID=traefik -e CLIENT_SECRET=throwaway-client-secret -e REDIRECT_URI=http://localhost:8080/oauth2/callback node:24-slim node /issuer.mjs
D=(--connect-to localhost:8080:127.0.0.1:8081); I=(--connect-to issuer:9000:127.0.0.1:9000); J="$W/jar"
loc() { curl -s -D - -o "$W/body" "$@" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p'; }
$T up -d --wait ingress                                                              # phase A
cp ops/traefik/dynamic/routes.yml "$W/dynamic/routes.yml"; sleep 4                    # phase B
$T --profile forward-auth up -d forward-auth                                         # FA3
echo DASHBOARD_FORWARD_AUTH=on >> "$W/rehearsal.envfile"; $T up -d --wait ingress   # FA4, phase C
curl -s -X POST "${I[@]}" 'http://issuer:9000/as?email=owner@example.test'; echo    # or demo@cuatro.dev
a=$(loc "${D[@]}" -c "$J" -b "$J" http://localhost:8080/dashboard/); b=$(loc "${I[@]}" "$a")
curl -s -o "$W/body" -w 'callback %{http_code}\n' "${D[@]}" -c "$J" -b "$J" "$b"
curl -s -o "$W/body" -w 'dashboard %{http_code}\n' "${D[@]}" -b "$J" http://localhost:8080/dashboard/
sed -i '/^DASHBOARD_FORWARD_AUTH=/d' "$W/rehearsal.envfile"; $T up -d --wait ingress  # phase D
$T --profile forward-auth down -v; docker rm -f $(docker ps -aq --filter name=stand-in-)
docker volume rm traefik-origin-ca && docker network rm cs-tracker_default; rm -rf "$T0"
```

### By hand, in order, after this record's actions 1 to 7 (the issuer exists and its values are recorded)

1. **FA1. Create the client.** On the issuer's OAuth applications page, as § The sequence step 8 does: Name
   `traefik`, scopes `openid`, `profile` and `email`, confidential, PKCE required, Redirect URI exactly
   `http://localhost:8080/oauth2/callback`. Paste the Client ID and the secret into the local `.env` as
   `TRAEFIK_OIDC_CLIENT_ID` and `TRAEFIK_OIDC_CLIENT_SECRET`, and the Owner's sign-in address as
   `TRAEFIK_OIDC_OWNER_EMAIL`. **If the page refuses the redirect URI, stop**, record what it said under
   § Dashboard run, and take FA7.
2. **FA2. Put the values on the box and in GitHub**, printing none, from Git Bash at the repository root:
   ```bash
   grep -E '^(OIDC_ISSUER|TRAEFIK_OIDC_(CLIENT_ID|CLIENT_SECRET|OWNER_EMAIL))=' .env | tr -d '\r' \
     | ssh deploy@177.7.52.248 'f=/home/deploy/cuatro-portfolio/ops/traefik/.env; ! grep -qE "^(OIDC_ISSUER|TRAEFIK_OIDC_)" "$f" && { [ -z "$(tail -c1 "$f")" ] || echo >> "$f"; cat >> "$f"; }'
   ssh deploy@177.7.52.248 'f=/home/deploy/cuatro-portfolio/ops/traefik/.env; grep -q "^TRAEFIK_FORWARD_AUTH_COOKIE_SECRET=" "$f" || printf "TRAEFIK_FORWARD_AUTH_COOKIE_SECRET=%s\n" "$(head -c 32 /dev/urandom | base64 | tr -- "+/" "-_")" >> "$f"; grep -cE "^(OIDC_ISSUER|TRAEFIK_OIDC_(CLIENT_ID|CLIENT_SECRET|OWNER_EMAIL)|TRAEFIK_FORWARD_AUTH_COOKIE_SECRET)=.+" "$f"'
   t="$(mktemp)"; grep -E '^TRAEFIK_OIDC_CLIENT_(ID|SECRET)=' .env | tr -d '\r' > "$t"
   gh secret set -f "$t" --repo LuigiEspinosa/cuatro-portfolio; rm -f "$t"
   ```
   The second command prints `5`. An `ssh` exit of 1 from the first means the lines were already there.
   Nothing reads them until FA3.
3. **FA3. Start the service**, in an interactive `ssh deploy@177.7.52.248` session. No router names it yet, so
   this changes nothing a request sees:
   ```bash
   cd /home/deploy/cuatro-portfolio && T='docker compose -f ops/traefik/compose.yml'
   $T --profile forward-auth up -d forward-auth
   docker run --rm --network cs-tracker_default curlimages/curl:8.11.1 -s http://forward-auth:4180/ping; echo
   $T logs forward-auth | tail -5
   ```
   `OK` prints. `invalid configuration` in the log means a value is empty: check FA2's count.
4. **FA4. Switch the dashboard**, at a quiet hour, because recreating the ingress refuses connections on
   every hostname for under a second (the rehearsal), in the same session:
   ```bash
   echo DASHBOARD_FORWARD_AUTH=on >> ops/traefik/.env
   $T up -d --wait ingress
   docker logs traefik-ingress-1 --since 2m 2>&1 | grep -c 'Error while building configuration'
   for h in cuatro.dev analytics.cuatro.dev cs-tracker.cuatro.dev tracker.cuatro.dev library.cuatro.dev wheel.cuatro.dev tournament.cuatro.dev; do
     echo "$h $(curl -sk -o /dev/null -w '%{http_code}' --resolve "$h:443:127.0.0.1" "https://$h/")"; done
   curl -s -o /dev/null -w 'dashboard, no session %{http_code}\n' http://localhost:8081/dashboard/
   ```
   The `grep` prints `0`, each hostname answers what it answered before (`ops/caddy-retirement.md`
   § Retirement run), and the dashboard answers `302`. A `500` there means Traefik cannot reach the service:
   break-glass above.
5. **FA5. Observe the sign-in.** On the workstation, `ssh -N -L 8080:127.0.0.1:8081 deploy@177.7.52.248`; in a
   fresh browser profile open `http://localhost:8080/dashboard/`, sign in at the issuer, and confirm the
   dashboard shows. Record under § Dashboard run, with the UTC time: the cookie list for `localhost` (each
   cookie's name and Domain, never its value; expected `__Host-traefik-dashboard`, host-only), and that
   `curl -s -o /dev/null -w '%{http_code}\n' -u operator http://localhost:8080/dashboard/` (it prompts for the
   old password) prints `302` from a second terminal. If the issuer holds a second account (the demo
   principal of Story 5.8), sign in with it in another fresh profile and record the `403`.
6. **FA6. Rule on oauth2-proxy's shelf life** (DW-329). Options: (a) add oauth2-proxy to AD-22's refresh
   scope, a spine amendment, so its pin is re-read with Traefik's; (b) leave it off the list and re-read it
   only when an advisory is published; (c) as (a), and also watch the repository's security advisories.
   **Recommendation: (a)**, because v7.15.5 itself exists to close two critical authentication bypasses and
   the service is the dashboard's only gate once switched. Any time.
7. **FA7. Rule on the dashboard's address, only if FA1 stopped.** Options: (a) give the dashboard a public
   hostname behind ForwardAuth over `websecure` (a new proxied DNS record, a new public surface, an `https`
   redirect URI), which reverses Story 4-2's loopback-only placement; (b) keep it loopback-only on basic auth
   and record AD-11's dashboard clause as not met on this issuer; (c) another issuer for this one client,
   which re-opens Story 5.1. **Recommendation: (b)**, because SSH and basic auth already gate it and (a)
   trades that for a public surface.

### Dashboard run

_Not yet run._ FA1's registration, FA2's count, FA3's `/ping`, FA4's statuses and FA5's observations are
written here, each with its UTC time.

### Pending Operator actions, Story 5.6

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| FA1 | **Create the `traefik` client** with the loopback redirect URI | After action 5; stops at FA7 if refused | _not done_ |
| FA2 | **Put the five values on the box and the two client values in GitHub** | After FA1; a box change | _not done_ |
| FA3 | **Start `forward-auth`** under its profile and check `/ping` | After FA2; a box change that routes nothing | _not done_ |
| FA4 | **Switch the dashboard** and check every hostname and the dashboard's `302` | After FA3; recreates the ingress | _not done_ |
| FA5 | **Sign in to the dashboard through the tunnel** and record the cookie and the refused basic credentials | Story 5.6 is done when this cell is dated | _not done_ |
| FA6 | **Rule on oauth2-proxy's place in AD-22's refresh** | Closes DW-329 | _not done_ |
| FA7 | **Rule on the dashboard's address**, only if the issuer refuses the loopback redirect URI | Only if FA1 stopped | _not done_ |

## Provider replaceability (Story 5.7)

**What FR-23 claims, and how it is shown (built 2026-10-02 on `dev`).** FR-23: identity is replaceable
without touching application code, because no participant holds provider-specific logic beyond issuer
configuration and client credentials (AD-11: "OIDC *is* the reversibility seam"). Every participant was built
and proven against a stand-in issuer written for its own suite, and each suite scans its code for provider
names; neither is the claim. The claim is shown by pointing each participant's **built production artefact**
at a **second, independently implemented OpenID Provider** through the variables it already reads, changing
nothing else, and completing a sign-in. `ops/provider-swap.sh` does that on a scratch internal Docker network,
driving each sign-in with `ops/provider-swap-sign-in.mjs` the way a browser behind Traefik would, and leaves
nothing behind. It is never run on the box.

| Participant | Artefact | What it was given | Session minted |
|---|---|---|---|
| The Hub | the production image, `apps/hub/Dockerfile` | `OIDC_ISSUER`, `CUATRO_PORTFOLIO_OIDC_CLIENT_ID` and `_SECRET` | `__Host-hub-session` |
| `cs-tracker` | the production release image, its own `Dockerfile` | `OIDC_ISSUER`, `CS_TRACKER_OIDC_CLIENT_ID`, `_SECRET` and `_OWNER_SUB` (the Hub's `sub`, as CT2 does), over the boot baseline every run needs (`DATABASE_URL`, `SECRET_KEY_BASE`, `PHX_HOST`, `STEAM_ID`) | `__Host-cs-tracker` |
| The dashboard's forward-auth | `ops/traefik/compose.yml`'s `forward-auth`, as committed | the five names its environment interpolates (`OIDC_ISSUER`, `TRAEFIK_OIDC_CLIENT_ID`, `_SECRET`, `TRAEFIK_OIDC_OWNER_EMAIL`, `TRAEFIK_FORWARD_AUTH_COOKIE_SECRET`) | `__Host-traefik-dashboard` |

**The one addition, and why it is not application configuration.** The scratch issuer's TLS certificate is
signed by a certificate authority made for the run, so each runtime is told to trust it: `NODE_EXTRA_CA_CERTS`
for the Hub, and the image's own CA bundle with the authority appended, mounted in place, for `cs-tracker`
(which verifies certificate and hostname, `:httpc.ssl_verify_host_options(true)`), and the authority alone,
mounted in place, for forward-auth. An issuer with a publicly trusted certificate needs none of it.
`ops/__tests__/provider-swap.test.ts` holds each participant's variables to exactly these sets, so the
demonstration cannot quietly start passing a flag.

**The second issuer (Constitution rule 19, a test-time dependency only).** dex `v2.45.1`, a CNCF project,
Apache-2.0 (`gh api repos/dexidp/dex`, not archived), pinned by its multi-platform index digest
`sha256:8499afd690c437f52301efd2b05b2455da5bd2dfc20332cd697dc9937f808462` (read 2026-10-02, `dex version`:
v2.45.1, Go 1.26.0). Advisories read 2026-10-02T22:41Z: the repository's GHSA-7qjx-gp9h-65qj (high, the
token-exchange grant ignores a client's allowed connectors) names its affected range as later than 2.45.1 and
is unreachable here (no token exchange, one connector); `api.osv.dev` lists GO-2024-2476 (GHSA-gr79-9v6v-gc9r,
TLS 1.0 and 1.1 served by 2.37.0) against 2.45.1 with its own note that its versions could not be mapped, and
the GHSA names 2.38.0 as patched. It stores nothing (`storage: memory`), holds one user and the three clients,
runs on a network with no egress for one run, and is never on the box or in a deploy. Idle footprint 0.00%
CPU and 8.1 MiB (`docker stats` on a bare instance). Its login is the bcrypt hash of `password` from dex's own
`examples/config-dev.yaml`, a throwaway on an issuer that lives for one run; client secrets are generated
per run and printed nowhere.

**How dex differs from Clerk, which is the point.** It is a different implementation with its own login
pages, its own `sub` format (an encoded user and connector id), no `end_session_endpoint` and no Back-Channel
logout; it offers `plain` PKCE and `client_secret_post`, which the participants refuse to take; and it lets
the operator **choose** each Client ID, so here each is the application id itself, AD-3's literal derivation.
Clerk assigns its own (DW-320). The variables carry either kind of value unchanged, which is what DW-320
needs from them. oauth2-proxy asks with `approval_prompt=force`, so dex shows a consent page for forward-auth
only, which the driver approves as a person would.

**Run on 2026-10-02 between 22:55:32Z and 22:55:57Z** (Docker 29.8.1), on the Hub's image built from
`7275275` and `cs-tracker`'s from `ee33c71` on its `dev`, exit 0, nothing left behind:

```
== issuer: Dex Version: v2.45.1, https://issuer.test:5554
== the Hub (provider-swap-hub:7275275): OIDC_ISSUER, CUATRO_PORTFOLIO_OIDC_CLIENT_ID and _SECRET
session before sign-in: 401
sign-in: 302 to https://issuer.test:5554/auth client_id=cuatro-portfolio code_challenge_method=S256 state nonce
issuer: signed in as owner@example.test, back to https://cuatro.dev/auth/callback with a code
callback: 302 to https://cuatro.dev/
cookie __Host-hub-session: host-only, Secure, HttpOnly, Path=/ on cuatro.dev
session after sign-in: 200 {"sub":"CiQwOGE4Njg0Yi1kYjg4LTRiNzMtOTBhOS0zY2QxNjYxZjU0NjYSBWxvY2Fs","email":"owner@example.test"}
== cs-tracker (provider-swap-cs-tracker:ee33c71): OIDC_ISSUER, CS_TRACKER_OIDC_CLIENT_ID, _SECRET and _OWNER_SUB (the Hub's sub)
session before sign-in: 401
sign-in: 302 to https://issuer.test:5554/auth client_id=cs-tracker code_challenge_method=S256 state nonce
issuer: signed in as owner@example.test, back to https://cs-tracker.cuatro.dev/auth/callback with a code
callback: 302 to /
cookie __Host-cs-tracker: host-only, Secure, HttpOnly, Path=/ on cs-tracker.cuatro.dev
session after sign-in: 200 {"sub":"CiQwOGE4Njg0Yi1kYjg4LTRiNzMtOTBhOS0zY2QxNjYxZjU0NjYSBWxvY2Fs","email":"owner@example.test"}
/auth/steam: 404
one identity: cs-tracker's sub equals the Hub's
== forward-auth (ops/traefik/compose.yml): OIDC_ISSUER, TRAEFIK_OIDC_CLIENT_ID and _SECRET
session before sign-in: 401
sign-in: 302 to https://issuer.test:5554/auth client_id=traefik code_challenge_method=S256 state nonce
issuer: signed in as owner@example.test, back to http://localhost:8080/oauth2/callback with a code
callback: 302 to /dashboard/
cookie __Host-traefik-dashboard: host-only, Secure, HttpOnly, Path=/ on localhost:8080
session after sign-in: 200 {"user":"CiQwOGE4Njg0Yi1kYjg4LTRiNzMtOTBhOS0zY2QxNjYxZjU0NjYSBWxvY2Fs","email":"owner@example.test"}
forwardAuth check with the session: 202
== every participant signed in at https://issuer.test:5554
```

Re-run on the committed script between 2026-10-02T23:05:14Z and 23:05:44Z: exit 0, the same lines. Without
`CS_TRACKER_IMAGE`, as CI runs it: exit 0, `cs-tracker` skipped, the Hub and forward-auth signed in. The driver also fails the run on any cookie carrying a `Domain`. Handed a wrong client secret, the Hub's
callback answers 400 and the script exits 1 (checked once, on a scratch copy). Not shown: sign-out, which dex
does not advertise (FR-22 is Story 5.5's, proven against a stand-in that does), and a real browser.

**Repeatable.** From the repository root in Git Bash or any Linux shell, with Docker and `openssl`:

```bash
docker build -f apps/hub/Dockerfile -t provider-swap-hub:local .
git -C ../cs-tracker-workspace/cs-tracker-dev archive HEAD | docker build -t provider-swap-cs-tracker:local -
HUB_IMAGE=provider-swap-hub:local CS_TRACKER_IMAGE=provider-swap-cs-tracker:local bash ops/provider-swap.sh
```

It stops if a network named `cs-tracker_default` already exists (it creates and removes its own). Without
`CS_TRACKER_IMAGE` it skips `cs-tracker` and says so. **In CI:** the `provider-swap` job in `ci.yml` builds the
Hub's image and runs the script on every push, with no account and no secret. `cs-tracker` is not in it:
its release is built from a private repository the workflow's token cannot read, and that repository has no
CI of its own (DW-14), so its half runs by hand, as above, after any change to its sign-in.

### cs-tracker's Steam sign-in (DW-326)

**What FR-23 and AD-11 require of it.** Steam OpenID 2.0 is provider-specific sign-in logic, and a Steam
session was a second identity path: with OIDC configured, `/auth/steam` still minted a session the Owner gates
admitted. FR-23 forbids the first and AD-11's one identity forbids the second, so once `cs-tracker` federates,
Steam may not answer. Built here, on `cs-tracker`'s `dev` (`f1501ac`, `ee33c71`): with all four OIDC values
set, `/auth/steam` and its callback answer what an unrouted path answers (the `:oidc_unconfigured` pipeline,
the mirror of Story 5.4's gate), a Steam session admits nothing at the HTTP gate or the live one, and the Steam
sign-out route returns to `/auth/sign-in`. Unconfigured, nothing changes: the production images of `faaa642`
and `ee33c71`, unconfigured, answered `/`, `/auth/steam`, `/auth/steam/callback`, the three OIDC paths probed
and an unrouted path identically (status, headers with `date`, `x-request-id`, cookie values and Steam's state
and return address masked, and body length; 2026-10-02T22:55:24Z). Emptying any one of the four values is the
break-glass that brings Steam back. `mix precommit` exit 0, 726 tests, 0 failures, 4 excluded; dropping the
plug's, the live gate's or the router's new check, or the sign-out's new target, each fails a case.

**What remains is a ruling** (action PS2): the Steam code itself is still in `cs-tracker`, unreachable once
configured, and FR-23's letter says an application *contains* no provider-specific logic.

### By hand

1. **PS1. Rule on how the live estate evidences FR-23.** The live estate has one issuer, and pointing it at a
   second one needs a second provider account or a self-hosted issuer on the box. Options: (a) accept the
   off-box demonstration above, run on the production artefacts and in CI, as FR-23's evidence, after
   running `ops/provider-swap.sh` once yourself; (b) a self-hosted dex on the box for one window, on a new
   proxied hostname behind Traefik, the Hub's three values pointed at it and back (a box, DNS and Traefik
   change, a new public surface for the window, and one rollout each way); (c) a second hosted provider's
   free account, with a client for the Hub, pointed at and back the same way (a new third-party account and
   terms to read). **Recommendation: (a)**, because (b) and (c) exercise the same three variables on the same
   image this run already exercised, and add a production sign-in surface, a rollout and an account to show
   it. Story 5.7 is done when this cell is dated (with (b) or (c), when that swap is recorded under § Provider
   swap run).
2. **PS2. Rule on the Steam sign-in's code** (DW-326). Options: (a) delete `/auth/steam`, its callback,
   `CsTracker.Auth.SteamOpenID` and the nonce store once CT5 is dated, keeping `STEAM_ID` (it still names the
   inventory) and making the issuer the only sign-in, with a second issuer, by configuration, as the recovery
   from an issuer outage; (b) keep the code, unreachable once configured, as the break-glass, and record
   FR-23's letter as knowingly breached in `ops/known-violations.md`. **Recommendation: (a)**, because this
   story shows the recovery (b) would keep Steam for is a change of configuration values, and Steam is itself
   a third-party provider. After CT5.
3. **PS3. Make `provider-swap` a required check on `main`.** A GitHub settings change: add it to the
   branch ruleset beside the thirteen required today, once it has passed on `main` once, and move the count
   in `AGENTS.md` § Dependency automation policy in the same change. **Recommendation: yes**, because a
   change that ties a participant to one provider then cannot merge red. Any time after Epic 5 merges.

### Provider swap run

_Not yet run._ PS1's ruling, and the live swap if (b) or (c) is ruled, are written here with the UTC time.

### Pending Operator actions, Story 5.7

| # | Action | Note | Completed (UTC) |
|---|---|---|---|
| PS1 | **Rule on how the live estate evidences FR-23**, and run the swap if (b) or (c) | Story 5.7 is done when this cell is dated | _not done_ |
| PS2 | **Rule on deleting `cs-tracker`'s Steam sign-in code** | After CT5; closes DW-326 | _not done_ |
| PS3 | **Make `provider-swap` a required check on `main`** | A GitHub settings change | _not done_ |

## The demo principal (Story 5.8)

The demo principal `demo@cuatro.dev`, how each participating application derives it, its ownership scope
and its protections are their own record, `ops/demo-principal.md`, which Stories 5.9 to 5.11 build on. What
touches this issuer is two of its actions: DP3 creates the account `demo@cuatro.dev` here, after this
record's actions 1 to 7 and H3, and records the subject the issuer assigns it as `CS_TRACKER_OIDC_DEMO_SUB`
in the local `.env`, as CT2 recorded the Owner's; DP1 asks whether the address needs a mailbox for that.
`cs-tracker` admits that subject beside the Owner's (`CsTracker.Auth.OIDC.admitted?/1`) only while it is set
and is not the Owner's. The Hub admits any subject the issuer signs in and holds nothing for it. Every
Pending Operator action of Story 5.8, DP1 to DP8, is listed in that record.
