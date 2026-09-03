# Registry inputs

The confirmed field values Story 2.5 transcribes into `contracts/registry.json`: `status`,
`live`, `source`, `tech`, `demo` and `identity` for every application in the Estate, with the
method or the reason behind each one.

Written during Story `2-4-confirm-the-assumed-statuses-hostnames-and-tech-values` on
**2026-09-02** (ISO 8601 UTC), at baseline commit `d3be1562e9fe04a8a594bc8ca44dd185c68aebf7`.

**This file is a record, not Registry data**, and nothing here is a published contract surface.
The Registry is `contracts/registry.json`, hand authored under AD-4 and validated by the
blocking `registry-schema` job Story 2-3 shipped. This file is its input. Where the two
disagree once Story 2.5 has run, the Registry is what ships and this file is what should have
caught it.

**Why it exists.** `epics.md:2141` splits Story 2.4 out deliberately: each value below is an
Operator decision, and a story that needs one mid-flight is a story that escalates. Story 2.5
authors structure; this file means it transcribes rather than adjudicates.

## How to read the marking

Every value is **Observed**, with the method and the date that gathered it, or **Decision**,
with the reason and who took it. The two are never presented as the same kind of fact (NFR-9).
This is the idiom `ops/estate.md`, `ops/known-violations.md` and `ops/routing-inventory.md`
already set.

**Where the eight rulings came from.** Statuses, hostnames, the `tech` granularity, the
`identity` semantics, the `demo` values and the two count questions were put to the Operator at
Story 2-4's planning checkpoints on **2026-09-02** and answered there. Where a cell below says
"Operator ruling", that is what it cites.

## The method, and the trap it exists to avoid

**Every `tech` array was read from the manifest on the branch that carries the code, not from
the default branch and never from GitHub's language statistics.**

**Three governed repositories hold nothing but a `LICENSE` on `main`**: `cuatro-finance`,
`StreamVault` and `poketracker-go`. Their applications live entirely on `dev`. **Three more carry
a `dev` branch without their `main` being empty**: `MaiCoin`, `cuatro-tracker` and
`digital-library`, so reading `main` for those understates rather than erases. `covidmap`'s
default branch is `master` rather than `main`. The two groups are different problems and the
distinction matters: only the first three make the default branch actively misleading.

GitHub computes language statistics from the default branch, so `cuatro-finance` reports an empty
language set and one blob while its `dev` branch holds 98 blobs of Next.js, Prisma and Docker.

**Reading the default branch is what makes `cuatro-finance` look `Archived` instead of
`In progress`, and it is how half these arrays would come out empty.**

`ops/contract-adoption.md:729` noticed the same three `dev` branches on 2026-08-27 and recorded
them as not inspected. **This story does not close that limit**, and the distinction is worth
keeping straight: that record's question is whether a Dependabot or Renovate configuration sits
on those branches, and it is scoped to the default branch on purpose, because the default branch
is where an unattended merge would land. **That scoping is a Decision, not an oversight, and it
stands.** This story read the same branches for a different reason, their manifests, so the two
records looked at one tree and asked two questions. Neither answers the other's.

## Status, hostname and source

| Application | `status` | `live` | `source` resolves anonymously | Nature |
|---|---|---|---|---|
| `cuatro-portfolio` | `Live` | `https://cuatro.dev` | yes | **Observed 2026-09-02.** 200 by HTTPS request; `www.cuatro.dev` redirects to it |
| `cuatro-tracker` | `Live` | `https://tracker.cuatro.dev` | yes | **Observed 2026-09-02.** 200, redirecting to `/login` |
| `cs-tracker` | `Live` | `https://cs-tracker.cuatro.dev` | **no**, private | **Observed 2026-09-02.** 200, redirecting to Steam's OpenID form. Private repository: **KV-2** |
| `digital-library` | `Live` | `https://library.cuatro.dev` | yes | **Observed 2026-09-02.** 200, redirecting to `/login` |
| `cs-tournament` | `Live` | `https://inclusivcup.vercel.app` | **no**, private | **Observed 2026-09-02**, confirmed by Operator ruling. Resolves the `[ASSUMPTION: Live on Vercel]`. Private repository: **KV-2** |
| `list-wheel` | `Live` | `https://luigiespinosa.github.io/list-wheel/` | yes | **Observed 2026-09-02.** GitHub Pages, `gh-pages` branch, no custom domain. See the hostname section below: this value changes at Story 2.25 |
| `cuatro-finance` | `In progress` | none | yes | **Operator ruling 2026-09-02**, on evidence. Resolves the `[ASSUMPTION: built, not deployed]`. `finance.cuatro.dev` is NXDOMAIN |
| `StreamVault` | `In progress` | none | **no**, private | **Decision**, carried from PRD section 5.1. Deliberately private and not a candidate for repair: **KV-2** |
| `MaiCoin` | `In progress` | none | yes | **Decision**, carried from PRD section 5.1 |
| `poketracker-go` | `In progress` | none | yes | **Decision**, carried from PRD section 5.1 |
| `Mutuo` | `In progress` | none | **no**, private | **Decision**, carried from PRD section 5.1. Private repository: **KV-2** |
| `Lumen` | `Archived` | none | yes | **Observed 2026-09-02.** Archived on GitHub, public. `live` is forbidden on `Archived` (FR-28) |
| `tcg-tracker` | `Archived` | none | yes | **Observed 2026-09-02.** Archived on GitHub, public. Carries `absorbed_into: cuatro-tracker` |
| `connect-four-react` | `Archived` | none | yes | **Decision.** The disposition is Archived; **the repository is not archived yet**, observed 2026-09-02. Carries `absorbed_into: cuatro-portfolio` |

