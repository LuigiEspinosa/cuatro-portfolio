---
title: Cuatro Ecosystem
status: final
created: 2026-08-15
updated: 2026-08-15
amendments:
  - date: 2026-08-15
    change: 'Restyle scope change. Amends §3, §4.4, §8, §9.1, §9.2, §10, §11, §13 Q10, §14. Adds FR-36, FR-37, FR-38, SM-12, SM-C6.'
    source: '../../sprint-change-proposal-2026-08-15.md'
---

# PRD: Cuatro Ecosystem

## 0. Document Purpose

This PRD defines the **ecosystem layer** of the Cuatro Ecosystem: the hub experience at `cuatro.dev`, the App Registry, the Suite Switcher, the shared visual identity, cross-app identity, and the estate decision that reduces fifteen repositories to eight. It is written for the downstream `bmad-architecture` run, and secondarily for the solo maintainer who will do the work.

**If you are the architecture reader, start with §12.** It records every place the product framing collides with a technical decision the research already settled, and it is the section most likely to change what you build. §5 is the estate decision of record; §10 maps this PRD onto the research's Steps 0–8 so epics can be cut directly.

It deliberately does **not** re-decide how the ecosystem is built. Source layout, deployment topology, design-system strategy, identity provider and dev environment were settled by [`technical-cuatro-ecosystem-architecture-2026-08-15/research.md`](../../research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md) with cited evidence. That report answers *how*. This document answers *what it is*. Where product framing collides with a technical decision, the collision is named explicitly in §12 rather than smoothed over.

Structure: Glossary-anchored vocabulary (§3), features grouped with Functional Requirements nested and globally numbered FR-1…FR-38, cross-cutting NFRs in their own section, assumptions tagged inline as `[ASSUMPTION]` and indexed in §15. FR IDs are global and stable rather than positional, FR-35 sits beside FR-5, which it modifies. Technical mechanism, rejected alternatives and options-considered detail live in [`addendum.md`](addendum.md), this PRD states capabilities, not implementations.


---

## 1. Vision

The Cuatro Ecosystem is the working proof of a single claim: **one person built a coherent polyglot platform.** Fifteen scattered personal repositories become eight, unified at `cuatro.dev` into a suite you can walk through, a self-hosted digital library, three trackers in three different languages, a tournament manager, a finance tool, a Web3 contract, a game. Six frontend frameworks and five backend languages under one visual identity, one login, and one front door. Not fifteen links on a page. A suite, in the sense that Google Suite or Adobe Suite are suites: distinct tools that visibly belong to each other.

The variety is the point, not the debt. A component library cannot span Next.js, Svelte, Vue, Angular, Phoenix LiveView and vanilla React: Google, GitHub and Adobe all tried; two abandoned the attempt and the third maintains parallel implementations with no plan to consolidate. So the ecosystem is federated by **contracts, never by shared code**: design tokens are a *format*, OIDC is a *protocol*, CI workflows are a *reference*, and all three cross every language boundary in the estate. What emerges is something a single-framework portfolio structurally cannot demonstrate, that the author can hold a heterogeneous system together at the seams, which is most of what platform work actually is.

The audience is a hiring audience. A non-technical recruiter should be able to land, scroll, and leave in four minutes with the impression that this person ships real things that stay up. A senior engineer should be able to click from any running app into its source in one hop and find the claim holds. Everything in this document serves one of those two people, or serves the one operator who has to keep it all alive alone.

---

## 2. Target User

### 2.1 Jobs To Be Done

**Daniela: the recruiter or hiring manager, non-technical or semi-technical.**
- *Functional:* Decide in a few minutes whether this candidate is worth a conversation.
- *Functional:* See working software, not descriptions of software.
- *Emotional:* Avoid the feeling of being sold to. Wants evidence, not adjectives.
- *Contextual:* Arrives from a résumé link or a message, often on mobile, often with twelve other tabs open.

**Marcus: the senior engineer running a technical screen.**
- *Functional:* Verify the polyglot claim is real and not six `create-app` scaffolds.
- *Functional:* Get from a running app to the code that runs it without hunting.
- *Emotional:* Wants to find the seams, how the pieces are held together is the interesting part, more than any single app.
- *Social:* Will form and possibly voice an opinion to a hiring panel.

**Cuatro: the operator, and the only real product user.**
- *Functional:* Actually use `cuatro-tracker` and `cuatro-finance` for personal purposes, with one login rather than five.
- *Functional:* Know within hours when something breaks, without a user to report it.
- *Emotional:* Stop feeling that finished projects look abandoned.
- *Contextual:* Solo, indefinitely, on a fixed 2 vCPU box with no headroom to spare.

### 2.2 Non-Users (v1)

- **General consumers.** No app in the estate is being taken to market. Nothing is scoped for acquisition, retention or growth.
- **Collaborators or contributors.** Nothing assumes a second maintainer, a review queue, or an onboarding path.
- **API consumers.** The App Registry is published for the hub and for the estate's own apps. It is not a public API product with a compatibility promise to third parties.
- **Users needing accounts of their own.** Visitors get *Demo Accounts*, not personal accounts. There is no sign-up funnel.

### 2.3 Key User Journeys

**UJ-1. Daniela decides in four minutes, on her phone, between meetings.**
Daniela, a technical recruiter screening for a senior frontend role, opens `cuatro.dev` from a link in an application. She has not read the CV yet. The page opens into the scroll-driven narrative already there: a 3D scene, motion, a short arc about who built this and why. She scrolls, and rather than ending at a contact form the story *resolves into the suite*: a directory of six running applications, each with a name, a one-line description, a lifecycle Status and its `tech`. She recognises none of the app names and all of the technologies. She taps **Digital Library**, marked *Live*, and it opens, an actual library with actual books, not a screenshot. She goes back, notices the Trackers grouped together and labelled as one family built in different languages, and understands the shape of what she is looking at. She closes the tab and forwards the link.
**Climax:** the moment the narrative resolves into a grid of things that are *running*.
**Resolution:** she has an opinion, formed from software rather than from claims, and a CV route she can reach if she wants it.
**Edge case:** on a slow mobile connection the 3D narrative is the heaviest thing on the page. If it cannot start promptly she must still reach the suite, the suite is the payload, the story is the wrapper.

**UJ-2. Marcus checks whether the polyglot claim survives contact.**
Marcus, a staff engineer asked to do a thirty-minute screen, is skeptical of portfolio sites by default. He skips the narrative and goes straight to the suite. He is looking for one thing: whether "six frameworks" means real applications or tutorials. He opens `cs-tracker`, sees it is Phoenix LiveView and that it is *Live*, then clicks the source link on its Registry Entry and lands directly in the repository, not on a profile page, on the repo. He reads the commit history and the deploy configuration. He goes back, opens `digital-library`: a different framework, a different backend, and does it again. Then he notices the thing he actually cares about: the same login carried him between `cuatro.dev` and `cs-tracker` across a JavaScript/Elixir boundary, and the two apps look like the same product despite sharing no component code.
**Climax:** the realisation that the interesting artifact is the seam, not any single app.
**Resolution:** he can describe the system to a panel in two sentences.
**Edge case:** a repository he opens shows a last commit from two years ago. Its registry entry said *Complete*, so the old date confirms the entry rather than contradicting it.

**UJ-3. Cuatro logs in once and uses his own tools.**
Cuatro opens `tracker.cuatro.dev` on a Sunday to log something personal. He authenticates once. Later he opens `cuatro-finance` from the Suite Switcher in the tracker's header and is already signed in: no second login, no second password, no shared cookie hack. This is the only journey in this document with a genuine, non-demonstrative user need behind it, and there is exactly one person in it.
**Climax:** the second app opens already authenticated.
**Resolution:** two personal tools behave like two views of one product.
**Edge case:** he signs out of one app and expects to be signed out everywhere, including any Phoenix LiveView socket already open.

**UJ-4. Ana arrives sideways and discovers there is a suite at all.**
Ana is sent `library.cuatro.dev` directly by a friend who wanted a self-hosted ebook reader. She never sees `cuatro.dev`. She uses the library, likes it, and notices a small Suite Switcher in the header that says this is part of something. She opens it, sees the sibling applications she did not know existed, and follows one back to the hub.
**Climax:** a deep-linked visitor discovers the ecosystem from inside a satellite.
**Resolution:** she reaches the hub having already used one of its apps, the strongest possible order.
**Edge case:** the switcher must not imply the satellites are one application. Ana should understand these are siblings, not tabs.

*UJ-4 is the entire justification for the Suite Switcher. Without a sideways-arriving visitor, the switcher is decoration.*

---

## 3. Glossary

Downstream artifacts and readers must use these terms exactly. FRs, UJs and SMs use them verbatim; introducing a synonym anywhere is a discipline violation.

