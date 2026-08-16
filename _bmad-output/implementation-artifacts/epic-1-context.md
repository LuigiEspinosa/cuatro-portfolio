# Epic 1 Context: Foundation, error signal, measured capacity, and the first visible ecosystem moment

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 turns an unmonitored, unmeasured estate into one with a machine-generated error signal, a written capacity limit, and a shared design-token contract that two applications on different frameworks both render from. After it the Operator learns of breakage from an external monitor rather than from a Visitor, knows in writing what the two-vCPU box can hold before anything new is placed on it, and a Visitor moving between `cuatro.dev` and `cs-tracker.cuatro.dev` sees two applications that visibly belong to one product family. The repository count drops from 15 to 11. The epic is standalone: it delivers visible value with no later epic, which is the named mitigation for a solo operator abandoning a migration mid-flight.

## Stories

Four ordered groups: prerequisite gates and estate (1.1 to 1.6), discovery and defect prerequisites (1.7 to 1.10), the token contract (1.11 to 1.16), adoption (1.17 to 1.20). No story depends on a later one.

- Story 1.1: Archive the four retired repositories
- Story 1.2: External uptime and certificate-age monitoring
- Story 1.3: Bot mitigation on the four live subdomains
- Story 1.4: The Capacity Gate exists and fails closed
- Story 1.5: Capacity measurement week
- Story 1.6: Write the Capacity Gate threshold and open the gate
- Story 1.7: Enumerate the deployed routing table on the box
- Story 1.8: An offsite backup path for `digital-library`
- Story 1.9: Record the build-on-the-box violation as a tracked item
- Story 1.10: Install Playwright and establish the rendered-output harness
- Story 1.11: Publish `contracts/tokens.css` from `packages/tokens`
- Story 1.12: Publish `contracts/fonts.css` with latin-subset faces
- Story 1.13: Publish `contracts/tailwind.css`, the generated `@theme inline` adapter
- Story 1.14: CI enforces the contract boundary
- Story 1.15: Determine `cs-tracker`'s daisyUI adoption route
- Story 1.16: Serve `contracts/` at `https://cuatro.dev/contracts/`
- Story 1.17: Anchor migration step 1, add the contract, change nothing
- Story 1.18: Anchor migration step 2, alias the old names onto the token roles
- Story 1.19: `cs-tracker` adopts the token contract
- Story 1.20: Record the adopted contract version and the automation policy

## Requirements & Constraints

- **One contract, every framework.** Published tokens must be consumable by Next.js, React, Svelte, Vue, Angular and Phoenix LiveView with no framework-specific build step in the consumer and no JavaScript runtime dependency on the Anchor. Coverage floor: colour, typography, spacing, radii, elevation, motion. The Anchor itself must render from the contract, with no value bypassing it for anything the contract covers.
- **Family resemblance is the acceptance condition,** and it is satisfiable by token adoption alone. Do not raise it to mean "restyled": that separation is load-bearing, because raising it would make this epic depend on later epics and destroy its standalone value.
- **Nothing live may break.** Four hostnames (`cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`, `library.cuatro.dev`) serve through every step of every story.
- **Three ordering gates, each a blocking predecessor and never a parallel task.** External uptime plus certificate-*age* monitoring exists before any automation is enabled anywhere. Bot mitigation is live on every live subdomain before the Suite Directory ships in Epic 2. The Capacity Gate carries a written threshold before any new application id is placed.
- **Capacity fails closed.** The gate blocks placement mechanically rather than prompting a judgement call, and stays blocked until the measurement week writes a threshold. Existing ids always deploy, so continuity is never traded against the gate. Crossing the threshold routes to a named managed-hosting overflow path, never to reduced honesty about what is running.
- **Monitoring runs off the box** so a whole-box failure still alerts, and watches certificate age rather than expiry because certificate lifetimes shorten in 2027 and 2028.
- **A declared non-Postgres store carries its own offsite backup path.** `digital-library` (SQLite plus Redis) is the standing exception with no backup today, which is a data-loss defect until closed.
- **The routing table exists only on the box.** Committed proxy config routes two hostnames while four are live. Enumerating the real table is a prerequisite of the later VPS rebuild, done here because it is cheap.
- **The box compiles today, in violation of settled policy** (deploy runs a build over SSH on the serving host). Epic 1 records this as a tracked item; Epic 3 fixes it.
- **Adoption is explicit and recorded.** No unattended dependency automation in any repository lacking a real test suite. Each satellite's adopted version is declared in its Registry entry and verifiable against the version header in its vendored contract copy.
- **Hard bounds:** roughly $40 to $100 per month all-in, two vCPU with CPU (not RAM) as the binding constraint, one part-time operator. Any new recurring charge is a named recorded decision. First-party measurement only, no third-party analytics script anywhere.
- **Targets:** at least 99% monthly externally measured uptime, 100% of rendered applications on the contract, an estate of 11 repositories recorded with an ISO 8601 UTC date, and a written capacity threshold.
- **Operator-action stories commit their evidence.** Archiving, buying a monitor, adding bot rules and reading container stats are dashboard or shell actions, so each commits a record under `ops/`. The record is the artifact and the acceptance criteria are written against it.