Every `source` is `https://github.com/LuigiEspinosa/<RepositoryName>`, spelled with the
repository's **actual** capitalisation: `.../Lumen`, `.../StreamVault`, `.../MaiCoin`,
`.../Mutuo`, and lowercase for the other ten. **Do not build it from the `id`**, because for
those four the id and the repository name cannot be the same string: see the stated limits.
A hostname is never derived from an id either (AD-3), which is why `live` is stated in full above
and why `cs-tournament` and `list-wheel` do not sit on `cuatro.dev` at all.

**Four `source` links do not resolve for an anonymous Visitor**, breaching FR-10 and SM-4. They
are recorded as **KV-2** in `ops/known-violations.md` with the ruling that they are tolerated
rather than repaired. Story 2.5 authors all four anyway, because AD-5 makes `source` required
with no exception. `StreamVault` is named there as permanently private and excluded from repair.

## `tech`, `demo` and `identity`

| Application | `tech` | `demo` | `identity` |
|---|---|---|---|
| `cuatro-portfolio` | `Next.js · React · TypeScript · Sass · Docker · Caddy` | `open` | `none` |
| `cuatro-tracker` | `Next.js · React · Prisma · PostgreSQL · Redis · BullMQ` | `none` | `none` |
| `cs-tracker` | `Elixir · Phoenix · LiveView · PostgreSQL · Oban · Docker` | `none` | `none` |
| `digital-library` | `SvelteKit · Fastify · SQLite · Redis · BullMQ · Docker` | `none` | `none` |
| `cs-tournament` | `Next.js · React · TypeScript · Supabase · PostgreSQL · Vercel` | `none` | `none` |
| `list-wheel` | `Angular · TypeScript · RxJS · GitHub Pages` | `open` | `none` |
| `cuatro-finance` | `Next.js · React · TypeScript · Prisma · PostgreSQL · Docker` | `not-deployed` | `none` |
| `StreamVault` | `Python · FastAPI · Nuxt · SQLite · Docker · Caddy` | `not-deployed` | `none` |
| `MaiCoin` | `Solidity · Hardhat · TypeScript · ethers.js · OpenZeppelin` | `not-deployed` | **`wallet`** |
| `poketracker-go` | `Go · PostgreSQL · pgx · sqlc` | `not-deployed` | `none` |
| `Mutuo` | `Bun · Vue · Drizzle ORM · Caddy · Docker` | `not-deployed` | `none` |
| `Lumen` | `Markdown · WSL2` | `not-deployed` | `none` |
| `tcg-tracker` | `Next.js · React · Prisma · PostgreSQL` | `not-deployed` | `none` |
| `connect-four-react` | `React · TypeScript · Vite · GSAP · Zustand` | `not-deployed` | `none` |

### Where each `tech` array came from

**Observed 2026-09-02**, each from the manifest on the branch named, by
`gh api repos/LuigiEspinosa/<id>/contents/<manifest>?ref=<branch>`:

| Application | Manifest | Branch |
|---|---|---|
| `cuatro-finance` | `package.json` | **`dev`** |
| `MaiCoin` | `package.json` | **`dev`** |
| `StreamVault` | `backend/requirements.txt`, `frontend/package.json`, `backend/config.py` | **`dev`** |
| `poketracker-go` | `backend/go.mod` | **`dev`** |
| `cuatro-tracker` | `package.json` | `main` |
| `cs-tournament` | `package.json` | `main` |
| `connect-four-react` | `package.json` | `main` |
| `list-wheel` | `package.json` | `main` |
| `Mutuo` | `package.json` | `main` |
| `cs-tracker` | `mix.exs` | working copy at `c:\CuatroEcosystem\cs-tracker-workspace\cs-tracker`, **not the remote** |
| `cuatro-portfolio` | this repository | working tree |

**Three of the fourteen are not in the table above, and none of them is an omission.**
`digital-library` is a **Decision**, not an observation: its array is the six values
`epics.md:2167` fixes, which the epic settled rather than this story, and the section below says
why that array was the one most worth fixing. `Lumen` and `tcg-tracker` are **Decisions** too,
for the opposite reason: they contain no code to read, and the same section explains what stands
in for a manifest in each case.

**Granularity is the Operator's ruling of 2026-09-02**: framework, store and runtime, roughly
six values, comparable across entries. It follows the shape `epics.md:2167` fixes for
`digital-library`. Test tooling, linters and type definitions are deliberately excluded, which
is why Vitest, Playwright, Karma and Jasmine appear in no array above even where they are
present and substantial.

**Stores are declared, per AD-10.** `PostgreSQL` for `cuatro-tracker`, `cs-tracker`,
`cs-tournament`, `cuatro-finance` and `poketracker-go`; `SQLite` for `digital-library` and
`StreamVault`; none for `cuatro-portfolio` and `list-wheel`, which hold no state. AD-10's
one-Postgres topology does not reach the two SQLite applications, which is forced change C-2
and already carries its own backup path.

### Three arrays that need their reasoning read, not just their values

**`digital-library` is the one the epic fixed, and the one that was wrong.**
`content/projects.ts:30` lists `Hetzner VPS`, which has been false since Story 1-21 moved the
estate off that host on 2026-08-17. `ops/known-violations.md` records it as the one surviving
stale Hetzner claim in the estate's source. **It is recorded here for correction and is not
corrected in place**: Story 2.7 retires `content/projects.ts` whole, so editing it now would be
work thrown away. The C-1 narrowing is respected: `SQLite` at `content/projects.ts:23` is
**already correct** and is not "corrected". The array above is the six `epics.md:2167` fixes.

**`Lumen` and `tcg-tracker` contain no code, and their arrays are Decisions.** Both are archived
shells. `Lumen` holds a `LICENSE` and nothing else; `tcg-tracker` is empty at zero bytes.
The schema requires `tech` to be a non-empty array, so neither can be left blank.

- **`Lumen`** is recorded from its own GitHub repository description, "a desktop Markdown
  note-taking app built for developers on WSL2". **That description names a purpose and a
  platform, not a stack, and the array reflects exactly that.** No framework was ever chosen,
  because no code was ever written. A reader must not take `Markdown · WSL2` as evidence that an
  implementation existed.
- **`tcg-tracker`** has no description either. Its array is `cuatro-tracker`'s, on the reasoning
  that PRD section 5.2 folds it in **as a domain inside `cuatro-tracker`** rather than as a
  standalone application, so the stack it would run on is that one. **This is the weakest value
  in this file.** It is an inference from a disposition, not a description and not an
  observation, and the Operator should overwrite it if the intent was something else.

## The three assumptions this story was written to settle

### `cuatro-finance`, assumed built but not deployed

**Ruled `In progress` by the Operator on 2026-09-02**, who described it as early stage and
barely started. The evidence cuts both ways and is recorded because it does:

| Reading | Evidence | Nature |
|---|---|---|
| Closer to "built" than it looks | The `dev` branch holds **98 blobs**: Next.js, Prisma, `better-auth`, Tailwind, Storybook, Vitest, a `docker-compose.yml` and a `prisma/` directory | **Observed 2026-09-02** |
| Not deployed, and not close | `finance.cuatro.dev` is **NXDOMAIN**, despite the repository's own homepage field claiming `https://finance.cuatro.dev/`. `ops/routing-inventory.md:489` records no hostname for it in the zone, correctly | **Observed 2026-09-02** |
| Not `Complete` either | `main` holds only `LICENSE`. The work has never been merged to the default branch | **Observed 2026-09-02** |

