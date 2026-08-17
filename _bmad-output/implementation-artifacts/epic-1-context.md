# Epic 1 Context: Foundation, error signal, measured capacity, and the first visible ecosystem moment

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 turns an unmonitored, unmeasured, split estate into one that runs on a single box, reports its own breakage, knows in writing what it can hold, and renders two applications on different frameworks from one shared design-token contract. It also restores the flagship: as of 2026-08-16 `cuatro.dev` was down behind a self-signed certificate on a second serving address, and consolidating it onto the Hostinger VPS is now the first thing this epic does. After Epic 1 the Operator learns of breakage from a machine rather than from a Visitor, a Visitor moving between `cuatro.dev` and `cs-tracker.cuatro.dev` sees one product family, and the repository count drops from 15 to 11. The epic is deliberately standalone: it delivers visible value with no later epic, which is the named mitigation for a solo operator abandoning a migration mid-flight.

## Stories

Twenty-one stories. **Story number is not execution position.** Story 1.21 was added on 2026-08-16 and executes first, immediately after the routing enumeration it depends on. The remaining shape is four ordered groups: gates and estate, discovery and defect prerequisites, the token contract, adoption. No story depends on a later one in execution order.

- Story 1.1: Archive the four retired repositories
- Story 1.2: External uptime and certificate-age monitoring
- Story 1.21: Restore `cuatro.dev` by completing the move onto the Hostinger VPS (executes first)
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

- **The observed topology is not the documented one.** On 2026-08-16 the estate spanned two serving addresses: three Satellite subdomains from the Hostinger VPS, and `cuatro.dev` plus `analytics.cuatro.dev` from a different address running an uncommitted Traefik. The single-box statement in the planning documents describes the target, not today. Consolidation onto the Hostinger VPS closes it, and the apex is canonical with `www` redirecting 301.
- **Nothing live may break, and one requirement is currently in breach.** The four live hostnames must serve through every step. `cuatro.dev` is in violation until it is restored, which is recorded rather than left implicit.
- **Deployment currently points at the wrong box.** The deploy workflow fires on every push to `main` and targets an opaque host secret that still resolves to the address being decommissioned. Repointing the secret and correcting the misleading step name happen in the same change, and merges to `main` are held or the workflow gated until they do.
- **Three ordering gates, each a blocking predecessor and never a parallel task.** External uptime plus certificate **age** monitoring, run off the box, exists before any automation is enabled anywhere. Age rather than expiry is the load-bearing word: Let's Encrypt lifetimes fall to 64 days in February 2027 and 45 in February 2028, so a fixed day count silently spends the safety margin. Bot mitigation is live on every live subdomain before the Suite Directory ships in Epic 2. The Capacity Gate carries a written threshold before any new application id is placed.
- **Capacity fails closed.** The gate blocks placement mechanically rather than prompting a judgement call, and stays blocked until the measurement week writes a threshold. Existing ids always deploy, so continuity is never traded against the gate. Crossing the threshold routes to a named managed-hosting overflow path. The measurement week must run against the consolidated box and after bot mitigation, or the number it produces has no referent.
- **A declared non-Postgres store carries its own offsite backup path.** `digital-library` (SQLite plus Redis) is the standing exception with no backup today, verified by a real restore rather than a zero exit code.
- **The routing table exists only on the box.** Committed proxy config routes two hostnames while more are live, across two addresses and at least two proxies. Enumerating it is a prerequisite of the greenfield rebuild and of the consolidation itself, so nothing on the old box is lost.
- **Hard bounds:** roughly $40 to $100 per month all-in, two vCPU with CPU (not RAM) as the binding constraint, one part-time operator. Any new recurring charge is a named recorded decision. First-party measurement only, no third-party analytics or tracking script anywhere.
- **Targets:** at least 99% monthly externally measured uptime, 100% of rendered applications on the contract, an estate of 11 repositories recorded with an ISO 8601 UTC date, and a written capacity threshold.
- **Operator-action stories commit their evidence.** Archiving repositories, configuring a monitor, adding bot rules and reading container stats are dashboard or shell actions, so each commits a record under `ops/`. The record is the artifact and the acceptance criteria are written against it.

## Technical Decisions