## Technical Decisions

- **The contract boundary is a directory.** The entire published surface is `contracts/`, served at `https://cuatro.dev/contracts/`. A contract is anything a consumer in any estate language can use with nothing but a file read and a parser. CI fails, blocking, if any file under `contracts/` matches `\.(ts|js|tsx|jsx|mjs|cjs)$`. Generators live in `packages/` and are never published.
- **Three files, versioned together.** `tokens.css` holds values only and names font families but contains no `@font-face`. `fonts.css` holds `@font-face` with `url()` relative to itself. `tailwind.css` is a generated `@theme inline` adapter importing both, in fixed order: Tailwind, tokens, fonts, theme block. The split exists because font URLs resolve relative to the stylesheet and satellites vendor at different depths, so a merged file 404s its fonts silently and falls back to a system stack that looks almost right.
- **Consumers vendor a folder named exactly `cuatro-contracts/`,** never individual files and never another name; the fixed name is what makes cross-repository version verification implementable. Tailwind consumers import the adapter, non-Tailwind consumers import tokens plus fonts, and the SCSS Anchor takes the plain pair. A consumer adopts the whole contract or none of it, but that binds the import only, not any restyle.
- **Two token namespaces.** The raw OKLCH palette (dark only, single anchor hue, no light theme) is never consumed outside `contracts/`. The semantic `--token-*` role layer is the only thing consumers read; reaching for a raw value is a defect. The prefix is load-bearing: Tailwind's own colour namespace must never collide with it or the adapter self-references and silently resolves to transparent once a bundler flattens imports. `inline` on the `@theme` block is mandatory, not stylistic, and its absence fails silently.
- **Non-colour categories** each carry their own prefix: type families and scale, weights, line height, tracking, 4pt-base spacing, radii, stroke widths and focus offset, elevation expressed as lightness rather than shadow, motion, z-layers. A `prefers-reduced-motion` block ships inside `tokens.css`, so every adopter gets reduced-motion compliance for token-driven transitions for free.
- **The scrim role ships inside v1.0.0,** not as a later addition, because a token present at first publication is not an addition. It is the single translucent value in the contract, a bounded exception justified because its ground is a 3D scene whose colours are JavaScript values. Alpha lives on the raw palette entry, never on the role. It is consumed in Epic 2.
- **Versioning is semver with strict rules:** value change minor, addition minor, any rename major (including fixing a typo in a token name), removal major (which is why an unused-but-declared token stays declared). With no atomic commits across eight repositories the only workable model is deprecate, migrate, remove. The version lives in the file header comment and the Registry field, never in a filename.
- **Fonts are self-hosted variable woff2, latin subset only,** budgeted around 120 KB gzipped across three faces, all open-licence precisely because the type system is vendored into repositories including a Phoenix app with no `node_modules`. Use swap with metric overrides so the swap does not shift layout. Verify fonts by checking they actually loaded, never by reading computed font-family, which passes identically when every file has 404'd.
- **The Phoenix consumer needs both artifacts.** `cs-tracker` runs Phoenix 1.8.7 with Tailwind v4 and daisyUI, so it is a Tailwind consumer: vendor all three files, import tokens and fonts for raw consumption, and apply the adapter. The open question is whether the daisyUI theme plugin accepts a `var()` reference; it is undocumented and settled empirically in a scratch app. The fallback maps daisyUI variables to roles in plain CSS on a `[data-theme]` selector. Both render identically, and the test gates the step, not the contract.
- **The accessibility floor is asserted, not claimed.** Playwright runs in CI against the Hub at a 360px viewport. It is a real new dependency: the package exists only transitively in the lockfile today. The existing Lighthouse accessibility assertion at 0.95, error severity, stays and must not be weakened. Opacity never expresses state anywhere.
- **One environment, no staging, every CI gate blocking,** none permitted as a warning: typecheck, unit tests, Registry schema validation, contract purity, the Playwright floor, Lighthouse accessibility, colour-literal conformance.
- **Layout:** `packages/tokens` generates the contract and is never published; `contracts/` is the published surface; `ops/` holds operator records, including the capacity gate file (measurement, baseline, threshold, reading, status, overflow, placement log) that the deploy workflow reads. Dates and versions are ISO 8601 UTC.
- **Every step leaves a working system, and a migration step carries nothing else.** Ship "add the contract, change nothing" separately from the step that changes appearance.