`In progress` is the right value under AD-5's four: it is neither `Live` (nothing serves),
`Complete` (the Operator says otherwise and `main` is empty) nor `Archived` (it is active).

**This makes `cuatro-finance` a fifth `In progress` application**, where `epics.md:2170` and
forced change C-10 anticipated four. Its `identity` and `demo` follow the same rule as the other
four and are `none` and `not-deployed`. The repository's `better-auth` dependency does not make
it `oidc`: see the `identity` section below.

### `cs-tournament`, assumed Live on Vercel

**The assumption was correct and had simply never been checked.** `https://inclusivcup.vercel.app`
returns 200, **observed 2026-09-02**, and the repository is a substantial polyglot codebase.
Confirmed by Operator ruling the same day, who added that details remain to be worked on, which
is consistent with `Live` and does not qualify it.

**The hostname is not on `cuatro.dev` and is recorded as it is**, per the second half of
`epics.md:2157`. `ops/routing-inventory.md:488` warns that two Vercel CNAMEs exist in the zone,
`covidmap` and `future-vizion`, and that **neither is evidence that either is `cs-tournament`**.
That warning holds: the hostname above was found on the repository's homepage field and verified
by request, not inferred from the zone. Story 4.7 and the Epic 3 merge are where it may move.

**`tech` names Vercel deliberately**, because the deployment target is the part of this
application's stack most likely to change and PRD section 5.1 marks it for migration off
external PaaS.

### `list-wheel`, whose hostname was a placeholder

**`wheel.cuatro.dev` is the chosen hostname**, ruled by the Operator on 2026-09-02. It is the
value **Story 2.25 will route** and it does not resolve today: `wheel.cuatro.dev` is NXDOMAIN,
**observed 2026-09-02**, exactly as `ops/routing-inventory.md:487` and open item O-5 describe.

**Story 2.5 must not author it.** The `live` value at authoring time is
`https://luigiespinosa.github.io/list-wheel/`, which is what actually resolves. Ruled by the
Operator on the reasoning that SM-4 requires every Registry link to resolve on every commit, and
a Registry that ships a 404 for two epics is lying in the one field a reader clicks.

**Story 2.25 changes `live` to `https://wheel.cuatro.dev` as part of the relocation**, in the
same change that makes the hostname serve. That is one line in `contracts/registry.json` and it
is that story's to make, not this one's and not Story 2-5's.

**This is a recorded deviation from `epics.md:2155-2156`, not an oversight.** That acceptance
criterion says the chosen hostname is "the value Story 2.25 will route **and Story 2.5 will
author into `live`**", which would have Story 2-5 write `wheel.cuatro.dev` immediately. The
Operator ruled otherwise on 2026-09-02, on the ground that SM-4 requires every Registry link to
resolve and the hostname will not resolve for two epics. **A reviewer checking Story 2-5 against
its epic will find the mismatch, and this paragraph is the answer**: the epic's intent, that the
Registry ends up pointing at the chosen hostname, is met one story later than its wording says.

## What changes in the first public Suite Directory: nothing

`epics.md:2150` requires this story to state the consequence, because the composition of the six
rendered entries depends on both Status answers. **It is that neither answer changes it.**

- `cuatro-finance` at `In progress` does not render. Had it been `Live` or `Complete` the
  directory would have gained a seventh entry.
- `cs-tournament` at `Live` renders, which is what the assumption already predicted. Had it been
  `Archived` the directory would have lost one.

**The six are `cuatro-portfolio`, `cuatro-tracker`, `cs-tournament`, `cs-tracker`,
`digital-library` and `list-wheel`.** Membership follows from `status` alone, by the declarative
rule FR-35 requires, with no hand-maintained second list.

**The render rule is two values, not one: FR-35 renders `Live` and `Complete`**, and holds
`In progress` and `Archived`. `contracts/registry.schema.json:59` states it and
`epics.md:86` is the requirement. **No entry in this record is `Complete`**, which is the only
reason the rendered set equals the `Live` set today, and a later reader must not read that
coincidence as the rule. Flipping `cuatro-finance` to either `Live` or `Complete` surfaces it.

## Registry membership, and the four candidates that are not entries

`ops/routing-inventory.md:1605` handed this story an AD-6 membership decision on three hostnames
that serve without an Estate row. **The Operator ruled on 2026-09-02 that none becomes a Registry
entry**, for three different reasons:

| Candidate | Ruling | Reason |
|---|---|---|
| `covidmap.cuatro.dev` | **Excluded**, subdomain retired | A real, live, public application predating the Ecosystem, in no PRD section, architecture invariant or epic. Recorded as **KV-3** |
| `future-vizion.cuatro.dev` | **Excluded**, subdomain retired | The same. Recorded as **KV-3** |
| `analytics.cuatro.dev` | **Not an application** | Serves self-hosted Umami: infrastructure this estate runs, not something the Registry describes. NFR-8 makes it the estate's only measurement, which is a different kind of fact |
| `ad-analysis.cuatro.dev` | **Nothing to admit** | **NXDOMAIN, observed 2026-09-02**, on an archived repository whose homepage field still claims it. A stale field, not a breach. Found by this story and recorded so the next enumeration does not rediscover it as a mystery |

**Why the first two could not simply be given quiet entries.** Both really are live, so the only
truthful `status` is `Live`. **No status hides them.** FR-35 renders `Live` and `Complete`, so
`Complete` would have rendered them too, and the only two values that hold an entry back are
`In progress` and `Archived`, each of which would be false. There is therefore no truthful value
that admits them to the Registry while keeping the first public directory at six. Retiring the
two subdomains removes the fact that creates the AD-6 breach, rather than omitting the
applications, which is the one resolution AD-6 forbids. **The DNS work is outstanding**, so the
breach is live until it is done: see KV-3's operator actions.

## `identity` declares participation, not mechanism

**Ruled by the Operator on 2026-09-02.** `identity` says whether an application participates in
the **Ecosystem's identity scheme**, which AD-12 makes a declared fact and never an inferred one
and FR-24 illustrates with `MaiCoin` "declared non-participating". It does not describe whatever
authentication an application happens to implement.

**Epic 5 is what introduces that scheme**, as one Clerk issuer and one OIDC client per
application. **Nothing participates yet.** So every application is `none` except `MaiCoin`, which
is `wallet`.

**Why `MaiCoin` is `wallet` and not `none`, when FR-24 calls it non-participating.** The two are
the same statement said at different strengths, and the enum is what distinguishes them. `none`
says an application does not participate and leaves open whether that is temporary. `wallet` says
it does not participate **and never will**, because its identity is a Web3 wallet signature and
there is no user record for an issuer to own. `MaiCoin` is structurally exempt rather than merely
not yet migrated, and `wallet` is the value that records the difference. The other thirteen are
`none` because Epic 5 changes most of them; `MaiCoin` keeps `wallet` through Epic 5 and after.

**This is the reading a later reader is most likely to challenge, so the four cases that make it
look wrong are named here.** Each authenticates today, and each is still `identity: none`:

| Application | What it uses today | Why it is still `none` |
|---|---|---|
| `cs-tracker` | **Steam OpenID 2.0**, observed 2026-09-02 by following the redirect from `cs-tracker.cuatro.dev` to `steamcommunity.com/openid/loginform` | OpenID 2.0 is a different protocol from OIDC, and neither is the Ecosystem scheme. FR-21 makes this the identity demonstration partner **in Epic 5**, which is when its value changes |
| `cuatro-tracker` | `next-auth` with a Prisma adapter and `bcryptjs`, observed in `package.json` | Application-local credentials. No federation with anything else in the estate |
| `cs-tournament` | Supabase auth (`@supabase/ssr`), observed in `package.json` | A third-party provider chosen per application, which is the state Epic 5 replaces |
| `cuatro-finance` | `better-auth`, observed on the `dev` branch | Not deployed, and application-local in any case |

**The alternative reading was considered and rejected because the enum cannot express it.** If
`identity` described mechanism, these four would need values, and `oidc`, `wallet` and `none` are
none of Steam OpenID 2.0, next-auth or Supabase. Adopting it would have required widening AD-5's
value set and the schema Story 2-3 shipped, which is an architecture change and not a Registry
authoring decision.

## `demo` records what a visitor can actually reach today

**Ruled by the Operator on 2026-09-02: no application currently offers a demo account.** The
four values come from Story 2-3's schema and `ops/registry-schema.md`:

- **`open`**: usable with no authentication. `cuatro-portfolio` and `list-wheel`, the only two
  deployed applications with no login.
- **`none`**: deployed, but no demo access offered. `cuatro-tracker`, `cs-tracker`,
  `digital-library` and `cs-tournament`, all four of which gate behind a login today.
- **`not-deployed`**: nothing is running to demonstrate. The five `In progress` applications and
  the three `Archived` ones.