- **Cuatro Ecosystem**: the whole: the Hub, the Anchor, the Satellites, and the shared contracts binding them. The product this PRD defines.
- **Hub**: the visitor-facing site at `cuatro.dev`. The front door and the only intended entry point for a first-time Visitor.
- **Anchor**: the repository `cuatro-portfolio` in its dual role: it *is* the Hub, and it owns and publishes the shared contracts (Design Tokens, App Registry, reusable CI workflows). One repository, two responsibilities.
- **Satellite**: an independent repository that consumes the Anchor's contracts but keeps its own toolchain, language and deploy unit. Seven exist at the end state.
- **Estate**: the full set of the maintainer's repositories under ecosystem governance. Goes from 15 to 8.
- **App Registry**: the versioned manifest of every application in the Ecosystem, owned and published by the Anchor. Exactly one Registry Entry per application. The single source of truth for what the Ecosystem contains.
- **Registry Entry**: one application's record in the App Registry. Its field contract is fixed in FR-6.
- **Status**: a Registry Entry field with exactly four values: **Live**, **Complete**, **In progress**, **Archived**. States what an application *is*, never how recently it was touched. Defined in FR-7.
- **Suite Directory**: the Hub's rendering of the App Registry. What a Visitor sees; the App Registry is the data behind it.
- **Suite Switcher**: a compact cross-app navigation surface, embedded in Satellites and the Hub, that exposes the App Registry from inside any application.
- **Design Tokens**: the shared visual contract: named values for colour, type, spacing, radii, elevation and motion, published by the Anchor as a plain CSS custom-property file consumable by every framework in the Estate.
- **Token Contract**: the published shape and naming of the Design Tokens; the promise Satellites depend on.
- **Ecosystem Layer**: everything this PRD scopes: Hub, App Registry, Suite Switcher, Design Tokens, cross-app identity, Demo Access, ecosystem observability.
- **Per-App Layer:** feature work inside any individual application: behaviour, routes, data model, feature set. Explicitly out of scope (§8). Visual Restyle is *not* Per-App Layer work, because visual coherence is a property of the Ecosystem that only per-application work can deliver.
- **Token Adoption:** the mechanical act of consuming the Token Contract: vendoring the contract folder, importing the right file for the consumer's stack, and applying the per-Satellite hand-fix list. Delivers "reads as one author". Measured by FR-18.
- **Visual Restyle:** rebuilding an application's presentation layer (colour, type, spacing, borders, focus, motion, component form) against the Token Contract, in that application's own framework, so it carries the Ecosystem's component vocabulary rather than its framework's defaults. Delivers "reads as one product". Never changes behaviour, routes, data or feature set. Measured by FR-36 and SM-12.
- **Visitor**: a person browsing the Ecosystem with no account of their own. Daniela, Marcus and Ana are all Visitors.
- **Operator**: the solo maintainer. One person, named Cuatro. The only party with real product needs.
- **Demo Account**: a seeded, shared, credential-published account that lets a Visitor use a real application without registering. Not a personal account.
- **Tracker Family**: `cuatro-tracker`, `cs-tracker` and `poketracker-go`: one product family with three surviving implementations in three languages, unified through Design Tokens and a Registry grouping, never by merging code. (`tcg-tracker` folds into `cuatro-tracker` as a domain.)
- **Capacity Gate**: the measured threshold from research Step 1 that governs whether another application may be placed on the VPS. Defined in FR-33.

---

## 4. Features

### 4.1 The Hub Front Door

**Description:** `cuatro.dev` opens into the existing scroll-driven narrative (3D scene, motion, the arc of who built this) and that narrative **resolves into the Suite Directory as its climax** rather than into a contact form. One continuous scroll: who I am → what I built → here it all is, running. The CV, work history and recommendation routes survive as destinations reachable from navigation, but they are no longer where the homepage lands. Realizes UJ-1, UJ-2.

This is the decision that converts a personal portfolio into a suite hub without discarding the thing that already distinguishes it. The narrative is the wrapper; the Suite Directory is the payload.

**Functional Requirements:**

#### FR-1: Narrative resolves into the Suite Directory

A Visitor scrolling the Hub homepage reaches the Suite Directory as the terminal section of the primary scroll, without navigating away. Realizes UJ-1.

**Consequences (testable):**
- The homepage contains the Suite Directory in its own document; reaching it requires no click and no route change.
- No section follows the Suite Directory in the primary scroll except site footer content.
- The pre-existing `/cv`, `/work`, `/recommendation` and `/celeste` routes remain reachable and functional.

#### FR-2: The Suite is reachable without the narrative

A Visitor can reach the Suite Directory directly, bypassing the narrative entirely. Realizes UJ-2.

**Consequences (testable):**
- A stable in-page anchor or route resolves straight to the Suite Directory.
- The Suite Directory renders and is fully usable when the 3D narrative fails to initialise, is blocked, or is disabled by reduced-motion preference.
- Reaching the Suite Directory from a cold arrival costs at most one interaction, with no intervening scroll requirement.

#### FR-3: The Suite Directory is legible on a phone

A Visitor on a mobile viewport can read every rendered Registry Entry's name, description, Status and `tech` without horizontal scrolling. Realizes UJ-1.

**Consequences (testable):**
- At 360 px viewport width, entry name, Status and description are visible without truncation of the Status value.
- Tap targets for the live link and source link on each entry are independently addressable.

#### FR-4: The Hub declares what the Ecosystem is

The Hub states the Ecosystem's premise in prose a non-technical Visitor can parse, positioned so it is encountered before or with the Suite Directory. Realizes UJ-1.

**Consequences (testable):**
- A single statement of the Ecosystem premise exists on the homepage, encountered before or with the Suite Directory.
- It is parseable by a reader who cannot name a single one of the frameworks involved: the claim carries without the stack list.
- It is at most three sentences.

**Feature-specific NFRs:**
- The Suite Directory must reach interactive state independently of the 3D narrative's asset loading. The narrative may not block the payload.

---

### 4.2 The App Registry

**Description:** The App Registry is the Ecosystem's spine as a *product*, not just as data. A rudimentary version already exists as `content/projects.ts`: a single entry, with the shape `{ id, name, description, tech, github?, live? }`. This feature promotes it: one entry per application across the whole Estate, a fixed field contract, an honest Status taxonomy, a defined editorial voice, and publication from the Anchor so Satellites can consume it. Realizes UJ-1, UJ-2, UJ-4.

The Registry answers a question repo layout cannot: **why does this project's last commit date not matter?** A reviewer who reaches a repository by deep link from an entry marked *Complete* reads an old date as confirmation. The same reviewer reaching the same repository with no framing reads it as abandonment. Status is the mechanism that converts staleness into finishedness, and it is the highest-leverage field in this document.

**Functional Requirements:**

#### FR-5: The App Registry is exhaustive

The App Registry contains exactly one Registry Entry for every application in the Estate, including Archived and unbuilt ones. Realizes UJ-1.