## UX & Interaction Patterns

- **The Anchor's adoption is exactly two commits.** First, drop the token and font files into the Hub's SCSS tree and reference them without consuming anything, leaving the site byte-identical. Second, redefine the Hub's existing custom properties as references to token roles, so all fifteen component stylesheets keep working untouched and the whole site changes appearance in one commit touching one file. That second commit is the one worth a careful visual check. The alias layer is deliberate scaffolding that survives into Epic 2 and is deleted only after the last Hub component is redesigned.
- **The contract palette wins over the inherited cybercore values,** with a value-by-value mapping that already exists and drives the alias step. Both systems are violet, so the shipped identity largely survives; what changes is that every value gains a computed contrast. Five mapped values are alpha expressing state, which is barred, so they resolve to flat tokens. One inherited property does two jobs and must be mapped per call site (ornamental in some places, a boundary in others). Two properties with zero call sites are dropped outright rather than migrated.
- **Contrast is computed, not estimated.** Two tokens are decorative-only and are a defect if used as a meaning-bearing boundary or to carry text. Nothing is pure black or pure white. Changing a ground means recomputing every pairing, because the lightness ladder is only four steps wide. Hover and focus use different tokens so a keyboard user can distinguish them.
- **The focus ring and the 44px hit target are contract-level rules.** Focus uses `:focus-visible` only, is never transitioned, is never removed without an equivalent, and is never replaced by a ground change. The hit target is the only pixel length in the contract, deliberately, because a target floor is a physical guarantee that must not shrink with root font size; it applies on both axes and needs inline-flex with block padding, not padding on a plain inline element.

## Cross-Story Dependencies

- **Inside the epic:** the measurement week runs only after bot mitigation is live so it measures real traffic, and the written threshold follows the week. Everything adding a CI job waits on monitoring, since that gate governs enabling automation anywhere. The adapter waits on tokens and fonts; serving the directory waits on all three files; both Anchor migration steps and the Phoenix adoption wait on the rendered-output harness, because claiming a visual result without asserting it is forbidden. The Phoenix adoption also waits on the daisyUI route decision, and the version-recording story closes last.
- **Epic 2 depends on this epic** for the Playwright harness (its hit-target and status-mark assertions), the contract-boundary CI job (the Registry schema gate builds on it), the routing enumeration (source of truth for confirming hostnames), bot mitigation (the Suite Directory is a crawler amplifier and ships only behind the filter), the capacity threshold (relocating an application is a placement), monitoring plus the recorded contract version (the scheduled Registry verification checks vendored versions against declared ones), and the alias layer plus font file (the component redesigns build on both).
- **Epic 4 is blocked by the routing enumeration:** a greenfield rebuild cannot preserve four subdomains it cannot enumerate from source.
- **Epic 3 inherits the tracked build-on-the-box item** recorded here, and is where it is actually closed.
- **Epic 6's distribution machinery is deferred,** earned by three hand-copied token changes actually performed. Shipping the scrim role inside v1.0.0 rather than as a later addition removes one of the three candidates.