- **TLS is to terminate at Cloudflare, and does not yet.** This is a decision, not a description: as of 2026-08-17 all six live hostnames are DNS-only and TLS terminates at Caddy on the origin. Story 1.3 makes it true. When it does, every live hostname is proxied with TLS mode Full (strict), never Flexible. The origin presents one Cloudflare Origin CA certificate covering the apex and the wildcard, issued for the longest term offered, and no ACME client runs on the origin for a proxied host. Per host the order is fixed: install the Origin CA certificate, disable the ACME client, verify the host still serves, then switch the DNS record to proxied. The origin certificate's expiry is written down with a dated review because nothing renews it, and a host may not leave the proxy until a publicly trusted certificate has been issued for it first. That reversibility cost is accepted deliberately.
- **Proxying changes what an external probe sees,** so the monitoring record's expected-issuer assertion is amended in the same change that switches the records, never afterwards. An alarm caused by that change is a defect in the story, not an outage. The certificate-age half of the monitoring gate becomes moot rather than unmet once the origin stops renewing, and the record must say which.
- **Standing zone-edit credentials are retired with the mechanism they served,** and only after every host is verified serving, because revoking an issuance token fails silently at the next renewal weeks later.
- **The contract boundary is a directory.** The entire published surface is `contracts/`, served over HTTPS at a stable public URL. A contract is anything a consumer in any estate language can use with a file read and a parser. CI fails, blocking, if any executable file extension appears under `contracts/`. Generators live in `packages/` and are never published.
- **Three files, versioned together.** Tokens hold values only and name font families but carry no `@font-face`. The fonts file carries `@font-face` with `url()` relative to itself, so a vendored folder resolves at any depth. The Tailwind adapter is generated, imports Tailwind then tokens then fonts then its theme block, and its `inline` keyword is mandatory rather than stylistic.
- **Two token namespaces.** The raw palette is never consumed outside `contracts/`. The semantic role layer is the only thing consumers read. Tailwind's own colour namespace must never collide with it, or the adapter self-references and silently resolves to transparent once a bundler flattens imports.
- **Versioning is semver with strict rules:** value change minor, addition minor, any rename major (including fixing a typo in a token name), removal major. With no atomic commits across many repositories the only workable model is deprecate, migrate, remove. Consumers vendor a folder under one fixed name so a later drift check has a target rather than a search.
- **Fonts are self-hosted variable woff2, latin subset only,** within a measured gzipped budget, all open-licence because the type system is vendored into repositories including one with no Node toolchain. Metric overrides plus swap, verified by a rendered comparison rather than assumed.
- **The accessibility floor is asserted, not claimed.** Playwright runs in CI against the Hub at a 360px viewport, reading computed styles rather than screenshots. The existing Lighthouse accessibility assertion at 0.95, severity error, stays and must never be weakened. The 44px hit target is the single pixel length in the contract, deliberately, because a physical-size guarantee must not shrink with root font size. **Every CI gate is blocking and none may be downgraded to a warning**, because there is one environment and no staging: typecheck, unit tests, Registry schema validation, contract purity, the Playwright floor, Lighthouse accessibility, and colour-literal conformance. Every new gate is demonstrated failing once against a planted probe, and the probe is removed in the same story. Opacity never expresses state anywhere.
- **Every step leaves a working system, and a migration step carries nothing else.** Adding the contract without consuming it ships separately from the step that changes appearance. Host moves are read as one deploy unit moving once, and any deviation from that reading is recorded rather than assumed.
- **Settled inputs are re-checked on a bounded schedule,** and that schedule now includes the observed serving topology: which addresses the hostnames resolve to, what terminates TLS on each, and whether each record is proxied. Dates and versions are ISO 8601 UTC.

## UX & Interaction Patterns

- **The Anchor's adoption is exactly two commits.** First, wire the token and font files into the Hub's stylesheet graph and consume nothing, leaving the render identical. Second, redefine the Hub's existing custom properties as references to token roles, so every component stylesheet keeps working untouched and the whole site changes appearance in one commit touching one file. That second commit is the one worth a careful visual check. The alias layer is deliberate scaffolding that survives into Epic 2.
- **The contract palette wins over the inherited values.** Both systems are violet, so the shipped identity largely survives; what changes is that every value gains a computed contrast. One inherited property does two jobs and must be mapped per call site (ornament in some places, a state-bearing boundary in others). A family alias that silently drops weight is the known trap, so weight is set by hand at the affected call sites and proved by reading computed values, which a screenshot cannot catch.
- **Contrast is computed, not estimated.** Nothing is pure black or pure white. Decorative-only tokens are a defect if used as a meaning-bearing boundary or to carry text. Hover and focus use different tokens so a keyboard user can distinguish them.
- **The focus ring and the hit-target floor are contract-level rules.** Focus is `:focus-visible` only, never transitioned, never removed without an equivalent. The hit target is the single pixel length in the contract, deliberately, because a physical-size guarantee must not shrink with root font size.

## Cross-Story Dependencies

- **Inside the epic:** the routing enumeration runs before the consolidation, so nothing on the retiring address is lost and nothing is decommissioned before its inventory is committed. The consolidation runs before bot mitigation and before the measurement week, so the week measures the box the estate is staying on. The written threshold follows the week. Everything that adds a CI job waits on the monitoring gate, which closes only when the certificate half is settled. The adapter waits on tokens and fonts, serving the directory waits on all three files, and both Anchor migration steps plus the Phoenix adoption wait on the rendered-output harness. The Phoenix adoption also waits on the daisyUI route finding, and the version-recording story closes last.
- **The monitoring record is touched by three stories** and must stay consistent across them: it is created, amended when the proxy changes what a probe observes, and re-gathered and re-dated after the host move, with the newly kept `www` hostname joining the probe set.
- **Epic 2 depends on this epic** for the browser harness, the contract-boundary CI job, the routing enumeration, bot mitigation (the Suite Directory is a crawler amplifier and ships only behind the filter), the written capacity threshold (relocating an application is a placement), and the recorded contract version the scheduled Registry check reads.
- **Epic 3 inherits the tracked build-on-the-box item** recorded here and is where it is closed. **Epic 4** is blocked by the routing enumeration, and its `cuatro.dev` work is now a proxy change on the rebuilt topology rather than a host migration, because the host migration happens here.