- **`demo-account`**: usable with `demo@cuatro.dev` (AD-13). **Nothing carries it yet.** Story
  5.8 is where the demo principal contract arrives and Story 5.9 gives each application a
  baseline fixture, so this is the value that changes across Epic 5.

**`Mutuo`'s pre-existing demo accounts are recorded, and they do not change its `demo` value.**
`ops/estate.md` notes them as an asset for FR-25, and `epics.md:2175` asks for them here. The
observable part on 2026-09-02 is that the repository's `old` branch carries 145 blobs including
`kushki-integration`, `twilio-integration` and `E2E-testing` directories, which is consistent
with an application that had real accounts against real third-party integrations. **The accounts
themselves were not observed and no credential is recorded here.** `demo` stays `not-deployed`
because nothing is deployed: the accounts are an asset for FR-25 to pick up, not access a visitor
can reach today. `main` is a `bun` and Drizzle rewrite skeleton and does not carry that work.

## Stated limits

0. ~~**AD-3 cannot hold in full for four applications, and Story 2-5 hits it on its first pass.**~~
   **Resolved 2026-09-03 by an Operator ruling, before Story 2-5 authored a single entry.** The
   limit is struck rather than deleted, because the conflict it names is real and the ruling is
   what a later reader needs to find when they hit it again.

   **The conflict, as it stood.** AD-3 (`ARCHITECTURE-SPINE.md:98`) asserted two things at once: an
   id is lowercase kebab-case, **and** it equals its repository name.
   The `id` property in `contracts/registry.schema.json` enforces the first as
   `^[a-z0-9]+(-[a-z0-9]+)*$` through the blocking `registry-schema` gate, and
   `ops/__tests__/registry-schema.test.ts` pins the refusal on a capitalised id. Both are named
   rather than cited by line, which is the repair `ops/known-violations.md` already prescribes for a
   citation that drifts: this file's own line numbers moved twice while the change was being made. Four repositories are not lowercase: **`Lumen`, `StreamVault`, `MaiCoin` and
   `Mutuo`.** For those four the two halves were in direct conflict and one had to give.

   **The ruling: AD-3's second half narrows.** An id is **the repository name lowercased, keeping
   exactly the hyphens that name already carries and adding none**, so those four carry the ids
   `lumen`, `streamvault`, `maicoin` and `mutuo`. The operation is stated that precisely on purpose:
   "the kebab-case form of `StreamVault`" does not decide between `streamvault` and `stream-vault`,
   and leaving it undecided would hand the next author the same question this ruling exists to close.
   No repository is renamed, the `id` pattern is unchanged, and the gate is untouched.
   `ARCHITECTURE-SPINE.md`'s AD-3 rule and its Application identity conventions row were amended in
   the same change, so the spine and the shipped Registry now say the same thing. **The
   `contracts/registry.schema.json` `id` description was amended too**, because the gate prints a
   schema node's description in every refusal and it would otherwise have taught an author the
   superseded rule at the exact moment it refused a capitalised id.

   **The two alternatives, and why each lost.** *Rename the four repositories:* it keeps both halves
   literally true, but it is a GitHub console action outside this repository that would have blocked
   Story 2-5 outright, and three of the four are private with a `source` that does not resolve for
   an anonymous Visitor anyway (**KV-2**). *Widen the `id` pattern to accept capitals:* it edits the
   schema Story 2-3 shipped, breaks its standing refusal case, and pushes mixed case into every
   identifier AD-3 derives, the GHCR image, compose service, Traefik router, Postgres role and Clerk
   client, all of which are lowercase in practice today. The narrowing costs nothing downstream
   because nothing downstream was ever using the capitalised form.

   **The consequence to hold on to: `id` and `source` are deliberately different strings for those
   four.** The `source` values in the table above keep the repository's real capitalisation, which is
   why the drill-through still resolves. **Do not "fix" that by lowercasing the URLs**: four of them
   would 404.

1. **Nothing holds this record equal to `contracts/registry.json`.** It said the Registry was
   `applications: []` so a check would assert over nothing; that is no longer true, and the limit
   now bites: fourteen entries exist and a drift between this file and the Registry is invisible.
   It said **Story 2-5 owns that check**. **Put to the Operator on 2026-09-03 and deliberately
   deferred**, so Story 2-5 authored the entries and did not pin them. The limit stands, unowned,
   and the reason to keep reading it is that the two files are now genuinely capable of disagreeing
   where before they were not. **The nearer gap is unguarded too**: the fourteen applications are now
   listed in `ops/estate.md`'s disposition table and again in this file's two tables, and
   `ops/contract-adoption.mjs` pins only the eleven-name sentence, so a row added to one file and
   not the other is invisible today.