**Consequences (testable):**
- Entry count equals Estate application count at all times; no application in the Estate lacks an entry.
- No Registry Entry exists for an application not in the Estate.
- Archived applications appear as entries with Status `Archived`, not by omission.
- Exhaustiveness is a property of the **App Registry** (the data). It is not a property of the **Suite Directory** (the Hub's rendering of it): see FR-35.

#### FR-35: The Suite Directory renders a curated subset

The Suite Directory presents only the applications the Ecosystem is ready to be judged on, while the App Registry behind it stays complete. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- At MVP the Suite Directory renders only entries with Status `Live` or `Complete`. Entries with Status `In progress` or `Archived` exist in the App Registry but are not rendered.
- The filter is a declarative rule over Status, not a hand-maintained second list. Changing an entry's Status to `Live` causes it to appear with no other edit.
- An application becomes visible in the Suite Directory by becoming genuinely ready, never by being added to a display list.
- The App Registry remains the complete source of truth for link verification (FR-32), the Estate record (§5), and any consumer that wants the full picture.

**Rationale: the ratio problem this solves:** four of the eight estate applications are early scaffolding today. Rendering them as `In progress` would put four open loops in a directory of ten. `In progress` is designed to warn a Visitor about *one* rough application; at four-in-ten the same honest label stops reading as transparency and starts reading as *this person starts things and does not finish them*: the exact impression the Status taxonomy exists to prevent. Six strong entries make the polyglot claim in §1 better than ten mixed ones. The taxonomy is not weakened; its rendering is scoped.

#### FR-6: The Registry Entry contract

Every Registry Entry carries a fixed set of fields, and downstream consumers may rely on their presence.

**Consequences (testable):**
- Required on every entry: `id`, `name`, `description`, `status`, `tech`, `source` (repository URL).
- Optional: `live` (deployed URL), `family` (grouping key), `demo` (Demo Access declaration), `absorbed_into`.
- `live` is required when `status` is `Live`, and forbidden when `status` is `Archived`.
- `source` is required on every entry without exception: the drill-through path from a running application to its code is the Registry's contract with Marcus.
- Validation of the contract fails the build; a malformed entry cannot ship.

**Out of Scope:**
- Screenshots, media assets, and long-form case studies. The entry is a directory record, not a case study.

#### FR-7: The Status taxonomy

`status` takes exactly one of four values, each with a fixed meaning that a Visitor can infer without a legend.

**Consequences (testable):**
- `Live`: deployed, reachable, in active use, and maintained. Requires a resolving `live` URL.
- `Complete`: finished and working; a destination, not a failure. May be deployed or not. An old last-commit date is consistent with this Status by design.
- `In progress`: actively being built; may be rough or partially broken. The Visitor is warned.
- `Archived`: read-only, retained for the record, no longer maintained.
- No fifth value is accepted by validation.
- The Hub renders Status as a visually distinct element on every entry, not buried in description prose.

#### FR-8: Editorial voice of the description

Each `description` is written to one reader in one register, consistently across all entries. Realizes UJ-1.

**Consequences (testable):**
- Written for Daniela, not Marcus: it says what the application *does for a person*, not what it is built with. The stack is the `tech` field's job.
- Between one and three sentences. No entry exceeds three.
- Plain declarative voice. No superlatives, no marketing adjectives ("powerful", "seamless", "cutting-edge"), no first person.
- Leads with the thing itself, not with a category ("A self-hosted digital library that…" not "This project is an application which…").
- `[ASSUMPTION: the existing digital-library description is ~4 sentences and stack-led; it is treated as non-conforming and rewritten under this contract rather than grandfathered.]`

#### FR-9: The `tech` field is accurate

The `tech` array reflects what the application actually runs on today. Realizes UJ-2.

**Consequences (testable):**
- Every listed technology is genuinely in use by the deployed or current version of that application.
- The `digital-library` entry's `Hetzner VPS` value is corrected before the Registry ships. **Confirmed stale:** the application was migrated to the Hostinger VPS and the entry was never updated.
- The field is read by the audience most able to detect an error in it; an inaccurate entry is treated as a defect, not a cosmetic issue.

#### FR-10: Every entry drills through to source

A Visitor can reach an application's repository from its Registry Entry in one interaction. Realizes UJ-2.

**Consequences (testable):**
- The `source` link resolves to the application's repository, not to the maintainer's profile page.
- The link is present and functional on every entry including `Archived` ones.
- Direction of travel is Hub → repository; the Registry is the entry point to source, not the reverse.

#### FR-11: The Tracker Family is grouped and explained

The three surviving Trackers are presented as one family with distinct implementations, and the framing is stated rather than left for the Visitor to infer. Realizes UJ-1.

**Consequences (testable):**
- `cuatro-tracker`, `cs-tracker` and `poketracker-go` share a `family` value in the App Registry.
- The Suite Directory renders as a labelled group whichever family members pass the FR-35 filter. At MVP that is two of three, since `poketracker-go` is `In progress`.
- The group carries a one-line statement of the framing, one product family, distinct implementations, deliberately not merged. The statement holds regardless of how many members are currently rendered and does not name a count.
- `tcg-tracker` does not appear as a family member; it appears as `Archived` with `absorbed_into` naming `cuatro-tracker`.

#### FR-12: The Registry is published as a consumable contract

The App Registry is published from the Anchor in a form any Satellite can consume without depending on the Anchor's framework. Realizes UJ-4.

**Consequences (testable):**
- The Registry is retrievable by a Satellite written in Elixir, Go, Python, Svelte, Vue or Angular without importing JavaScript from the Anchor.
- The published shape is versioned; a consumer can detect a contract change.
- The Hub itself consumes the same published Registry it publishes: no private second copy.

**Notes:**
- `[NOTE FOR PM]` The research's standing rule states the Registry "ships only after the bot filter: it is a crawler amplifier by construction." Story-then-suite makes the Registry the homepage climax, which *increases* crawler exposure. The bot filter is therefore a hard prerequisite, not a sequencing preference. See §12 and §13.

---

### 4.3 The Suite Switcher

**Description:** A compact cross-app navigation surface embedded in the Hub and in every Live Satellite, exposing the App Registry from inside any application. Its job is narrow and specific: a Visitor who arrived sideways at a Satellite should be able to discover that a suite exists and reach it. Realizes UJ-4, UJ-3.

**Functional Requirements:**

#### FR-13: Discovering the Ecosystem from inside a Satellite

A Visitor inside any Live application can open the Suite Switcher and see the Ecosystem's other rendered applications. Realizes UJ-4.

**Consequences (testable):**
- The switcher is present in every application with Status `Live`.
- Opening it lists entries drawn from the published App Registry, not from a hardcoded per-app list.
- **The switcher applies the same Status filter as the Suite Directory (FR-35).** Both surfaces render the same curated set from the same rule; an application a Visitor cannot find on the Hub is not surfaced sideways from a Satellite either.
- Each listed application is reachable in one interaction from the switcher.
- Adding an entry to the Registry causes it to appear in every switcher without per-application code changes.

#### FR-14: The switcher reads as siblings, not tabs

The Suite Switcher presents the applications as independent sibling products, never as sections of a single application. Realizes UJ-4.

**Consequences (testable):**
- Selecting an application performs a full navigation to that application's own origin.
- The switcher does not imply shared state, shared navigation history, or a common shell.
- The Hub is reachable from the switcher and is distinguishable from the applications.

#### FR-15: The switcher is cheap for a Satellite to adopt

Embedding the Suite Switcher in a Satellite costs no framework-specific component dependency on the Anchor.

**Consequences (testable):**
- A Satellite adopts the switcher by consuming the published Registry and the Design Tokens, plus its own framework-native rendering.
- No Satellite imports a component package from the Anchor in order to render the switcher.
- `[ASSUMPTION: the switcher is specified as a pattern + data contract that each Satellite implements natively, consistent with the research finding that components do not federate and contracts do. Consolidated implementation guidance belongs in architecture, not here.]`

---

### 4.4 Shared Visual Identity

**Description:** One visual identity across six frameworks, delivered as Design Tokens, named values, not shared components. This is where the Ecosystem stops being a claim and starts being visible. Two applications adopting the same tokens is the smallest change that makes the suite real to a Visitor. Realizes UJ-1, UJ-2.

The ceiling is known and accepted: tokens federate everything that is a *value*: colour, type, spacing, radii, elevation, motion. Nothing federates *behaviour*. Form controls, focus rings, overlays and dense data tables will differ between a Phoenix LiveView app and an Angular app permanently.

**Amended 2026-08-15.** Token Adoption alone delivers "reads as one author", and that remains FR-18's bar and Epic 1's acceptance condition. The Operator's decision of 2026-08-15 adds a second, higher bar: every application the Suite Directory renders is also **visually restyled** in its own framework (FR-36 – FR-38), so the suite reads as one product at the component level rather than only at the token level. This raises the ceiling; it does not dissolve it. The vocabulary is carried by a written specification implemented natively in each framework, never by shared code (§8, AD-24), and seams S-4, S-5 and S-6 (form validation states, overlays, dense data UI) stay accepted permanently.

**Functional Requirements:**

#### FR-16: One token contract, consumable by every framework in the Estate

The Anchor publishes Design Tokens in a form directly consumable by all six frontend frameworks in the Estate.

**Consequences (testable):**
- The token artifact is consumable by Next.js, React/Vite, Svelte, Vue, Angular and Phoenix LiveView without a framework-specific build step in the consuming application.
- Consumption requires no JavaScript runtime dependency on the Anchor.
- The token set covers at minimum: colour, typography, spacing, radii, elevation, motion.

#### FR-17: The Anchor consumes its own tokens

The Hub renders from the same published Design Tokens it publishes.

**Consequences (testable):**
- No colour, spacing or type value in the Hub's own styling bypasses the token contract for values the contract covers.
- `[ASSUMPTION: the Anchor is a Sass/SCSS codebase with no Tailwind. The research's token contract assumes a "Tailwind cluster" consumes a generated adapter; the Anchor is outside that cluster while owning the contract. Plain CSS custom properties are consumed natively by Sass, so this is a scoping clarification for architecture rather than a conflict. See §12.]`

#### FR-18: Visible family resemblance across at least two applications

Two applications on different frameworks visibly belong to the same product family. Realizes UJ-1.

**Consequences (testable):**
- At least two Live applications on different frameworks render from the shared tokens.
- A Visitor moving between them encounters the same palette, type scale and spacing rhythm.
- This is the acceptance condition for "the Ecosystem is visible", and it is reachable before any distribution machinery exists.

#### FR-19: Token changes propagate without breaking a Satellite silently

A change to the Token Contract cannot silently break a Satellite's layout.

**Consequences (testable):**
- Token adoption by a Satellite is an explicit, reviewed action, never an unattended automatic merge.
- The Operator can determine which Satellites are on which version of the Token Contract.
- No automated dependency merge is enabled for any repository lacking a real test suite.

#### FR-36: Visual restyle is what adoption means for a rendered application

An application the Suite Directory renders carries the Ecosystem's component vocabulary in its own framework, not only the Ecosystem's token values. Realizes UJ-1, UJ-2, UJ-4.

**Consequences (testable):**
- The application's own components (its controls, its rows, its separators, its focus treatment, its status affordances) follow the Ecosystem's component specification rather than its framework's or its component library's defaults.
- The restyle is implemented natively. No application imports a component, a class-name library, or any file from the Anchor other than the vendored contract folder.
- A restyle changes presentation only. Behaviour, routes, data and feature set are untouched, and a restyle that changes any of them is out of scope by §8.
- Verified by SM-12's per-application check, never by asserting that the token file is imported.

#### FR-37: The Anchor's components are token-native by construction

The Hub's own components are built against the Token Contract rather than migrated onto it.

**Consequences (testable):**
- No component stylesheet in the Anchor consumes a transitional alias once its component has been redesigned.
- No colour, spacing or type literal exists outside the published contract and the print stylesheet, enforced by a blocking CI check rather than by a one-time sweep.
- The transitional alias layer introduced at migration step 2 has a named removal condition (the last redesigned component) and is deleted when it is met.
- The Three.js narrative remains a declared exception (seam S-1); its colours are JS values a custom property cannot reach.

#### FR-38: Restyle follows visibility

An application earns a restyle when the Suite Directory renders it, and never before.

**Consequences (testable):**
- The trigger is FR-35's existing declarative Status filter. No second list is maintained.
- No restyle work item exists for an application with Status `In progress` or `Archived`. SM-C6 targets zero, always.
- An application becoming `Live` or `Complete` creates a restyle obligation at that moment; archiving it instead closes that obligation permanently.
- The Operator can determine, from the App Registry alone, which applications owe a restyle.

**Notes:**
- `[NOTE FOR PM]` Distribution machinery (package publishing, automated propagation, reusable workflows) is deliberately deferred. The research is explicit that a solo developer does not change tokens weekly, and that building the mechanism before any token has ever changed is speculative infrastructure. Hand-copying is the correct v1 mechanism.

---

### 4.5 Cross-App Identity

**Description:** One login across the Ecosystem, via a managed identity provider federating over OIDC. Its purpose is stated here plainly and without inflation, because the honest answer has two halves and the PRD prompt asked for a decision rather than a drift.

**It serves a real need, for exactly one person.** The Operator is the sole real user of `cuatro-tracker` and `cuatro-finance`, uses them for personal purposes, and one login across his own tools is genuinely better than five. That is a small need but it is not a fabricated one.

**And it is a demonstration, deliberately.** Proving that a single identity federates across a Next.js application and a Phoenix LiveView application (a JavaScript/Elixir boundary) is the sharpest available evidence for the polyglot claim in §1. It is portfolio value, it is *stated as* portfolio value, and it is scoped accordingly: proving the boundary crossing requires two applications, not ten.

Realizes UJ-3, UJ-2.

**Functional Requirements:**

#### FR-20: One identity across applications

A person authenticated in one Ecosystem application is recognised as the same identity by another, without re-entering credentials. Realizes UJ-3.

**Consequences (testable):**
- Authenticating at the Hub and then opening a second participating application results in an authenticated session without a credential prompt.
- Each application maintains its own host-scoped session; no session is shared by a cross-subdomain cookie.
- Identity federation is protocol-based, so a participating application's language and framework are irrelevant to it.

#### FR-21: The polyglot boundary is crossed and demonstrable

At least one JavaScript application and one non-JavaScript application participate in cross-app identity. Realizes UJ-2.

**Consequences (testable):**
- The Hub (Next.js) and `cs-tracker` (Phoenix LiveView) both participate.
- A Visitor can observe the same identity carrying across that boundary.
- This pair is the acceptance condition for the demonstration; further applications are optional, not required.

#### FR-22: Sign-out reaches every session, including open sockets

Signing out terminates the identity's sessions across participating applications, including applications holding a long-lived connection. Realizes UJ-3.

**Consequences (testable):**
- After sign-out, a previously authenticated application requires re-authentication on next interaction.
- An application holding an open persistent socket at sign-out time observes the sign-out and does not continue serving authenticated state.
- Sign-out behaviour is verified against the Phoenix LiveView case specifically.

#### FR-23: Identity is replaceable without touching application code

Changing identity provider is a configuration change, not an application rewrite.

**Consequences (testable):**
- No participating application contains provider-specific logic beyond issuer configuration and client credentials.
- The provider can be substituted by reconfiguring the issuer.

#### FR-24: Non-participating applications are declared, not silently excluded

Applications that do not participate in cross-app identity say so, rather than leaving a Visitor to discover it.

**Consequences (testable):**
- `MaiCoin` is declared non-participating. `[ASSUMPTION: it uses wallet-based authentication rather than OIDC per the research's per-project call, and is therefore structurally exempt rather than merely unimplemented.]`
- Any application with no authentication at all is declared as such in its Registry Entry rather than appearing broken.

**Out of Scope:**
- Roles, permissions, organisations, or any authorization model. This is authentication only.
- Personal Visitor accounts and any sign-up funnel.

---

### 4.6 Demo Access

**Description:** A Visitor can log in and use the real application, not look at a picture of it. Every participating application carries a seeded, published Demo Account whose credentials are discoverable from the application itself. This is the choice that makes the suite *provable* rather than merely visible, and it is also the most expensive choice in this document, it requires the applications to be running, which collides directly with unproven capacity. That collision is sized in §12.3 and gated in §9.2, not resolved by quietly shrinking the requirement. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-25: A Visitor can use a real application without registering

Every application with Status `Live` that requires authentication provides a Demo Account a Visitor can use immediately. Realizes UJ-1.

**Consequences (testable):**
- Demo credentials are obtainable from the application's own sign-in surface without leaving it.
- The Demo Account reaches the application's core function, not a stripped-down preview.
- No registration, email verification or personal data is required of a Visitor at any point.

#### FR-26: Demo state is bounded and self-recovering

Demo Account usage cannot degrade the application for the next Visitor or for the Operator.

**Consequences (testable):**
- Demo Account data is isolated from Operator data; a Visitor cannot read or modify the Operator's records.
- A defined baseline dataset exists per application: the state a Visitor should encounter on arrival.
- Demo state returns to that baseline without manual Operator intervention, within a window short enough that two Visitors arriving the same day both find a usable application. `[ASSUMPTION: the window is per-application and set by architecture; the PRD requires that a baseline and a bounded reset window exist, not that they be a specific value. See §13 Q3.]`
- A Visitor cannot delete the Demo Account or lock it out.

#### FR-27: Demo Access is declared per entry

Each Registry Entry states what a Visitor can do with that application before they click. Realizes UJ-1.

**Consequences (testable):**
- Every entry carries a `demo` declaration covering at least: usable with Demo Account / usable without authentication / not deployed.
- The declaration is accurate: an entry claiming a Demo Account has a working one.
- Applications structurally exempt from Demo Accounts (`MaiCoin`) declare their actual access model rather than being left blank.

#### FR-28: Demo Access degrades honestly under capacity pressure

When an application cannot be kept running, the Registry says so rather than offering a broken link.

**Consequences (testable):**
- An application taken offline for capacity reasons has its Status moved off `Live` and its `live` URL removed in the same change.
- No Registry Entry ever presents a `live` URL that does not resolve.
- Honesty in the Registry takes precedence over the appearance of completeness. This is the release valve that makes FR-25 compatible with the Capacity Gate.

---

### 4.7 Embedded Playable Demo

**Description:** `connect-four-react` is a finished toy that delivers more embedded in the Hub as a playable demo than it does as its own repository. It gives Daniela something to *do* within the narrative, at essentially zero infrastructure cost, on the one surface guaranteed to be running. Realizes UJ-1.

**Functional Requirements:**

#### FR-29: Playable inside the Hub

A Visitor can play Connect Four within the Hub without navigating to another application. Realizes UJ-1.

**Consequences (testable):**
- The game is fully playable in the Hub page, requiring no authentication and no external service.
- It consumes no VPS capacity beyond the Hub's own serving.

#### FR-30: Absorption is recorded, not hidden

The absorbed application's history is visible in the Registry rather than vanishing.

**Consequences (testable):**
- `connect-four-react` appears as a Registry Entry with `absorbed_into` naming the Anchor.
- Its `source` link resolves to where the code now lives.

---

### 4.8 Ecosystem Observability

**Description:** The Ecosystem has no product users to report breakage, but it is **not** without signal, a self-hosted analytics instance already runs at `analytics.cuatro.dev` and the Hub has real Visitors. This feature separates the two honestly: Visitor behaviour at the Hub *is* measurable, and per-application correctness is *not*, so the latter must be instrumented deliberately. Realizes UJ-3; underpins every metric in §11.

**Functional Requirements:**

#### FR-31: The Operator learns of breakage from a machine, not a visitor

External monitoring detects an unreachable application or an expiring certificate and notifies the Operator without a human reporting it.

**Consequences (testable):**
- Every application with Status `Live` is externally monitored for reachability.
- Certificate **age** is monitored, not only expiry, so shortening certificate lifetimes are absorbed without a surprise.
- Monitoring is external to the VPS; a whole-box failure still produces a notification.
- Monitoring exists before any automation is enabled anywhere in the Ecosystem.

#### FR-32: The Registry cannot lie

Registry Entry links are verified automatically against reality.

**Consequences (testable):**
- Every `live` URL on a `Live` entry and every `source` URL on every entry is checked on a schedule.
- A failing link raises a notification to the Operator.
- This is the mechanism by which FR-5, FR-10 and FR-28 stay true without a Visitor discovering the failure first.

#### FR-33: The Capacity Gate governs what may run

No application is placed on the VPS without measured evidence that the box can hold it.

**Consequences (testable):**
- Per-container resource usage is measured and recorded before any additional application is placed.
- A written threshold exists, and crossing it blocks further placement rather than triggering a judgement call.
- When the threshold is reached, the response is a named overflow path, not a downgrade of the Ecosystem's honesty (see FR-28).
- `[ASSUMPTION: the threshold is the research's Step 1 gate, 15-minute load average ~1.4 with today's four applications. Architecture confirms or replaces the number with measured data; the PRD requires that a written threshold exists and binds, not that it be this specific figure.]`

#### FR-34: Visitor behaviour at the Hub is measurable

The Operator can observe how Visitors move through the Hub, using first-party self-hosted analytics.

**Consequences (testable):**
- Reaching the Suite Directory is a distinguishable event from loading the homepage.
- Opening a `live` link and opening a `source` link are distinguishable events.
- Measurement is first-party and self-hosted; no third-party analytics service is introduced.
- These events are the measurement basis for SM-1 through SM-3.

---

## 5. The Estate Decision

Recorded here unambiguously because a downstream artifact must not pick up a bare number and misread a waypoint as a destination.

**The Estate goes from 15 repositories to 8.** Twelve and eleven are *sequenced waypoints*, not competing decisions.

| Point in sequence | Count | What changed |
|---|---|---|
| Today | 15 | n/a |
| After archiving | 12 | `Lumen`, `tcg-tracker`, `apple-music-workspace` archived |
| After absorption | 11 | `connect-four-react` absorbed into the Anchor |
| **End state** | **8** | `cuatro-finance`, `cuatro-tracker`, `cs-tournament` merged into the Anchor |

The research report states 15→8 in its executive summary and per-project calls, 15→12 once in its contrary-evidence section, and 15→11 in its downstream-bindings table. All three describe the same timeline at different points. **8 is the decision; 11 and 12 are stations on the way.**

### 5.1 Disposition of every repository

| Repository | Disposition | Status today | Registry treatment |
|---|---|---|---|
| `cuatro-portfolio` | **Anchor** | `Live` | The Hub itself; rendered |
| `Lumen` | Archive: empty shell | `Archived` | In Registry, not rendered |
| `apple-music-workspace` | Archive: empty shell | `Archived` | In Registry, not rendered |
| `tcg-tracker` | Archive → fold as a domain inside `cuatro-tracker` | `Archived` | `absorbed_into: cuatro-tracker`; not rendered |
| `connect-four-react` | Absorb: playable demo in the Hub | `Archived` | `absorbed_into: cuatro-portfolio`; surfaces as the embedded demo (§4.7), not as a directory entry |
| `cuatro-finance` | Merge into the Anchor | `[ASSUMPTION: built, not deployed]` | Rendered once deployed |
| `cuatro-tracker` | Merge into the Anchor | `Live`: `tracker.cuatro.dev` | Rendered; Tracker Family member |
| `cs-tournament` | Merge into the Anchor + migrate off external PaaS | `[ASSUMPTION: Live on Vercel]` | Rendered |
| `cs-tracker` | Satellite: Elixir/LiveView | `Live`: `cs-tracker.cuatro.dev` | Rendered; Tracker Family; identity demonstration partner (FR-21) |
| `digital-library` | Satellite: Svelte/Fastify | `Live`: `library.cuatro.dev` | Rendered |
| `list-wheel` | Satellite: Angular | `Live`: on GitHub Pages, **relocating to the VPS** | Rendered; see §5.3 |
| `StreamVault` | Satellite: Python/Vue | `In progress`: early scaffolding | In Registry, not rendered until Live |
| `MaiCoin` | Satellite: Solidity/Web3 | `In progress`: early scaffolding | Not rendered; declared non-participating in identity (FR-24) |
| `poketracker-go` | Satellite: Go | `In progress`: early scaffolding | Not rendered; Tracker Family |
| `Mutuo` | Satellite | `In progress`: early scaffolding | Not rendered; already carries demo accounts, a pre-existing asset for FR-25 |

**End state: the Anchor plus seven Satellites**: `cs-tracker`, `digital-library`, `StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo`, `list-wheel`.

**The first public Suite Directory renders six entries**, not fifteen and not ten: the Hub, `cuatro-tracker`, `cs-tracker`, `digital-library`, `list-wheel` and `cs-tournament`. Four applications are early scaffolding and stay in the App Registry, unrendered, until they are genuinely ready (FR-35). This is a deliberate choice to ship a smaller, stronger suite rather than a larger, mixed one.

### 5.2 On the Trackers

The Trackers are **not one product with four domains, and not four separate products. They are one product family with distinct implementations.** They unify through the Design Tokens and a Registry grouping (FR-11), never by merging code. `tcg-tracker` folds because it is empty and folding is nearly free. `cs-tracker` and `poketracker-go` stay because merging them would cost real weeks and would delete two of six frameworks from the portfolio, and the polyglot claim in §1 is the product. **Paying weeks to reduce variety is the wrong trade when variety is the thesis.**

### 5.3 `list-wheel` relocates to the VPS

`list-wheel` is deployed and working, but at `luigiespinosa.github.io/list-wheel/`: outside `cuatro.dev`. A Visitor clicking it leaves the suite's domain at the exact moment the suite framing should hold, which undercuts §1 for no benefit.

It moves onto the VPS and onto a `cuatro.dev` subdomain. `[ASSUMPTION: the application is a static Angular build (GitHub Pages serves only static assets) so hosting it costs static file serving rather than an application runtime, and its CPU cost against the Capacity Gate is close to zero. If it turns out to need a server-side runtime, it is re-gated under FR-33 like any other application.]`

---

## 6. Cross-Cutting NFRs

- **NFR-1: Solo-maintainable indefinitely.** Every scoped item must be operable by one person with no coordination. Any requirement implying a second maintainer, a review queue or an on-call rotation is out of scope by construction.
- **NFR-2: Nothing live may break.** `cuatro.dev`, `cs-tracker.cuatro.dev`, `tracker.cuatro.dev` and `library.cuatro.dev` are serving today, as is `list-wheel` on its current host. All must keep serving through every step, including `list-wheel`'s relocation (§5.3). No step may leave a broken application. **In violation as of 2026-08-16 on `cuatro.dev`**, which presents a self-signed certificate and returns 404 at `/api/health`. Closed by Story 1.21. Recorded rather than left implicit, because NFR-9 puts honesty above completeness and a requirement silently in breach is exactly the case that rule exists for.
- **NFR-3: Capacity-bound.** 2 vCPU is a hard ceiling and is unproven. No requirement may assume headroom. Where a requirement needs capacity that has not been measured, it is gated (FR-33), not assumed.
- **NFR-4: Cost-bound.** All-in spend stays within $40–100/month. The VPS is prepaid, so only marginal spend counts against this. **Clarified 2026-08-16:** the prepaid box is the **Hostinger VPS**, at $0 marginal per month, and the Operator states it is paid a year at a time. The second address running on that date is retired by Story 1.21, and its cost until then is not recorded anywhere. **The prepayment expiry needs confirming:** this document said "prepaid to 2028" while the Operator describes an annual prepayment, and an expiring prepaid VPS with no recorded renewal date is a cost cliff nothing in the plan watches.
- **NFR-5: Mobile-first for the Hub.** Daniela arrives on a phone. Hub requirements are satisfied on a mobile viewport before a desktop one.
- **NFR-6: Reduced-motion respect.** The Hub's narrative is motion-heavy. Reduced-motion preferences must be honoured without denying access to the Suite Directory (FR-2).
- **NFR-7: Crawler exposure is managed.** The Suite Directory is a crawler amplifier by construction and is now the homepage climax. Bot mitigation is a prerequisite for shipping it, not a follow-up.
- **NFR-8: First-party data only.** Visitor measurement stays self-hosted. No third-party analytics or tracking is introduced anywhere in the Ecosystem.
- **NFR-9: Honesty over completeness.** Wherever the Registry could either overstate or under-promise, it under-promises. A `Complete` entry that is honest beats a `Live` entry that is aspirational.
- **NFR-10: No unattended automation without a test suite.** Automation without users is automation without feedback. Nothing merges or deploys unattended in a repository that cannot detect its own breakage.

---

## 7. Constraints and Guardrails

**Cost.** $40–100/month all-in. The Hostinger VPS is prepaid annually at $0 marginal per month (confirmed 2026-08-16; the expiry date is unconfirmed, see NFR-4), so the live question is marginal spend: managed identity, external monitoring, and any overflow hosting. Overflow hosting for two heavy applications is budgeted at $15–30/month and stays inside the ceiling.

**Capacity.** The target platform is one Hostinger VPS, 2 vCPU / 8 GB / 100 GB, Ubuntu 24.04. **Amended 2026-08-16: as of that date the estate spans two serving addresses.** The three Satellite subdomains serve from the Hostinger VPS, while `cuatro.dev` and `analytics.cuatro.dev` serve from a different address. Story 1.21 consolidates them. Every capacity statement in this section describes the target box, and no measurement taken before consolidation describes it. The box is RAM-generous and CPU-poor, and **CPU is the binding constraint**. Only one footprint measurement exists in citable form, and it was captured during a bot crawl: an upper bound on a bad day, not steady-state demand. A week of measurement is running in parallel with this PRD. Until it lands, capacity is unknown in both directions and is treated as such.

**Operator.** One person, indefinitely, part-time. This is the constraint that kills more scope than cost or capacity.

**Feedback.** No product users means no error signal at the Per-App Layer. The Hub is the exception (§12.1). No success criterion in §11 depends on a user report.

**Privacy.** Visitors are measured in aggregate on a self-hosted instance. Demo Accounts collect nothing. No Visitor is asked for personal data at any point in any journey in this document.

---

## 8. Non-Goals

- **Not re-deciding the technical foundation.** Source layout, reverse proxy, database, identity provider and dev environment are settled inputs. The portfolio-value re-ranking question was the sole exception; it was interrogated, and the record is in [`addendum.md`](addendum.md) §A.
- **Not Kubernetes, microservices, service mesh, or multi-region.**
- **Not rewriting applications to a single framework.** The polyglot estate is the product. Framework consolidation would destroy the thesis in §1.
- **Not feature work inside individual applications.** This PRD covers the Ecosystem Layer only. What `digital-library` does with EPUB metadata is Per-App Layer and out of scope. **Presentation is the single bounded exception, added 2026-08-15.** An application the Suite Directory renders is visually restyled against the Token Contract, natively in its own framework (FR-36, FR-38), because visual coherence is an Ecosystem property that no ecosystem-layer artifact can deliver on its own. A restyle changes how an application looks and never what it does. Any change that alters behaviour, adds a screen or touches the domain model remains Per-App Layer and remains out of scope.
- **Not a public API.** The App Registry is published for the Ecosystem's own consumers. No third-party compatibility promise is made.
- **Not a user product.** No sign-up, no onboarding funnel, no retention mechanics, no growth work, no roles or permissions.
- **Not a shared component library.** Contracts federate; implementations do not. No cross-framework component package will be built, and this is a decision rather than a deferral. **The restyle programme does not reopen this.** Seven applications implementing the same component vocabulary is expected duplication, not an argument for extraction; the vocabulary federates as a written specification (AD-24), never as code.
- **Not anything requiring a second person.**
- **Not devcontainers.**

---

## 9. MVP Scope

### 9.1 In Scope

- Bot mitigation on all live subdomains: prerequisite to the Suite Directory shipping (NFR-7).
- External uptime and certificate-age monitoring (FR-31).
- Estate reduction to the 12-repository waypoint: three empty shells archived (§5).
- Capacity measurement with a written, binding threshold (FR-33).
- The App Registry as a product: full entry contract, Status taxonomy, editorial voice pass across every entry, `tech` accuracy correction, source drill-through (FR-5 – FR-12).
- The Suite Directory rendering only `Live` and `Complete` entries: a six-entry first public suite (FR-35).
- The Hub front door reshaped to story-then-suite, with the Suite Directory reachable independently of the narrative (FR-1 – FR-4).
- `list-wheel` relocated onto a `cuatro.dev` subdomain so no suite member sits on a foreign domain (§5.3).
- Design Tokens adopted by the Anchor and at least one other Live application on a different framework (FR-16 – FR-18). This remains the FR-18 acceptance condition and is satisfied by Token Adoption alone.
- **The Anchor's own components rebuilt token-native** (FR-37), replacing migration steps 3, 4, 6 and 7 rather than adding to them.
- Registry link verification (FR-32) and Hub visitor instrumentation (FR-34).

### 9.2 Out of Scope for MVP

- **Cross-app identity (FR-20 – FR-24)**: deferred to v2. Research sequences it behind a greenfield host rebuild, and it delivers nothing to Daniela. `[NOTE FOR PM: this is emotionally load-bearing, it is the sharpest evidence for the polyglot claim and you chose to state its purpose plainly rather than cut it. It is deferred by sequence, not demoted in importance. Revisit as soon as the host rebuild lands.]`
- **Demo Accounts across all applications (FR-25 – FR-27)**: deferred with identity, since most demo access depends on it. Applications that are already usable without authentication satisfy their part of FR-27 immediately.
- **Restyling any application the Suite Directory does not render.** FR-38 gates restyle on the same declarative Status filter FR-35 already applies. An unrendered application is not restyled, and no restyle work item exists for it. Restyling an invisible surface returns nothing to any Visitor and spends the Operator, who is the estate's scarcest resource. Satellite restyle itself is not deferred; it is scoped to Epic 8 and sequenced immediately after MVP (§10).
- **Building the four `In progress` applications**: `StreamVault`, `MaiCoin`, `poketracker-go`, `Mutuo` are early scaffolding with real feature work remaining. That work is Per-App Layer and out of scope by §8. They hold entries in the App Registry and stay unrendered until genuinely ready (FR-35), **and being unrendered they are also not restyled (FR-38)**. `[NOTE FOR PM: nothing in this PRD causes these four to get finished. If the intent is that they should be, that is a separate decision, and archiving one or more of them instead is a legitimate outcome, which now also closes its restyle obligation permanently. See §13 Q10.]`
- **Bringing already-built applications online**: gated behind FR-33. The Registry tells the truth about them meanwhile (FR-28).
- **The Anchor merge** (`cuatro-finance`, `cuatro-tracker`, `cs-tournament`): real work, no Visitor-visible payoff, correctly sequenced after the Ecosystem is visible.
- **Token distribution machinery**: package publishing, automated propagation, reusable workflows. Earned by three hand-copied token changes, not scheduled.
- **The Suite Switcher (FR-13 – FR-15)**: v2. It serves UJ-4, the sideways-arriving Visitor, which is the least common path and the only one that does not involve the Hub.
- **Embedded Connect Four (FR-29 – FR-30)**: v2. Delightful, not load-bearing.
- **WSL2 relocation**: Operator ergonomics, independent of everything here.

---

## 10. Sequencing

The research defines Steps 0–8. This section maps the PRD onto them so epics can be cut directly, and records where the product framing changes a step's weight.

| Step | Research content | Epic | FRs / scope |
|---|---|---|---|
| **0** | Archive three shells · buy uptime + cert monitor · bot rules on live subdomains | **Epic 1** | FR-31, §5 (→12 waypoint), NFR-7 |
| **1** | One week of measured capacity with a written gate | **Epic 1** | FR-33 |
| **2** | Hand-copy tokens into the Anchor and one other live app | **Epic 1** | FR-16, FR-17, FR-18 |
| **n/a** | *(no research step: product-layer work)* | **Epic 2** | FR-1 – FR-12, FR-35, FR-32, FR-34, §5.3 |
| **3** | Anchor merge, one application at a time | Epic 3 | §5 (→8 end state) |
| **4** | Build in CI, push images; the box stops compiling | Epic 3 | NFR-3 support |
| **5** | Greenfield VPS rebuild on the chosen proxy + one database | Epic 4 | NFR-2, NFR-3 |
| **6** | Identity: Hub first, then `cs-tracker` | Epic 5 | FR-20 – FR-24, FR-25 – FR-28 |
| **7** | Token distribution machinery: *earned, not scheduled* | Epic 6 | FR-19 |
| **8** | Repo relocation to WSL2: independent | Epic 7 | Operator ergonomics |
| **n/a** | *(no research step: added 2026-08-15 by the restyle decision)* | **Epic 8** | FR-36, FR-38 |

**Epic 1 = research Steps 0–2**, exactly as the research's downstream bindings specify. It is the foundation epic and it delivers the first visible ecosystem moment (FR-18) at its end.

**Epic 8 has no research step behind it and its number is not its position.** Epic numbers in this plan were never execution order, Epic 7 being independent of everything, and renumbering to insert an epic would churn every story key in tracking for no benefit. The execution order is: Epic 1, Epic 2, **Epic 8 wave 1** (`cs-tracker`, `digital-library`, `list-wheel`), Epic 3, **Epic 8 wave 2** (`cuatro-tracker`, `cs-tournament`), Epic 4, Epic 5, Epic 6, with Epic 7 independent throughout. Wave 2 sits after Epic 3 because AD-20 forbids a merge step from carrying anything else, so a merge target is restyled after its merge ships, never during it.

**Two product-driven changes to the research's sequencing**, both argued in §12 and stated here only as they affect the order of work:

1. **Bot mitigation is a hard prerequisite, not a cheap experiment**: it gates Epic 2 rather than sitting beside it. See §12.4.
2. **Epic 2 has no research step behind it and must ship before Epic 3.** Steps 0–2 make the Ecosystem technically real; Epic 2 makes it visible to Daniela; the Anchor merge is invisible to every Visitor in §2.3. See §12.5.

---

## 11. Success Metrics

The hard constraint: no product users, therefore no user-reported signal. **Every metric below is checkable by a machine or by first-party Hub analytics**; none requires anyone to file a report. Why Visitor-behaviour metrics are legitimate here despite that constraint is argued in §12.1.

**Primary**

- **SM-1: Suite reach.** Share of Hub sessions that reach the Suite Directory. Target ≥ 60%. Validates FR-1, FR-2, FR-34. *If the narrative is swallowing visitors before they see the suite, this catches it.*
- **SM-2: Application click-through.** Share of sessions reaching the Suite Directory that open at least one `live` application. Target ≥ 35%. Validates FR-3, FR-6, FR-8, and FR-25 from v2 onward, once Demo Access exists.
- **SM-3: Source drill-through.** Share of sessions reaching the Suite Directory that open at least one `source` link. No target: this is the *Marcus signal*, tracked to learn what fraction of visitors are technical. Validates FR-10.
- **SM-4: Registry truth.** Share of Registry Entry links that resolve, checked automatically on a schedule. Target 100%, continuously. Validates FR-5, FR-10, FR-28, FR-32. *The one metric that is pure correctness and needs no visitor at all.*
- **SM-5: Live application availability.** Uptime of every `Live` application, measured externally. Target ≥ 99% monthly, with the Operator notified before a Visitor could encounter the failure. Validates FR-31, NFR-2.

**Secondary**

- **SM-6, Token adoption breadth.** Share of applications rendered in the Suite Directory that consume the shared Token Contract. Target **100% of rendered entries**, continuously. Validates FR-16, FR-18, FR-38. *Amended 2026-08-15: this was a count with a target of ≥2, which under a restyle programme measures the floor rather than the goal, and which could be satisfied by growing the estate. A share cannot be. Adding a rendered application that has not adopted lowers this metric.*
- **SM-12, Component-level coherence.** Per rendered application, binary: does it render the Ecosystem's component vocabulary (Status mark border discipline, hairline separators, unfilled controls, the focus ring, no shadows, no gradients, accent under 3% of viewport) rather than its framework's defaults? Target: yes for every rendered application. Verified by the four manual UX checks plus a greyscale render, recorded per application. Validates FR-36, FR-37.
- **SM-7: Estate size.** Repository count under Ecosystem governance. Target 12 at MVP, 8 at end state. Validates §5.
- **SM-8: Editorial conformance.** Share of Registry Entries satisfying the description contract (≤3 sentences, reader-facing, no marketing adjectives) and carrying an accurate `tech` array. Target 100%. Validates FR-8, FR-9.
- **SM-9: Polyglot identity proof.** Binary: does one identity demonstrably cross the JavaScript/Elixir boundary? Target: yes, by end of Epic 5. Validates FR-21.
- **SM-10: Certificate headroom.** Minimum days remaining across all certificates, alerted on *age* rather than expiry. Target: never below the alerting threshold. Validates FR-31.
- **SM-11: Suite Directory strength.** Count of rendered entries, all of which must be `Live` or `Complete` with resolving links. Target 6 at MVP. Validates FR-35. *Deliberately not a growth metric: see SM-C2.*

**Counter-metrics (do not optimize)**

- **SM-C1: Time on site.** Counterbalances SM-1 and SM-2. Daniela forming a correct positive opinion in ninety seconds is a **success**, not a bounce. Time-on-site must never be optimized, and a fall in it alongside a rise in SM-2 is a good outcome.
- **SM-C2: Registry Entry count.** Counterbalances SM-7 and the temptation to look busy. The Estate is *shrinking* on purpose. Adding entries to fill the grid defeats the decision in §5. More entries is not better; accurate entries are better.
- **SM-C3: Applications wired to cross-app identity.** Counterbalances SM-9. Two applications across the JavaScript/Elixir boundary prove the thesis. Wiring all eight adds maintenance to a solo Operator for zero additional proof.
- **SM-C4: VPS load average.** Counterbalances SM-2, SM-5 and SM-6. Every attractive product move in this document: more applications Live, more Demo Accounts, richer Hub: spends CPU on a box with an unproven ceiling. When this metric and any other conflict, **this one wins** (FR-33, NFR-3). *Restyling is the one move in this document that does not spend against it: it changes bytes served, not CPU consumed.*
- **SM-C6, Applications restyled but not rendered.** Counterbalances SM-12 and the pull toward polishing surfaces nobody reaches. **Target zero, always.** A restyle that precedes rendering spends the Operator on an invisible surface. This is FR-38 expressed as a number.
- **SM-C5: Hub asset weight.** Counterbalances the narrative's ambition. The 3D story exists to frame the suite, not to compete with it; growth in page weight that delays SM-1 is a regression regardless of how good it looks.

---

## 12. Product Framing vs. the Settled Technical Decisions

Surfaced deliberately, per the PRD prompt's request to find these now rather than in architecture. Not every item below is a contradiction, two are scoping clarifications and one is a gap in the research's scope. Each says which it is.

**12.1: "No real users" is not true at the Hub layer.**
*Research position:* no real users, therefore no error signal; treated as a first-class standing risk with no available feedback loop.
*Product reality:* the Hub has real Visitors (that is its entire purpose) and self-hosted first-party analytics already run at `analytics.cuatro.dev`.
*Resolution:* the no-signal risk is correct for the Per-App Layer and wrong for the Hub. Split accordingly: per-application correctness is machine-instrumented (FR-31, FR-32), Hub behaviour is measured from real Visitors (FR-34). This is what makes §11 possible at all, and it is the largest gap between the research and reality.

**12.2: The Anchor is not a Tailwind consumer.**
*Research position:* the token contract is a plain custom-property file plus a generated adapter for "the Tailwind cluster."
*Product reality:* `cuatro-portfolio` is Sass/SCSS with no Tailwind. The Tailwind cluster is `cuatro-finance`, `cuatro-tracker` and `cs-tournament`: all of which are *merge targets*, not the Anchor as it exists today.
*Resolution:* no conflict in substance; plain custom properties are consumed natively by Sass. But research Step 2 lands in an SCSS codebase, and architecture must not assume the Anchor consumes the Tailwind adapter. Recorded at FR-17.

**12.3 (Universal Demo Access collides with unproven capacity) but less than it first appears.**
*Research position:* capacity is unknown, 2 vCPU is a 200% budget, and nothing may be scoped that assumes headroom.
*Product decision:* every application is Live with a Demo Account so a Visitor can use the real thing.
*The collision, correctly sized:* an earlier reading of this put roughly eight applications on the box concurrently, the maximum-CPU configuration of the estate, chosen before measurement. **That overstated it.** Four of the eight are early scaffolding and will not be deployed for a long time; `list-wheel` is a static build whose serving cost is close to zero; and `cs-tournament` arrives from external hosting rather than as net-new demand. Realistic near-term concurrent load is **five to six applications, of which one is static**: not eight.
*Resolution, and it does not shrink the decision:* the requirement stands as written (FR-25). What is added is a gate and a release valve. Applications come online in capacity-gated waves (FR-33); the Registry declares truthfully what is and is not reachable meanwhile (FR-27, FR-28); and if the box will not hold the estate, the answer is the named overflow path, not a silently broken link. **The research's Step 1 measurement remains a hard blocker**: the load is smaller than feared but still unmeasured, and "smaller than the worst case" is not the same as "known to fit."

**12.4: Story-then-suite re-promotes bot mitigation.**
*Research position:* the bot filter was demoted from "the cheapest capacity fix" to "a cheap experiment worth running first," because its evidence rests on a single contested thread. But a standing rule still holds: the Registry ships only after the bot filter, being a crawler amplifier by construction.
*Product reality:* the Suite Directory is now the homepage climax rather than a subpage, raising crawler exposure, and it is on the critical path for Epic 2.
*Resolution:* bot mitigation is a hard prerequisite (NFR-7). The research's own standing rule already required this; the product framing raises the stakes rather than changing the rule.

**12.5: Engineering order and product order diverge after Step 2.**
*Research position:* Step 3 is the Anchor merge.
*Product reality:* the merge is invisible to every Visitor in §2.3. The Registry-as-product work delivers the entire hiring-audience payoff and the research contains no step for it.
*Resolution:* Epic 2 is inserted between research Steps 2 and 3 (§10). Not a contradiction in fact, a gap in the research's scope, which was explicitly technical.

**12.6: `MaiCoin` cannot participate in the identity story.**
*Research position:* `MaiCoin` uses wallet authentication, not OIDC.
*Product decision:* one login across the Ecosystem, with Demo Accounts everywhere.
*Resolution:* `MaiCoin` is declared structurally exempt rather than left looking unimplemented (FR-24, FR-27). A declared exception is a design statement; an undeclared one is a bug.

**12.7: A suite member lives outside the suite's domain.**
*Research position:* subdomain routing on `cuatro.dev` is the incumbent and everything runs on one VPS.
*Product reality:* `list-wheel` is deployed and working on GitHub Pages at a `github.io` URL, which the research's estate model does not account for.
*Resolution:* it relocates to a `cuatro.dev` subdomain on the VPS (§5.3). Domain coherence is part of what makes the Ecosystem read as one product, and a suite member on a foreign domain breaks that at the click. The capacity cost is expected to be negligible because the artifact is static, but it is still gated by FR-33 rather than assumed free.

---

## 13. Open Questions

1. **Does the estate fit on 2 vCPU?** Unanswerable until the measurement week completes. Blocks the scale of FR-25 and the pace of §10 Steps 5–6. *Closes by: the running `docker stats` week and a written threshold.*
2. ~~Is `digital-library` actually on Hostinger?~~ **Closed 2026-08-15.** The `Hetzner VPS` value is stale copy; the application was migrated to the Hostinger VPS. Correction required by FR-9. **Reopened in scope 2026-08-16.** That finding was verified for `digital-library` only and was then generalised into a whole-estate statement in §7 and into the architecture spine's topology diagram. `cuatro.dev` was never checked, and on 2026-08-16 it was still serving from the other host and was down. The single-application answer stands; the generalisation did not. See `sprint-change-proposal-2026-08-16.md`.
3. **What is the Demo Account reset mechanism per application?** FR-26 states the requirement; the mechanism differs per stack and is an architecture question. *Closes by: architecture.*
4. **What is the published form of the App Registry?** FR-12 fixes the requirement (consumable by six frameworks without a JS dependency) and deliberately does not pick the format. *Closes by: architecture.*
5. **Which second application adopts tokens at Step 2?** `cs-tracker` maximises the polyglot proof (Elixir); `digital-library` is likely the cheapest (Svelte). *Closes by: Operator choice at Epic 1.*
6. ~~Do the currently-offline applications still build?~~ **Closed 2026-08-15.** `list-wheel` is built and deployed (GitHub Pages, relocating per §5.3). `StreamVault`, `MaiCoin`, `poketracker-go` and `Mutuo` are early scaffolding with real feature work remaining: Status `In progress`, unrendered per FR-35.
7. **Does the Hub's narrative survive the reduced-motion path intact?** FR-2 requires the Suite Directory to be reachable regardless; whether the narrative gets a static fallback or is simply skipped is undecided.
8. **What happens to `/cv`, `/work`, `/recommendation` and `/celeste` in the reshaped front door?** They survive as routes (FR-1) but their prominence in navigation is unspecified.
9. **What are the real Status values for `cuatro-finance` and `cs-tournament`?** Assumed built-but-not-deployed and Live-on-Vercel respectively (§5.1). Both are rendered-or-not decisions under FR-35 and both are assumptions, not confirmations. *Closes by: Operator confirmation.* Blocks the exact composition of the first public Suite Directory.
10. **Do the four `In progress` applications get finished, and on what trigger?** Building them is Per-App Layer and out of scope here (§8), so nothing in this PRD causes them to happen. They stay unrendered indefinitely by default. *Closes by: an Operator decision outside this document, including, legitimately, deciding that some should be archived instead of built.* **New input, 2026-08-15:** under FR-38 each of these four now imports a *visual restyle* as well as feature work at the moment it becomes rendered. Archiving one closes both obligations permanently. This does not decide the question, but it raises the price of finishing and lowers the price of archiving, which is new information for a decision this document deliberately left open.
11. **Do the settled inputs still hold when the later steps run?** The research sets `refresh_after: 2026-11-15` and states that a selection report older than two quarters should be refreshed before being acted on. §10 Steps 5–8 will plausibly execute after that date against decisions this PRD treats as settled. *Closes by: re-checking the research before starting Step 5.*

---

## 14. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| The box cannot hold the estate; Demo Access is unachievable at scale | **High** | Capacity Gate (FR-33) + honest Registry degradation (FR-28) + named overflow path |
| No error signal at the Per-App Layer; failures persist unnoticed | **High** | External monitoring before automation (FR-31); automated Registry link verification (FR-32) |
| Solo Operator abandons the effort mid-migration, leaving a half-state | **High** | Every step leaves a working system (NFR-2); Epic 1 delivers visible value in its own right |
| The Registry drifts from reality and a Visitor finds a dead link | **Medium** | FR-32 verification; NFR-9 honesty-over-completeness |
| Certificate lifetimes shorten and a renewal fails silently | **Medium** | Alert on certificate *age*, not expiry (FR-31, SM-10) |
| Crawler load from the Suite Directory consumes scarce CPU | **Medium** | Bot mitigation as hard prerequisite (NFR-7) |
| Token changes break Satellite layouts with nobody to notice | **Medium** | No unattended automation (NFR-10, FR-19); adoption is explicit |
| Six frameworks read as incoherence rather than as range | **Medium** | The claim is stated, not left to inference (FR-4, FR-11); tokens deliver visible family resemblance (FR-18) |
| The restyle programme drifts into the shared component library §8 rules out | **Medium** | Five native implementations of one vocabulary is the first configuration where that argument has a real premise. AD-24 forbids it and names the evidence; the vocabulary federates as a written specification, which is a required UX deliverable rather than optional documentation. If that specification is not written, this is the decision that breaks first |
| Five hand-written implementations of one vocabulary drift apart over time | **Medium** | SM-12 checks each rendered application against the same specification, recorded per application; AD-19's manual accessibility pass extends to every restyled application rather than to `cs-tracker` alone |
| Unfinished projects on display read as "starts things, doesn't finish them" | **Medium** | Suite Directory renders only `Live` and `Complete` (FR-35); the four scaffolded applications stay in the Registry, unrendered |
| The four `In progress` applications never get finished and the suite stays at six | **Low** | Accepted. Six strong entries satisfy §1; growth is not a goal (SM-C2). Archiving them is a legitimate outcome (§13 Q10) |
| Speculative infrastructure built before it is earned | **Low** | Distribution machinery gated on three real hand-copied changes (§9.2) |

---

## 15. Assumptions Index

- **§4.2 / FR-8**: The existing `digital-library` description does not conform to the editorial contract and is rewritten rather than grandfathered.
- **§4.3 / FR-15**: The Suite Switcher is specified as a pattern plus a data contract, implemented natively per Satellite; no shared component package is introduced.
- **§4.4 / FR-17**: The Anchor is Sass/SCSS and consumes plain custom properties directly, sitting outside the Tailwind cluster while owning the Token Contract.
- **§4.5 / FR-24**: `MaiCoin` is structurally exempt from OIDC participation because it uses wallet-based authentication, not merely unimplemented.
- **§4.6 / FR-26**: The Demo Account reset window is per-application and set by architecture; the PRD requires that a defined baseline and a bounded reset window exist, not that they be specific values.
- **§4.8 / FR-33**: The Capacity Gate threshold is the research's Step 1 figure until measurement replaces it; the PRD requires that a binding written threshold exist, not that it be that specific number.
- **§5**: 15→8 is the decision; 12 and 11 are waypoints. The research's `15→11` downstream-bindings row names a waypoint without labelling it as one.
- **§5.1**: `cuatro-finance` is built but not deployed, and `cs-tournament` is Live on external hosting. Both are inferred from the research and from the four known live subdomains; neither is confirmed. See §13 Q9.
- **§5.3**: `list-wheel` is a static Angular build, since GitHub Pages serves only static assets, so relocating it to the VPS costs static file serving rather than an application runtime.
- **§9.2**: Cross-app identity and universal Demo Access are deferred by *sequence*, following the research's own ordering behind the host rebuild, not demoted in importance.
- **§11**: Hub Visitor analytics are available and first-party, making Visitor-behaviour metrics legitimate despite the absence of product users.
- **§12.3**: Near-term concurrent VPS load is five to six applications rather than eight, because four are unbuilt and one is static. The Capacity Gate still binds; the load is smaller than feared, not known to fit.