2. **`tcg-tracker`'s `tech` is an inference from a disposition**, as set out above. It is the one
   value in this file with neither an observation nor a description behind it.
3. **`Lumen`'s `tech` names a purpose and a platform, not a stack**, because its description
   names no stack and no code exists.
4. **`Mutuo` and `list-wheel` have no `dev` branch.** `Mutuo` carries `main` and `old`,
   `list-wheel` carries `main` and `gh-pages`. Their arrays come from `main`, which for `Mutuo`
   is a skeleton rather than the application its `old` branch holds.
5. **Twelve of the fourteen were read through the GitHub API; two were read from a local
   checkout.** `cuatro-portfolio` is this working tree, and `cs-tracker`'s `mix.exs` was read from
   a working copy at an absolute path on one machine, which no other reader can reproduce and
   which is not evidence about the remote. A manifest can also understate a stack:
   `cs-tournament`'s root `package.json` shows Next.js and Supabase while its language statistics
   also report Go and Python at over a megabyte each. Its array describes the deployed web
   application, which is what the Registry entry is about, and not every tool in the repository.
6. **Nothing here was verified against a running system except the hostnames.** Status values
   rest on what serves and what the Operator ruled, not on functional testing.
7. **The AD-6 membership sweep was scoped to the DNS zone, not to the account.** `covidmap` and
   `future-vizion` were found because they appear in the `cuatro.dev` zone that Story 1-7
   enumerated. **An ungoverned repository deployed on a third-party hostname would not have been
   caught by that method**, and `cs-tournament` at `inclusivcup.vercel.app` is proof the estate
   contains such cases. The account listing of 31 repositories bounds the problem but was not
   walked application by application for deployment status.
8. **The `tech` granularity is applied unevenly, and FR-9 makes a wrong value a defect.** The
   ruling is "roughly six", and the arrays run from two values (`Lumen`) to six. Two known
   imperfections: `Supabase · PostgreSQL` on `cs-tournament` names one store twice, since Supabase
   is Postgres, and `Next.js · React` appears in five arrays where the second adds little. The
   property most at risk is "comparable across entries", and nothing mechanically tests it.

## Handover to Story 2.5

- **Transcribe from this file, not from `ops/estate.md`**, which states disposition rather than
  field values, and not from `content/projects.ts`, which is stale and is retired by Story 2.7.
- **Fourteen entries**, one per application. The Estate's application count fell from 15 to 14 on
  2026-09-02 when `apple-music-workspace` was ruled out: it has no repository under this owner,
  re-confirmed by a full account listing, so no conforming entry with a resolving `source` was
  ever possible for it. `ops/estate.md` carries the reasoning under Counts.
- **The entry count and the repository count are different numbers**, 14 and 11, and neither
  validates the other (AD-6).
- **Author `absorbed_into`** on `tcg-tracker` (`cuatro-tracker`) and `connect-four-react`
  (`cuatro-portfolio`), each with a `source` resolving to where the code sits today, which is the
  original repository in both cases because neither fold has happened.
- **Author `family`** on the Tracker Family: `cuatro-tracker`, `cs-tracker` and `poketracker-go`,
  and **on those three only**. `epics.md:2216` is explicit that `tcg-tracker` does **not** carry
  it: it is `Archived` with `absorbed_into`, which is a different relationship from family
  membership. `ops/estate.md`'s disposition table agrees, naming the Tracker Family in the
  Registry-treatment cell of those three and not of `tcg-tracker`.
- **`id` and `name` are not settled by this record**, and `id` has a live conflict: see the
  stated limits. `description` is Story 2.6's.
- **`token_contract` is optional and two applications have one to declare.** `cuatro-portfolio`
  publishes Contract v1.0.0 and `cs-tracker` has adopted it; `ops/anchor-token-adoption.md` and
  `ops/cs-tracker-token-adoption.md` carry the adopted versions. This record does not fix the
  field's value, because AD-5 makes it optional and no requirement forces it at MVP.
- **Tighten `minItems`.** Story 2-3 left `minItems: 1` off the application list because its
  envelope shipped zero entries and would have failed its own gate. With fourteen entries
  authored, that constraint can be set, and Story 2-3 recorded it as work for this point.
- **Four `source` links will not resolve anonymously.** Author them anyway, per AD-5, and read
  **KV-2** first so it is a known cost rather than a discovery.

## The transcription happened, 2026-09-03

Story `2-5-author-contracts-registry-json` transcribed this record into `contracts/registry.json` at
baseline commit `d21f0c7`. Fourteen entries, `minItems: 1` set, and two structural rules added to the
gate. Every item in the Handover above was carried out. **Where this file and the Registry now
disagree, the Registry is what ships and this file is what should have caught it**, which is what the
preamble has said since it was written.

**What this record did not supply, and where those values came from instead.** `name` and
`description` were out of scope here, and `epics.md:2188` gives descriptions to Story 2.6. The
Registry still needs both on every entry, so Story 2-5 authored them under an Operator ruling and
recorded the source of each. **Read this before Story 2.6 runs.**

| Source | Entries | Nature |
|---|---|---|
| `EXPERIENCE.md:247-252`, verbatim | `cuatro-portfolio`, `cuatro-tracker`, `cs-tracker`, `digital-library`, `cs-tournament`, `list-wheel` | **Decision**, per the Operator's ruling that the six drafts ship as written and Story 2.6 confirms them against the running software |
| Each project's own architecture guide under `C:\Development\<project>\`, compressed to FR-8's shape | `cuatro-finance`, `streamvault`, `maicoin`, `poketracker-go`, `mutuo`, `lumen`, `connect-four-react` | **Observed 2026-09-03.** These guides are the only place in the estate that says what these applications are *for*; the PRD gives dispositions and stacks and no purpose |
| Inferred from the id, with no source behind it | `tcg-tracker` | **Decision.** The repository is empty, carries no description and has no project guide. "A trading card game collection tracker" is read off the name, which is a weaker basis than any other description in the file. Its `tech` array is weak for a *different* reason, set out above: that array is `cuatro-tracker`'s, inferred from PRD section 5.2's disposition rather than from the name |

**Three of the six verbatim drafts are contradicted by something, and Story 2.6 should start
there.** The first two were observed on 2026-09-03 by
`gh repo list LuigiEspinosa --json name,description`; the third is contradicted by the Registry
itself:

- **`cs-tracker`.** The repository describes "Personal CS2 skins tracker, single-user, local-only".
  The shipped draft says it "Tracks Counter-Strike matches and player statistics". Skins and matches
  are different things, and "local-only" sits oddly against an application serving at
  `cs-tracker.cuatro.dev`, so at least one of the two statements is stale.
- **`cuatro-tracker`.** The repository describes "a self-hosted, privacy-first media tracker" for
  "movies, TV shows, anime, manga, and video games". The shipped draft says it "Keeps a running
  record of collections and what is still missing from them", which is broader and names no medium.

- **`cuatro-portfolio`.** The draft says the Hub "Lists every application that is **running**". The
  file it describes carries five `In progress` and three `Archived` entries that are not running,
  which FR-35 holds back from the directory but which are in the Registry all the same (AD-6). The
  draft is accurate about the *rendered directory* and wrong about the Registry, and the entry
  describes the Registry's own application. **Found by reading the shipped file against its own
  description**, not by any external source, which is why it is the one of the three that could not
  have been caught before the entries existed.

**None was corrected here**, because the ruling was that the drafts ship verbatim and 2.6 confirms
them against the software rather than against GitHub metadata, which is a weaker source than either.

**One more thing for Story 2.6, which is voice rather than fact.** Five of the eight authored
descriptions end with the same sentence, "It is in early development and nothing is deployed yet."
It is true in all five cases and it spends a third of FR-8's three-sentence budget restating what
`status` and `demo` already carry on the same entry, five times over in one directory. The repetition
was accepted here because this story authors structure and 2.6 owns the voice pass; it is the
cheapest thing on that story's list.

**Three `tech` arrays look thin beside their project guides, and none was changed.** The arrays in
this record were read from the manifest on the branch carrying the code, which is evidence about what
an application runs on today; a guide is a plan. `poketracker-go`'s guide names Flutter and a Python
Discord bot beside the Go backend; `Mutuo`'s names PostgreSQL, which appears in neither this record's
array nor its store list; `Lumen`'s names Tauri, Rust and React for a repository that holds no code at
all, which is why its array stays `Markdown · WSL2`. **Recorded rather than corrected**: changing a
`tech` value is a change to this record, and FR-9 makes a wrong one a defect either way.
