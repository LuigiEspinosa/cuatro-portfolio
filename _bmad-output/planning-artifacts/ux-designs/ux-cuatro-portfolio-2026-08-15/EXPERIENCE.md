---
name: Cuatro Ecosystem
status: final
updated: 2026-08-16
amended-2026-08-16: 'O-16 closed by the epics restyle pass.'
design: ./DESIGN.md
restyle-spec: ./RESTYLE-SPEC.md
form-factor: web, mobile-first, multi-surface
ui-system: 'none: no shared component package exists or will exist'
sources:
  - ../../prds/prd-cuatro-portfolio-2026-08-15/prd.md
  - ../../prds/prd-cuatro-portfolio-2026-08-15/addendum.md
  - ../../research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md
  - ../../ecosystem-ux-prompt.md
---

# EXPERIENCE.md, Cuatro Ecosystem

How the Cuatro Ecosystem behaves. Visual identity (colour, type, space, shape, elevation,
the Token Contract itself) is in [`DESIGN.md`](DESIGN.md), referenced here as
`{token.name}`. The framework-agnostic component vocabulary every restyled application
implements is in [`RESTYLE-SPEC.md`](RESTYLE-SPEC.md).

**This file wins on conflict** with any mock, wireframe or import, and with `RESTYLE-SPEC.md`
on any question of behaviour.

Reference renders. **The spines win on conflict with all of them:**

| File | Illustrates |
|---|---|
| [`mockups/key-screens.html`](mockups/key-screens.html) | Homepage both paths, Suite Directory mobile + desktop, Registry Entry states, Suite Switcher |
| [`mockups/secondary-screens.html`](mockups/secondary-screens.html) | `/cv`, `/work`, `/recommendation`, `/celeste` |
| [`mockups/redesigned-components.html`](mockups/redesigned-components.html) | **The redesigned Hub components**: the target for Stories 2.27–2.34 |
| [`mockups/directions-4.html`](mockups/directions-4.html) | The four directions considered; **C was chosen** |

---

## Foundation

**Form factor.** Web, **mobile-first**, multi-surface. Daniela arrives on a phone (NFR-5), so
every surface is authored at 360px and expanded upward. There is no native application, no
desktop client, no offline mode.

**Surfaces.** The Hub at `cuatro.dev`, plus every Satellite that adopts the Token Contract.
Satellites keep their own toolchain, language and deploy unit.

**UI system: none, permanently.** There is no shared component package across frameworks and
there will not be one: a decision, not a deferral (PRD §8). The precedent is uniformly
negative in the vendors' own words: Google defunded Material Web in June 2024, GitHub retired
`primer/view_components` in February 2026 citing its own move to React, and Adobe maintains
two full implementations with no consolidation plan.

What federates instead:

| Layer | Federates? | Mechanism |
|---|---|---|
| **Values**: colour, type, space, radii, motion | **Yes** | `tokens.css`, consumed natively by all six frameworks |
| **Data**: what applications exist, what state they are in | **Yes** | The published App Registry |
| **Patterns**: what a component *does* | **By document** | This file. Each Satellite implements natively |
| **Behaviour**: focus, overlays, form controls | **No** | Reimplemented per framework. See § Seams Inventory |

The ceiling is stated rather than discovered, and it **moved on 2026-08-15**, which is worth
recording precisely rather than quietly rewriting:

| | Delivered by | Ceiling |
|---|---|---|
| **"Reads as one author"** | Token Adoption alone: vendoring the contract plus nine hand-fix lines | Was the whole claim. Is now the **floor**, and it is what FR-18 measures |
| **"Reads as one product"** | Visual Restyle: the component vocabulary implemented natively per framework ([`RESTYLE-SPEC.md`](RESTYLE-SPEC.md)) | The claim now, for every application the Suite Directory renders. Measured by FR-36 and SM-12 |

**What did *not* move is the honest part.** Seams S-4, S-5 and S-6 (form validation, overlays,
dense data UI) stay accepted permanently. **The restyle raises the ceiling; it does not dissolve
it.** "Feels like one product" at the widget level, across five frameworks with one maintainer, is
still not on offer and is still not claimed.

**And FR-18 does not move with it.** FR-18 stays satisfied by Token Adoption alone; if it came to
mean "restyled", Epic 1 would block on Epic 8 and the foundation epic would stop delivering visible
value on its own. Spine C-13.

**Frameworks in scope.** Next.js · React/Vite · Svelte · Vue · Angular · Phoenix LiveView.

---

## Information Architecture

### The Hub

```
cuatro.dev
│
├─ /                     Homepage: narrative → Suite Directory
│   ├─ #suite            Stable anchor. The payload. (FR-2)
│   └─ [Connect Four]    v2, embedded (FR-29)
│
├─ /projects             → 301 to /#suite. Superseded. (see below)
├─ /cv                   Header destination. Absorbs /work as a section.
├─ /work                 Survives as a route. Not in header. (FR-1, Q8)
├─ /recommendation       Survives. Linked from /cv. Footer.
├─ /celeste              Survives. Footer only.
└─ /api/health
```

**`/projects`, disposition.** It is live today at v2.5.3, rendering `ProjectCard` from
`content/projects.ts`. It is the **direct ancestor of the Suite Directory**, and once the
Directory ships they are two renderings of the same data, which violates NFR-9 the moment
they disagree.

It **redirects permanently to `/#suite`**. Not deleted: NFR-2 says nothing live may break, and
a 301 keeps every existing inbound link, bookmark and search result working while collapsing
the duplicate. `ProjectCard` and `ProjectsHero` are retired with it; the Registry Entry
pattern replaces them.

This also satisfies FR-2's requirement for *a stable in-page anchor **or** route* resolving
straight to the Suite Directory, and `/projects` becomes exactly that, for free.

**Navigation prominence, PRD Q8, closed.**

| Route | Placement | Why |
|---|---|---|
| `#suite` | **Header, primary** | The payload. SM-1 measures reaching it. |
| `/cv` | **Header, secondary** | Daniela's one likely next click after forming an opinion. |
| `/work` | Section inside `/cv` | It is the same story told twice. One destination, not two. |
| `/recommendation` | Linked from `/cv` + footer | Social proof lands next to the CV, not competing with the suite. |
| `/celeste` | Footer only | Personal, and it converts nobody. |

Two header destinations, not five. Every header link competes with the Suite Directory
against SM-1's **≥60%** target, and the AI-nav tell is precisely five inline links plus a CTA.
All four routes survive and remain functional, satisfying FR-1.

**What "folds in" actually means.** `app/cv/page.tsx` and `app/recommendation/page.tsx` are
**one-line stubs** returning a bare `<h1>`. `/work` is the fully built page: `WorkHero` +
`WorkTimeline` + a `WorkItem` accordion with a `useReduceMotion` hook, over real data in
`content/work.ts`. So folding `/work` into `/cv` is not a merge of two built pages; it is
**building `/cv` around the `WorkTimeline` component that already works**, reusing it
unchanged. `/work` keeps rendering it standalone for anyone holding the URL. The Q8 decision
stands; only the effort assumption behind it inverts.

**Three pre-existing defects travel with the reskin.** All three are in the shipping site
today and none is caused by this design:

| Defect | Location | Effect |
|---|---|---|
| `aria-hidden="true"` on the `<section>` containing the page's only `<h1>` | [`WorkHero.tsx:39`](../../../../components/organisms/WorkHero/WorkHero.tsx#L39) | The work page's heading is invisible to assistive tech. Move `aria-hidden` onto the decorative canvas only |
| `boder:` | [`WorkItem.scss:84`](../../../../components/atoms/WorkItem/WorkItem.scss#L84) | That tech-chip border has never rendered |
| `Oct. 2023 - Dev. 2025` | [`work.ts:18`](../../../../content/work.ts#L18) | Should read `Dec.` |

Separately, `Celeste.tsx` suppresses the site header by mutating
`document.querySelector('header').style.display` inside an effect. The suppression is correct
(that page should not carry suite navigation) but the mechanism leaves the header hidden if
cleanup never runs. A route-group layout or a `<body>` class is the fix.

### The homepage: two paths, one destination

```
DEFAULT PATH                        NON-3D PATH  (Q7, closed)
                                    prefers-reduced-motion  OR  slow connection
┌────────────────────┐              ┌────────────────────┐
│ Narrative (3D)     │              │ Typographic hero   │  ← no 3D asset requested
│  ↓ scroll          │              │  premise (FR-4)    │
│ Climax beat        │              │  framework band    │
├────────────────────┤              ├────────────────────┤
│ Premise (FR-4)     │              │                    │
│ Framework band     │              │                    │
│ ⤷ Skip to suite ↓  │              │                    │
├────────────────────┤              ├────────────────────┤
│ SUITE DIRECTORY    │              │ SUITE DIRECTORY    │
├────────────────────┤              ├────────────────────┤
│ Footer             │              │ Footer             │
└────────────────────┘              └────────────────────┘
  1 interaction to suite              0 interactions to suite
```

**Q7 is closed: there is one non-3D front door, not two.** `prefers-reduced-motion: reduce`
and the slow-connection path receive the **same** artefact, a typographic hero. No static
poster frame of the 3D scene is produced.

Three reasons. A still of a 3D scene reads as a *broken* 3D scene. A non-3D path is required
anyway by UJ-1's edge case and by SM-C5, so producing one costs nothing extra. And a second
artefact is a second thing to keep in sync forever, for one maintainer.

Nothing follows the Suite Directory in the primary scroll except the footer (FR-1). The
Suite Directory is in the homepage document, reachable with no route change.

### The Suite Directory

Renders **only** `Live` and `Complete` entries: a declarative rule over Status, never a
hand-maintained list (FR-35). Six entries at MVP:

```
Digital Library                                      Live
┌─ Tracker Family ──────────────────────────────────────┐
│ “One product family, distinct implementations,        │
│  deliberately not merged.”                            │
│   Cuatro Tracker                                Live  │
│   CS Tracker                                    Live  │
└───────────────────────────────────────────────────────┘
List Wheel                                           Live
CS Tournament                                    Complete
Cuatro Ecosystem                     Live · You are here
```

- The **Tracker Family** is the only containment layer in the directory (FR-11). Its framing
  line **names no count**, so `poketracker-go` arriving later changes nothing.
- The **Hub renders as itself** (PRD §5 counts six including it) but is marked *You are
  here* rather than linking to the page you are on. This stays declarative: a property of the
  current origin, not an exception to the FR-35 filter.
- Ordering is `Live` before `Complete`, then Registry order. Not alphabetical, not by date.

### Surface closure

| Stated need | Surface | Journey that lands there |
|---|---|---|
| Understand what this is | Premise block (FR-4) | Daniela 3, Marcus 2 |
| See what is running | Suite Directory | Daniela 4, Marcus 2, Ana 5 |
| Use the real software | Live link → the application | Daniela 5, Ana 1 |
| Verify the claim | Source link → repository | Marcus 3 |
| Understand a family | Tracker Family group | Daniela 6 |
| Get employment context | `/cv` (absorbing `/work`) | Daniela 7 |
| Discover the suite sideways | Suite Switcher (v2) | Ana 3 |
| Reach the suite without the story | `#suite` + skip control | Marcus 1 |

Every stated need has a surface; every surface has a journey landing on it. IA closes.

---

## Voice and Tone

Brand voice is in [`DESIGN.md`](DESIGN.md) § Brand & Style. This is the microcopy contract.

### Registry Entry descriptions, FR-8

Written **for Daniela, not Marcus**. What the application does *for a person*; the stack is
the `tech` field's job.

- One to three sentences. **Never four.**
- Plain declarative voice. **No** superlatives, **no** marketing adjectives: "powerful,"
  "seamless," "cutting-edge," "modern," "beautiful," "blazing" are all banned. **No first
  person.**
- Leads with the thing itself. *"A self-hosted digital library that…"*, never *"This project
  is an application which…"*
- Parseable by a reader who cannot name a single framework involved.

Drafts, written to the contract and pending your confirmation that they describe the software
accurately:

| Entry | Description |
|---|---|
| Digital Library | A self-hosted library for ebooks and comics. It reads EPUB, PDF and CBZ in the browser, finds a title by full-text search, and can send one to a Kindle. |
| Cuatro Tracker | Keeps a running record of collections and what is still missing from them. |
| CS Tracker | Tracks Counter-Strike matches and player statistics, updating in place as results come in. |
| List Wheel | Turns any list into a wheel and picks one entry at random. |
| CS Tournament | Runs a Counter-Strike tournament from sign-up through the bracket to a final result. |
| Cuatro Ecosystem | The front door to the suite. Lists every application that is running, what it does, and where its source lives. |

The existing `digital-library` description in `content/projects.ts` is **three sentences and
stack-led**: it opens on the reader-facing claim then spends two sentences on Docker Compose,
FTS5 BM25 ranking and SMTP. It is **non-conforming and rewritten**, not grandfathered: the
rewrite above keeps what the software does for a person and moves every implementation noun
into `tech`, where it belongs.

**Two `tech` corrections confirmed on disk, both FR-9 defects:**

- `Hetzner VPS` is stale, the application having been migrated to the Hostinger VPS
  (PRD §13 Q2, closed). Confirmed present at `content/projects.ts:30`.
- The store is **SQLite**, not Postgres. Anything describing this application as
  Postgres-backed (including earlier drafts in this run's mockups) is wrong. The real stack
  is `SvelteKit · Fastify · SQLite · Redis · BullMQ · Docker`.

`tech` is read by the audience most able to detect an error in it (FR-9). An inaccurate entry
is a defect, not a cosmetic issue, and Marcus checking the array is step 2 of his journey.

### The premise, FR-4

At most three sentences, encountered before or with the Suite Directory, carrying without the
stack list:

> Fifteen personal projects became one suite. Everything below is running right now, so open it
> and you are using the real thing, not looking at a picture of it.

Two sentences, no framework named, no adjective doing work.

### UI strings

| Surface | String | Note |
|---|---|---|
| Header nav | `Suite` · `CV` | Two only |
| Skip control | `Skip to the suite ↓` | Above the fold |
| Directory heading | `The Suite` | Not "Projects," not "Portfolio" |
| Directory count | `6 running` | Real count. Never a rounded or aspirational figure |
| Live link | The bare domain, `library.cuatro.dev` | The URL *is* the evidence. Never "View Live" |
| Source link | `Source` | Not "GitHub," not "Code" |
| Self-reference | `You are here` | |
| Family framing | `One product family, distinct implementations, deliberately not merged.` | Names no count |
| Switcher trigger | `Suite` | |
| Switcher header | `Part of the Cuatro Ecosystem` | |
| Footer line | `Six applications · five languages · one operator` | **Update when the count changes, or delete it** |

### Rules

- **Never invent a metric.** No "10× faster," no "+40% something." If a number was not
  supplied it does not exist, and the slot does not exist either.
- **Status words are the taxonomy verbatim**: `Live`, `Complete`, `In progress`, `Archived`.
  No synonyms anywhere, ever. Introducing one is a discipline violation.
- **Honesty over completeness** (NFR-9). A `Complete` entry that is true beats a `Live` entry
  that is aspirational.
- Typeset punctuation: `—`, `…`, curly quotes.

---

## Component Patterns

Behaviour only. Visual specs are in [`DESIGN.md`](DESIGN.md) § Components.

### Registry Entry

The atom of the whole system. **One card, two readers.**

- **Reading order** serves Daniela: name → status → description → tech → links. She forms an
  opinion from the first three and never needs the rest.
- **Tab order** serves Marcus: the live link, then the source link. Two stops. He reaches
  source in one interaction from any entry (FR-10).
- **Two independently addressable tap targets** (FR-3), each **≥44×44px**, on the link itself
  and not on a wrapper, because a wrapper target that swallows the row makes the two links
  indistinguishable by touch. Implemented as `min-height: 44px; display: inline-flex;
  align-items: center`. **Vertical padding on a plain inline link does not grow its hit
  area.** See [`DESIGN.md`](DESIGN.md) § Components → Hit targets. Separated by `--s-lg` so
  the two boxes cannot overlap.
- **The row is never wholly clickable.** Two destinations exist; a whole-row target would have
  to pick one, and picking the live link silently costs Marcus his path.
- **`Complete` has no live link at all**, not a disabled one. `live` is forbidden when
  `status` is `Archived` and required when `Live` (FR-6).
- **Source is present on every entry without exception**, including `Archived` and including
  the Hub's own.

### Status mark

- Renders as a **visually distinct element** on every entry, never inside description prose
  (FR-7).
- Carried by **structure**, not hue. Each value differs from its neighbour by a structural
  property: `Live` has a 4px dot that `Complete` lacks; `Complete` is solid where
  `In progress` is dashed; `In progress` has a border that `Archived` drops. Legible in
  greyscale, under colour-blindness, and in print, **with no legend** (FR-7). Per-value spec
  and contrast in [`DESIGN.md`](DESIGN.md) § Colors.
- **The dot is not decoration.** Without it, `Live` and `Complete` are both `1px solid` and
  differ only in hue, at **1.13:1 apart in greyscale**, which is no distinction at all. Any
  implementation that drops the dot breaks FR-7 while appearing to satisfy it.
- **State is never expressed with opacity.** `Archived` drops the container rather than fading
  it: a faded mark computes to 2.25:1 on its border, below the floor this system enforces
  everywhere else.
- Only `Live` takes `{colors.accent}`, because it is the one value that means *clickable right
  now*.
- **Not interactive.** No tooltip, no popover, no hover state. A person who wants to know what
  `Complete` means reads the word.

### Tracker Family group

- A labelled container holding whichever members pass the FR-35 filter.
- Its framing line **holds regardless of how many members render and names no count** (FR-11).
  At MVP two of three render; the line does not change.
- Is **not** collapsible, not a tab set, not reorderable. It is a bordered group with a
  sentence.

### Suite Switcher, v2, FR-13–15

A **pattern plus a data contract**, not a component. Specified so a Svelte app and a Phoenix
LiveView app can each build it from ``tokens.css`` and the Registry with no shared code.

**Behaviour**

1. A trigger in the Satellite's header, labelled `Suite`, with a 4px `{colors.accent}` dot.
2. Activating it discloses a panel listing entries from the **published Registry**, never a
   hardcoded per-app list (FR-13).
3. **The same Status filter as the Suite Directory applies** (FR-13). Nothing is surfaced
   sideways that the Hub hides.
4. Each row is **one interaction** to that application.
5. Selecting a row performs a **full navigation to that application's own origin** (FR-14).
   Not a route change, not a client transition, not an iframe.
6. The current application is marked `You are here` and is **not** a link. It is shown, not
   hidden, because Ana needs to see where she is among siblings.
7. **The Hub is present and distinguishable**, labelled `The Hub`, subtitled with the bare
   domain, never presented as a peer application (FR-14).
8. Every other row carries an **external-navigation glyph**. This is the single detail that
   stops the panel reading as tabs, which is FR-14's whole requirement.
9. Adding an entry to the Registry makes it appear in every switcher **with no per-application
   code change** (FR-13).

**What it must never do:** imply shared state, shared navigation history, or a common shell
(FR-14).

**Data contract.** Each Satellite reads the published Registry, filters, and renders
natively. The contract a switcher depends on:

| Field | Required | Used for |
|---|---|---|
| `id` | ✔ | Identifying the current application |
| `name` | ✔ | Row label |
| `status` | ✔ | The FR-35 filter |
| `tech` | ✔ | Row subtitle, first entry only |
| `live` | when `Live` | The navigation target |
| `source` | ✔ | Not rendered in the switcher; part of the contract |
| `family` | n/a | Not rendered in the switcher. Grouping is a Directory concern |

A Satellite needs exactly four fields to render a switcher row. **Per-app cost is one
disclosure widget** (which every framework in the estate already has natively) plus a fetch.
No Satellite imports a component package from the Anchor (FR-15).

**Failure behaviour.** If the Registry is unreachable, the trigger **does not render at all**.
A switcher that opens onto an error is worse than no switcher, and NFR-9 says under-promise.

### Nav

- Two destinations. Current route carries a `2px` `{colors.accent}` underline and
  `aria-current="page"`.
- Sticky at `{z.sticky}`. Does not hide on scroll, because a header that disappears costs Marcus the
  `Suite` link at the exact moment he wants it.

### Skip control

- Sits **above the fold** on the default path, so FR-2's *one interaction from a cold arrival*
  is satisfied without scrolling first.
- Moves focus, not just scroll position, to the Suite Directory heading.
- Distinct from the accessibility skip-link, which is the first tabbable element on the page
  and targets main content.

---

## Component Patterns: the redesigned Hub surfaces

*Added 2026-08-15 by the restyle scope change. These are the inherited cybercore components,
respecified. Visual specs are in [`DESIGN.md`](DESIGN.md) § Components → The redesigned Hub
surfaces; the framework-agnostic vocabulary they are built from is in
[`RESTYLE-SPEC.md`](RESTYLE-SPEC.md). Together these entries are what Stories 2.27–2.34 implement
against, and what Epic 8 reads for the Hub's reference behaviour.*

**The governing decision, once:** the glitch loop, the chromatic aberration, the scanline raster,
the radial vignette and the film grain retire. The mono signage, the notched panel silhouette and
the readout register survive. Everything below follows from that.

**A defect pattern that runs through three of these components, named once here.** `GlitchText`
puts `aria-label` on a plain `<div>`; `Error404` puts `aria-label` on a `<p>`. **`aria-label` on a
generic role is not reliably exposed by assistive technology.** The accessible name is dropped by
several screen-reader and browser combinations, so both components' accessible names are, in
practice, whatever the visible text happens to be. This is a **pre-existing defect in the shipping
site**, not one this design introduces, and it is not in the three-defect list § Information
Architecture already carries. Every entry below that inherits it says so, and the fix is always the
same: **put the text in a real element and let it be read**, never name a `<div>`.

### Display entrance, replacing `GlitchText`

The homepage and error-surface heading. A **heading that arrives**, not a heading that
malfunctions.

- **The accessible name is the heading element's own text content.** No `aria-label` on a wrapper,
  no `aria-hidden` on the element that carries the words. Fixes the defect above.
- **The entrance animates `opacity` only**, per character, staggered by DOM index via a custom
  property and capped at ~500ms total. One orchestrated entrance per page load; after it, the
  heading simply exists.
- **A character-splitting implementation must not leave the text unreadable if it fails.** The
  words are in the DOM before any split runs, and a split that throws leaves a readable heading.
  The shipped implementation waits on `document.fonts.ready` before measuring, which means a font
  that never loads means an entrance that never runs, so **the heading must be visible in that case**,
  not stuck at `opacity: 0`.
- **The scrambling glyph pool is retired.** Substituting random characters into a heading emits a
  stream of nonsense to anything watching the DOM, and it makes the accessible name unstable
  during the entrance.
- **`prefers-reduced-motion`:** the heading is present at full opacity, immediately. Not a faster
  entrance, not a crossfade. **Nothing else about the component changes.**
- **No looping animation of any kind.** The retired `glitch-loop` ran every 6 seconds forever;
  infinite loops are banned in § Interaction Primitives and this is the estate's only instance.
- **Closes O-12 item 1.** The red and cyan aberration is dropped, not excepted.

### Scrim layer, replacing `ScanlineOverlay`

- **`aria-hidden`, always, and never focusable.** It is decorative-by-absence: it carries no
  content at all.
- **`pointer-events: none`.** It covers imagery; it must never intercept a click meant for what is
  beneath or beside it.
- **It has one state.** No intensity variants, no hover, no scroll response, no animation. The
  shipped component's `light` / `full` prop is retired: a scrim that varies is a scrim whose
  contrast guarantee varies, and the guarantee is the whole reason the role exists.
- **It is present only where text overlays moving imagery.** On a static ground it is absent, not
  faint. The 404 surface therefore has **no** scrim, because nothing moves behind its text.
- **Anything may sit above it, including interactive elements**, every role clearing its floor over
  the scrim (rest 4.77:1, hover 6.94:1, focus 9.02:1). *An earlier draft of this entry forbade it
  on the strength of a miscomputed contrast table; see `{colors.scrim}` in
  [`DESIGN.md`](DESIGN.md) § The scrim for the corrected numbers and how they are computed.*
- **But the guarantee belongs to the stack, not to the token.** An element only has it if the scrim
  is genuinely beneath it. A sticky header at `{z.sticky}` painted over a scrim at `{z.raised}` is
  over the **imagery**, not over the scrim, and computes against the imagery. **This is the real
  constraint on `HomeLayout`**, and it is a layering question rather than a colour one.
- **Closes O-12 item 2.**

### Plate mark, absorbing `HudLabel`

`HudLabel` and the Plate mark were the same atom under two names and are now one component
(decided 2026-08-15). Three variants: section, annotated, side-ruled.

- **Not interactive.** No hover, no focus, no tooltip, no disclosure. It is signage.
- **The subordinate line is `aria-hidden` in every implementation, without exception.** It sets in
  `{colors.accent-quiet}`, which computes to 2.74:1 and is ornament only. **A subordinate line that
  carries information is a defect.** Move the information into the label, which is read.
- **The label itself is read**, so its text is real words and not a decorative code. Where the
  shipped site uses strings like `// ERR_NOT_FOUND` as a label, the `//` is decoration inside a
  string a screen reader will speak. **Either the marker is styling and lives in CSS, or the label
  is plain words.** The shipped `Error404` reads `slash slash E R R underscore NOT underscore FOUND`
  before it reaches the actual message.
- **It appears where a genuine ordinal or domain exists**, never above every section. An eyebrow on
  every heading is a named anti-pattern.
- **Numerals are `tabular-nums`**, so a readout does not jitter when a digit changes.

### Home surface, `HomeLayout`

The largest single surface in the redesign, and the one the scrim constraint actually bites.

- **The corner panels keep their notched silhouette.** The `clip-path` corner cut is geometry, not
  an effect; it costs nothing to federate and it is most of what "reads as cybercore" was carrying.
- **The grid-line background is retired.** It is a `linear-gradient` pair, and § Rules bans
  gradients in backgrounds. The ground is `{colors.paper}`.
- **The scrim must cover the whole canvas, and the sticky header must not be above it.** Interactive
  content over imagery is permitted, but only where the scrim is genuinely beneath it. Two things
  follow, and both are geometry rather than taste: the scrim spans the **canvas's full extent**,
  not just the panel footprints, so a panel cannot drift off its cover on a viewport nobody tested;
  and the header, which is sticky at `{z.sticky}`, is **either outside the canvas's box or sits on
  `{colors.paper}` rather than relying on the scrim at `{z.raised}` beneath it.**
- **The dim-siblings-on-hover behaviour is retired.** `opacity: 0.2` on every non-hovered panel
  expresses state with opacity, which is barred everywhere in this system, and it silently takes
  contrast with it. A panel that is not hovered is simply not hovered.
- **The 3D canvas is `aria-hidden` and not focusable** (A-14). It is decorative and its content is
  stated in prose.
- **Mobile is the authored width.** At `<768px` the panels stack in reading order (name, then
  imagery, then navigation, then contact) and the readout panel is omitted rather than rendered
  empty (§ Empty edge).
- **Seam S-1 stands.** The scene's own colours are JS values and remain a declared FR-17 exception.

### Error surface, `Error404`

Two exits, matching the header: the Suite and the CV. Nothing else.

- **Structure:** a Plate mark, the display line, one line of `{colors.muted}` at `{type-scale.sm}`,
  then the exits as controls. One `<h1>`.
- **The exits are controls** per [`RESTYLE-SPEC.md`](RESTYLE-SPEC.md) § 1, at `≥44×44px`, with the
  focus treatment. The shipped `error-page__back` uses a 1px outline at 4px offset, which is
  neither the token width nor the token colour, so it takes the standard ring.
- **No scrim, because nothing moves.**

**O-12 item 3, the decorative numeral. Both branches are specified so Story 2.30 cannot stall.**

The numeral is currently a `<p>` reading `404`, carrying `aria-label='Error 404'`, and it is **not**
`aria-hidden`. Because `aria-label` on a `<p>` sits on a generic role, what a screen reader actually
announces today is **not** reliably `Error 404`: it is more likely the bare digits, or nothing.
**So the redundancy test is a real test with a real chance of going either way**, and it must be run
rather than assumed.

**The test (Story 2.30's binding AC).** With the numeral removed from the accessibility tree
entirely, does a screen-reader user still learn that this is a 404? Read the page's accessible
output top to bottom and check whether the page title, the heading and the message together carry
it.

| Branch | Condition | Treatment |
|---|---|---|
| **A, redundant** | The title, heading or message already says the page was not found | The numeral is **`aria-hidden`** and purely decorative. `{colors.accent-quiet}` (`--token-accent-muted`, 2.74:1) is then **correct**, because the contrast floor does not apply to something that is not content. The `aria-label` is **removed**, not kept, since a hidden element does not need a name |
| **B, not redundant** | The 404 exists only as the numeral | The numeral **is text**. `--token-accent-muted` is **forbidden**. It takes **`--token-text-secondary`** (`{colors.muted}`, 7.03:1 on paper) and **not** `--token-text`, because it is supporting information and the display line is the page's primary voice. The `aria-label` is removed and replaced by real text content, since a name on a generic role is not dependable |

**Branch B is the likely outcome and the cheaper fix is to make branch A true.** The message line
currently reads `Page not found.`, which does carry the meaning without the numeral, so if the
page title also distinguishes the route (A-13), branch A holds. **Story 2.30 verifies rather than
assumes**, and records which branch it took.

### Work item, `WorkItem`

A row, not a card. A disclosure, not an accordion group with roving focus.

- **The trigger is a `<button>`** carrying `aria-expanded` and `aria-controls`; the panel is a
  labelled region. `Tab` moves through triggers normally and is never trapped.
- **The first entry opens on load without a collapsed-height flash.**
- **The open indicator is structural, not chromatic.** The leading rule changes width and colour
  together (`{stroke.emphasis}` in `{colors.accent}` when open, a hairline when closed) so the
  state survives greyscale. The element reserves its widest state so nothing reflows.
- **Hover recolours the trigger's border, never its ground.** The shipped `rgba(91,33,182,0.06)`
  hover ground is retired: it is an alpha fill and it is a second signal.
- **Tech chips are outlined, never filled, and are not interactive.** They are metadata, so they
  take no hover, no focus and no target floor.
- **The `//` highlight marker is CSS**, generated content, and it stays out of the accessible name.
  The list is a list.
- **Reduced motion:** the existing height tween drops to `0` duration. Height is a layout property
  and is the one place this system animates it, because a disclosure that jumps is worse than a
  disclosure that eases. Recorded as the single, named exception to "only `transform` and
  `opacity` animate".

### Work hero and work timeline: `WorkHero`, `WorkTimeline`

- **The heading is a real `<h1>` and is not inside an `aria-hidden` subtree.** This defect was
  present on `main`, was fixed on `dev` by PR #65, and the redesign must not reintroduce it: the
  `aria-hidden` belongs on the decorative canvas only.
- **The canvas is decorative**, `aria-hidden`, not focusable, and is not requested under
  `prefers-reduced-motion`.
- **The meta line is a Plate mark**, not free mono text, so one component carries every readout on
  the site.
- **`WorkTimeline` is a `<ul>` of work-item rows.** Story 2.16 reuses it structurally unchanged
  (UX-DR28); this restyles it and changes nothing about what it renders or how it behaves.

### Chrome: `Navbar`, `Header`, `Logo`, `ContactContainer`, `Container`

Restyled **after** Story 2.15's nav reshape, never inside it.

- **Two destinations**, per § Component Patterns → Nav. Current route carries `aria-current="page"`
  and the `{stroke.emphasis}` accent underline.
- **Every nav link reaches `≥44×44px` in both axes**, via `min-height` plus `inline-flex` plus
  `padding-inline`. The shipped links measure roughly 16×27px, which is the estate's worst instance
  of the floor being missed while appearing to be met (§ Accessibility Floor, A-4).
- **Hover recolours the existing underline; it does not add one.** An underline that appears on
  hover is a width change and it reflows the row.
- **`Container` is width-capped, not width-percentaged.** `min(100%, 1920px)` with `--page-pad`
  inline. The shipped `min(80%, 1920px)` costs 20% of a 360px viewport to margin before any padding
  applies, which is what makes the mobile floor fail.
- **`Logo` is a wordmark, and it is text.** The raster image retires. Its accessible name is the
  site name; it does not carry `alt` text describing a picture.
- **`ContactContainer` is a list of links**, each meeting the target floor, each self-describing out
  of context (A-9).
- **The header does not hide on scroll.** A header that disappears costs Marcus the `Suite` link at
  the exact moment he wants it.
- **`Celeste` suppresses the header correctly but by the wrong mechanism.** Mutating
  `document.querySelector('header').style.display` in an effect leaves the header hidden if cleanup
  never runs. A route-group layout or a `<body>` class is the fix, and the restyle is the right
  moment for it because it touches presentation only.

---

## State Patterns

### Suite Directory

| State | Behaviour |
|---|---|
| **Loaded** | Six entries. Default. |
| **Registry unreachable** | The Directory renders from the build-time snapshot the Hub was built with. The Hub consumes the same published Registry it publishes (FR-12); it does not need it at runtime to render. |
| **Empty** | Cannot occur, the filter being over Status and the Hub's own entry always `Live`. If it ever renders empty, that is a defect, not an empty state. **No empty-state illustration is designed.** |
| **A `live` URL stops resolving** | Not a UI state. FR-32 catches it on a schedule and notifies the Operator; FR-28 moves the entry off `Live` and removes the URL **in the same change**. The Registry degrades honestly; the interface never shows a broken link. |

### Registry Entry

| State | Behaviour |
|---|---|
| Rest | No treatment |
| Hover | **One signal**: the link's underline recolours to `{colors.accent-bright}`. No lift, no scale, no shadow, no background change, and **no width change**, width being a layout property. |
| Focus-visible | `{stroke.focus}` ring in `{colors.focus}` at `{stroke.focus-offset}`, **applied instantly**. Deliberately a *different* token from hover, so a keyboard user can always tell focus from hover. |
| Active | No separate treatment. Navigation is the feedback. |
| Visited | Not styled. A visited live link is not different information. |

### The narrative

| State | Behaviour |
|---|---|
| Loading | The premise and Suite Directory are **already interactive**. The narrative may not block the payload (feature NFR, §4.1). |
| Failed to initialise | Falls through to the non-3D path. The Suite Directory renders and is fully usable (FR-2). |
| Blocked (no WebGL, extension) | Same fall-through. |
| `prefers-reduced-motion` | Non-3D path. Never requested, never decoded. |

**There is no loading spinner for the narrative.** A spinner would announce that something is
missing on the one path where nothing is.

### Secondary surfaces

| Surface | States |
|---|---|
| `/cv` | **Loaded**, the only state. Statically rendered from `content/work.ts`. **Accordion:** collapsed / expanded, `aria-expanded` on the trigger, `aria-controls` on the panel; the first entry opens on load without a collapsed-height flash. **Reduced motion:** the existing `useReduceMotion` hook drops the GSAP height tween to `0` duration. **Content slots:** Education and Contact do not exist in the repository. Until they do, the section is **omitted, not rendered empty**. An empty section reads as unfinished; an absent one reads as scoped |
| `/work` | Same accordion states. No separate empty state, `content/work.ts` never being empty |
| `/recommendation` | **Loaded** with an attributed quote, or **the route is not linked at all.** No unattributed and no placeholder state ships. An unattributed quote is worth less than no quote to a hiring reader |
| `/celeste` | One state. Header suppressed, no navigation, not indexed. The only surface in the system with no exit, deliberately |

### Global

- **No toast system.** Nothing in MVP performs an async mutation. Do not build one.
- **No confirmation dialogs.** Nothing is destructive.
- **No skeletons.** Everything on the Hub is statically rendered.
- **404.** `Error404` is **redesigned**, not inherited. Story 2.30 and § Component Patterns →
  Error surface specify it, including both branches of O-12 item 3. It offers exactly two
  exits, the Suite and the CV, matching the header.

---

## Interaction Primitives

### Motion

Durations and easings are tokens: `{motion.dur-micro}` 120ms · `{motion.dur-minor}` 220ms ·
`{motion.dur-major}` 420ms · `{motion.dur-exit}` 165ms, with `{motion.ease-entrance}`, `{motion.ease-exit}`,
`{motion.ease-toggle}`.

- **Only `transform` and `opacity` animate.** Never width, height, margin, or a layout
  property.
- **Name the properties.** `transition: border-color var(--dur-micro) var(--ease-toggle)`.
  Never `transition: all`.
- **One orchestrated entrance per page load**, then content simply exists. Universal
  scroll-triggered fade-up is banned.
- Stagger by DOM index via a custom property, capped at ~500ms total.
- Scroll work uses `IntersectionObserver`. Never a raw `scroll` listener.
- **Banned:** bounce, elastic, overshoot easings on UI; parallax outside the narrative;
  infinite loops; `hover:scale-105`; cursor followers; animated hover gradients; browser
  default `ease` / `ease-in-out`.

### Reduced motion

`@media (prefers-reduced-motion: reduce)` **is inside the Token Contract**. See
[`DESIGN.md`](DESIGN.md). It collapses every duration token to `1ms`, so any Satellite that
adopts the tokens inherits compliance for every token-driven transition without writing a
line. This is the one piece of behaviour the token layer genuinely federates.

Beyond that, per-app: spatial motion collapses to an opacity crossfade; the 3D narrative is
not requested at all.

### Focus

**The Hub sets the reference standard the Satellites copy by hand.** Tokens carry the *colour*
of a focus ring; they cannot carry *when it appears*. This section is what gets copied.

- **`:focus-visible`, never `:focus`.** A mouse click on a link must not paint a ring.
- `outline: {stroke.focus} solid {colors.focus}` with `outline-offset: {stroke.focus-offset}`.
- **Never transitioned.** A ring that fades in over 200ms leaves no indicator at the moment
  focus lands. `transition` on `outline` or on focus-gain `box-shadow` is a defect.
- **Never removed** without an equivalent replacement. `outline: none` alone is a defect.
- Visible against all three grounds, verified at 11.70 / 11.19 / 10.45:1.
- Focus is **never trapped** anywhere on the Hub. There are no modals.
- The skip control **moves focus**, not just scroll.

### Pointer and touch

- Minimum target **44×44px** on the interactive element itself, as
  `min-height: var(--tap); display: inline-flex; align-items: center`, **not** as vertical padding
  on a plain inline element, which paints outward without growing the hit area. A narrow label
  such as a two-letter nav item also needs `padding-inline` to reach 44px wide.
- **Verify by measurement, not by reading the CSS.** This floor is the single easiest one to
  miss while appearing to meet it.
- **No hover-only affordance anywhere.** Every hover signal has a focus equivalent and is
  reachable by tap. Touch users are the primary users (NFR-5).
- No long-press, no swipe, no gesture. Everything is a tap or a click.

### Keyboard

- Full traversal in DOM order. No positive `tabindex` anywhere.
- **The Suite Switcher is a disclosure, not a menu.** The trigger is a `<button>` with
  `aria-expanded` and `aria-controls`; the panel is a labelled region containing a list of
  ordinary links. `Tab` moves through the rows and out of the panel normally. `Escape` closes
  it and returns focus to the trigger. Focus is never trapped.
- **Do not put `role="menu"` on it.** That role promises `menuitem` children and arrow-key-only
  traversal, which would make `Tab` skip the entire panel, the opposite of the behaviour
  specified above, and a worse experience than the plain links it would replace. Arrow-key
  movement between rows is an optional enhancement, never the only way through.

---

## Accessibility Floor

Not optional (project constraint). Behavioural floor here; contrast is in
[`DESIGN.md`](DESIGN.md) § Colors, where all fifteen pairings are computed and pass.

**Target: WCAG 2.1 AA**, exceeded on text contrast.

| # | Requirement | Where it binds |
|---|---|---|
| A-1 | Every interactive element has a visible `:focus-visible` indicator, ≥3:1, never animated | Everywhere |
| A-2 | Reduced-motion honoured **without denying access** to the Suite Directory | NFR-6, FR-2 |
| A-3 | Status legible without colour: the **dot plus border treatment** carries the taxonomy; hue never carries it alone | FR-7 |
| A-4 | Targets ≥44×44px, independently addressable, via `min-height` + `inline-flex`, **measured, not assumed** | FR-3 |
| A-5 | No horizontal scroll at 360px; Status never truncates | FR-3 |
| A-6 | Skip-link is the first tabbable element | n/a |
| A-7 | One `<h1>` per document; heading levels never skip | n/a |
| A-8 | Suite Directory is a `<ul>` of entries; the Family group is a nested `<ul>` with an accessible name | FR-11 |
| A-9 | Link text is self-describing out of context. `library.cuatro.dev` and `Source` both are; "click here" is not | FR-10 |
| A-10 | Source links carry an accessible name naming the application: `Source: Digital Library` | FR-10 |
| A-11 | Body text ≥14px; nothing below 11px | n/a |
| A-12 | Prose respects user font-size; `rem` throughout, never `px` for type | n/a |
| A-13 | `lang` set; page title distinguishes the route | n/a |
| A-14 | The 3D canvas is `aria-hidden` and not focusable, being decorative with its content stated in prose | FR-4 |
| A-15 | Switcher trigger carries `aria-expanded`; the panel is labelled; `Escape` restores focus | FR-13 |
| A-16 | Nothing autoplays with sound; nothing auto-advances | n/a |

**Verification:** keyboard-only traversal of the homepage and one Satellite; 360px viewport
with no horizontal scroll; greyscale render with the Status taxonomy still readable;
`prefers-reduced-motion` forced. Four checks, all manual, all cheap, sized for one person.

---

## Key Flows

Protagonist names are taken verbatim from PRD §2.3.

### Daniela decides in four minutes, on her phone, between meetings

Technical recruiter, screening for a senior frontend role. Twelve tabs open. Has not read the
CV.

1. Opens `cuatro.dev` from a link in an application. The narrative starts.
2. Scrolls. The story runs: who built this, and why.
3. The narrative's **last frame is the directory's first frame**. She does not navigate; the
   page resolves. The premise sits there in two sentences with no framework named.
4. **A grid of things that are running.** Six entries, each with a name, one line of plain
   English, a status, and a stack she recognises even though she recognises none of the names.
5. Taps **Digital Library**, marked `Live`. It opens. It is an actual library with actual
   books.
6. Comes back. Notices the Trackers grouped and labelled: one family, distinct
   implementations, deliberately not merged. The shape of the thing lands.
7. Optionally taps `CV`.
8. Closes the tab and forwards the link.

**Climax, step 4.** The moment the narrative resolves into a grid of things that are
*running*.
**Resolution.** She has an opinion formed from software rather than from claims, in about
ninety seconds.
**Edge case.** On a slow connection the narrative is the heaviest thing on the page. She
takes the non-3D path (§ IA) and lands on step 4 in **zero interactions**. The suite is the
payload; the story is the wrapper.
**Measured by** SM-1 (≥60% reach), SM-2 (≥35% click through). **Not** by time on site:
SM-C1 says ninety seconds and gone is a success.

### Marcus checks whether the polyglot claim survives contact

Staff engineer, thirty-minute screen, skeptical of portfolio sites by default.

1. Lands, and **skips the narrative immediately**. The skip control is above the fold, so
   this costs one interaction, not a scroll.
2. Reads the directory looking for one thing: whether "six frameworks" means real applications
   or tutorials. The `tech` array on every entry is the first thing he checks and it had
   better be accurate (FR-9).
3. Opens `cs-tracker` (Phoenix LiveView, `Live`) then clicks **Source** and lands **in the
   repository**, not on a profile page. Reads the commit history and the deploy config.
4. Back. `digital-library`. Different framework, different backend. Does it again.
5. Notices the thing he actually cares about: **the two applications look like the same
   product despite sharing no component code.** Then he goes looking for where that breaks.
6. Finds the seams: a form control that focuses differently, a table that is denser. They are
   documented rather than hidden (§ Seams Inventory).

**Climax, step 5.** The realisation that the interesting artifact is the seam, not any single
application.
**Resolution.** He can describe the system to a panel in two sentences.
**Edge case.** A repository shows a last commit from two years ago. Its entry said `Complete`,
so the old date **confirms** the entry rather than contradicting it. This is the entire reason
the Status taxonomy exists.
**Measured by** SM-3 (source drill-through, no target; this is the Marcus signal).

### Cuatro logs in once and uses his own tools

The Operator. The only genuine, non-demonstrative user need in this document, and there is
exactly one person in it. **v2: cross-app identity is deferred by sequence (PRD §9.2).**

1. Opens `tracker.cuatro.dev` on a Sunday to log something personal.
2. Authenticates once.
3. Later opens `cuatro-finance` from the Suite Switcher in the tracker's header.
4. **Already signed in.** No second login, no second password, no shared cookie.

**Climax, step 4.** The second application opens already authenticated.
**Resolution.** Two personal tools behave like two views of one product.
**Edge case.** He signs out of one and expects to be signed out everywhere, including any
Phoenix LiveView socket already open. That requires a socket-level broadcast; an open socket
will not otherwise observe the logout (FR-22).

### Ana arrives sideways and discovers there is a suite at all

Sent `library.cuatro.dev` directly by a friend who wanted a self-hosted ebook reader. She
never sees `cuatro.dev`. **v2: the Suite Switcher is deferred (PRD §9.2).**

1. Uses the library. Likes it.
2. Notices a small `Suite` control in the header saying this is part of something.
3. Opens it. Sees sibling applications she did not know existed, each with an external glyph,
   each on its own origin.
4. Understands these are **siblings, not tabs**.
5. Follows one back to the Hub, arriving having **already used** one of its applications.

**Climax, step 3.** A deep-linked visitor discovers the ecosystem from inside a satellite.
**Resolution.** She reaches the hub having already used one of its applications, which is the
strongest possible order.
**Edge case.** The switcher must never imply the satellites are one application. The external
glyph on every row and the full-origin navigation are what carry this (FR-14).

*UJ-4 is the entire justification for the Suite Switcher. Without a sideways-arriving visitor,
the switcher is decoration.*

---

## Seams Inventory

Where token-only federation **visibly fails**. Tokens federate values; nothing federates
behaviour. Naming these is worth more than pretending they do not exist, because Marcus is looking
for them, and a documented seam reads as judgement while a discovered one reads as an
oversight.

**Fix** means hand-fix per application. **Accept** means live with it and say so.

| # | Seam | Shows up as | Cost | Call |
|---|---|---|---|---|
| **S-1** | **Three.js narrative**: colours are JS values, not CSS. A custom property cannot reach a WebGL scene without a runtime `getComputedStyle` read | The 3D scene's palette can drift from the token palette | Anchor only, one app | **Accept.** FR-17 is scoped to CSS-expressible styling. A declared exception, not a discovered one |
| **S-2** | **Form-control focus rings**: every framework ships its own, and `:focus-visible` support in framework-generated markup differs | A focused input looks different in Angular than in Svelte | ~1 rule per app | **Fix.** The single highest-value hand-fix. Copy § Interaction Primitives → Focus verbatim |
| **S-3** | **Default control radius**: frameworks and their UI defaults round corners; this system is square | A rounded input inside a square system reads as a mistake | 1 line per app | **Fix.** Cheapest fix in the estate, highest visual return |
| **S-4** | **Invalid / error states** on form controls: colour, icon, placement, announcement all differ | Two applications report the same error differently | Real work per app | **Accept** at MVP. No Hub form exists; revisit with Demo Access in v2 |
| **S-5** | **Overlays**: focus trap, scroll lock, portal strategy, dismissal are all behaviour | A modal in Angular traps focus differently than one in Svelte | Substantial per app | **Accept.** The Hub has no modals; the switcher is a disclosure, not a dialog. Do not build a cross-framework overlay convention |
| **S-6** | **Dense data UI**: tables, date pickers, comboboxes | The Tracker Family's three implementations will feel different at the widget level, permanently | Very high | **Accept, and say so.** This is exactly the ceiling. "Reads as one author," not "feels like one product" |
| **S-7** | **Dark-only vs existing light themes**: `digital-library` and `cs-tracker` carry themes today; the contract defines no light palette | A Satellite either goes dark or partially adopts, showing a half-token surface | Per app, real | **Accept, deliberately.** Direct consequence of the dark-only decision. **The mitigation is sequencing:** a Satellite adopts fully or not at all: a half-adopted app is worse than an unadopted one |
| **S-8** | **LiveView DOM patching vs CSS transitions**: `phx-update` can replace an element mid-transition | A hover or entrance animation snaps in `cs-tracker` where it eases elsewhere | Small, LiveView only | **Fix** if visible. `phx-update="ignore"` on animated containers. Cheap once known |
| **S-9** | **daisyUI theme layer** competing with the tokens in Phoenix: daisyUI defines its own `--color-primary` family | Phoenix components pick up daisyUI defaults instead of Cuatro tokens | Bounded | **Fix.** Map daisyUI's variables onto the token roles. **Verify first** whether `@plugin "daisyui/theme"` accepts a `var()` reference; documented fallback is plain CSS. This is the empirical unknown that Step 2 on `cs-tracker` front-loads |
| **S-10** | **Font-loading strategy**: Next.js `next/font` self-hosts and preloads; a plain `@font-face` in Phoenix does not | Different FOUT/FOIT behaviour on first paint between apps | Small | **Fix.** `font-display: swap` plus `size-adjust` overrides in `fonts.css`, which is why they belong in the contract |
| **S-11** | **Scrollbar appearance**: OS and framework defaults, unaffected by tokens | A light scrollbar on a near-black page | 1 rule per app | **Fix.** `color-scheme: dark` on `:root`. One line, and it also fixes native control rendering |
| **S-12** | **Selection colour**: browser default is a blue that belongs to no part of this system | Highlighted text flashes a foreign blue | 1 rule per app | **Fix.** `::selection` from `{colors.accent}` |

**The restyle does not dissolve a single seam above.** S-4, S-5 and S-6 stay accepted permanently
and [`RESTYLE-SPEC.md`](RESTYLE-SPEC.md) § The ceiling puts them explicitly below its ceiling: no
cross-framework overlay convention, no shared validation vocabulary, no table system. S-1 stays a
declared FR-17 exception. What the restyle changes is that S-2, S-3, S-9, S-11 and S-12, the five
marked **Fix**, stop being optional politeness and become checks F-3, F-5, F-6 and F-11 of the
restyle floor, recorded per application by Story 8.4.

### The hand-fix list, in order

Nine lines of CSS per Satellite. **This is Token Adoption's whole per-app cost beyond importing the
files, and under the restyle programme it is the floor rather than the finish line.** A rendered
application goes on to implement the component vocabulary natively (AD-24, AD-25):

1. `color-scheme: dark` on `:root` (S-11)
2. `::selection` from the accent (S-12)
3. Focus-ring rule from § Interaction Primitives (S-2)
4. `border-radius: 0` on form controls (S-3)
5. Map the framework's control defaults onto the token roles (S-9, where applicable)

**Ordered by return per line.** A Satellite that does only steps 1–4 already reads as family.

---

## Asset Budget

SM-C5 counts Hub asset weight as a counter-metric: the 3D story exists to frame the suite, not
to compete with it, and growth that delays SM-1 is a regression **regardless of how good it
looks**. So it needs a number.

### The two paths

| Path | Payload | Blocking? |
|---|---|---|
| **Non-3D** | HTML + one CSS file + three woff2 subsets | Nothing blocks. Directory interactive on first paint |
| **Default** | The above, **plus** the narrative bundle | The narrative **must not block** the Suite Directory reaching interactive (feature NFR, §4.1) |

### Budget

| Item | Budget (gzipped) | Basis |
|---|---|---|
| HTML + critical CSS | ≤ 20 KB | Estimate |
| Fonts: 3 variable faces, **latin subset only** | ≤ 120 KB total | Estimate. Subsetting is the lever; unsubsetted variable faces run several times this |
| **Non-3D path total** | **≤ 140 KB** | **The number that matters.** This is what Daniela gets on a slow connection |
| Narrative JS: Three.js, R3F, drei, postprocessing, GSAP, ScrollTrigger, lenis | **Unmeasured.** Plausibly 300–450 KB | Library sizes only. **Measure before trusting** |
| Narrative assets: geometry, textures | **Unmeasured** | Not inspected in this run |

### Rules

1. **The non-3D path is the budget that binds.** Everything narrative is deferred, lazy and
   non-blocking. If the narrative is not loaded, nothing on the page is missing.
2. **Suite Directory interactive is the metric**, not page-load-complete. SM-1 measures
   reaching the Directory; a narrative that delays it is a regression by definition.
3. **Subset the fonts to latin.** The single largest lever on the number that matters.
4. **Preload only what the non-3D path needs.** The narrative bundle is never preloaded, never
   `fetchpriority="high"`.
5. **No `loading="lazy"` on an LCP element.** On the non-3D path the LCP element is the display
   heading, which is text, one more reason to prefer it over a poster image.

**Open, and worth measuring before Epic 2:** the actual narrative bundle and asset weight.
The library estimate above is inference from published sizes, not a measurement of your build.
If it lands above ~450 KB, the trade to examine first is `@react-three/postprocessing`, which
is the largest optional item in that list.

---

## Responsive & Platform

**Mobile-first.** Authored at 360px. NFR-5: Hub requirements are satisfied on a mobile
viewport before a desktop one.

| Width | Behaviour |
|---|---|
| **360px** | The design floor. Every requirement holds here. Status never truncates (FR-3) |
| **390px** | Daniela's likely device. Reference width for the mocks |
| **≥760px** | Suite Directory rows gain columns: name and metadata left, description and links centre, status right. **Same markup, one grid change** |
| **≥1280px** | Content capped by `{spacing.measure}` on prose. The page does not stretch to fill |

**The row is the unit at every width.** Nothing reflows into cards. One layout to maintain,
across eight repositories, by one person, indefinitely.

**Platform notes**

- `oklch()` is required. Baseline widely available; no fallback ladder is provided, and that
  is a deliberate simplification for a portfolio estate rather than a consumer product.
- `color-scheme: dark` on `:root` in every Satellite so native controls and scrollbars render
  dark (S-11).
- No print stylesheet is in the contract. The Anchor keeps its own (`_print.scss`), which
  correctly uses real white and real black.

---

## Inspiration & Anti-patterns

The design brief named a public reference for what to avoid:
[`nutlope/hallmark`](https://github.com/nutlope/hallmark). Its rules are treated as a
conformance floor, not a suggestion.

### The tension, named

Hallmark's **#1 critical** anti-pattern is *"the purple-gradient hero"*, and the stated
palette preference is purple. These do not actually conflict, but the difference is the whole
design:

| Slop | This system |
|---|---|
| Purple as a large decorative **fill** | Purple as a single **anchor hue**, tinting near-black neutrals |
| Gradient background | Solid surfaces only |
| Accent as a colour block | Accent ≤3% of viewport, as a highlighter |
| `#000` ground | `oklch(12% 0.011 288)`, never pure |
| Gradient headline text | Solid type; emphasis by weight and width |

Purple is not the problem. Purple *used as a fill* is.

### Specific tells this design structurally cannot produce

- **Three-column icon-tile feature grid**: the directory is a list with rules. There is no
  card and no icon.
- **Card-in-card**: the Tracker Family group is the only containment layer in the directory.
- **Full-viewport centred hero**: hero height follows content; display type is left-biased.
- **Shadow-glow on dark**: there are no shadows in the system at all.
- **The AI nav**: two destinations, no CTA button, no filled button anywhere.
- **The AI footer**: one row of links, no four-column Product/Company/Resources/Legal block.
- **Aurora blobs, floating orbs, glassmorphism**: no decorative layer exists.
- **Eyebrow on every section**: plate marks appear on section heads that carry a genuine
  ordinal or domain, not by default.
- **Inter-everywhere**: three distinct families with a ≥300-unit weight gap.
- **Invented metrics**: banned in § Voice and Tone. Every number in the interface is a real
  count.
- **Generic emoji as icon**: the system has no icon set. The only glyphs are an arrow, an
  external-navigation mark and a 4px square.

### Kept from the site being reshaped

Not everything is replaced. The near-black ground, the wide caps, the hairline rules, the
generous fluid page padding and the refusal to use a filled button are all carried forward
from `cuatro-portfolio` v2.5.3, deliberately, because this is a reshape of a working site.

---

## Open Items

| # | Item | Blocks |
|---|---|---|
| O-1 | The six Registry descriptions are **drafts written to the FR-8 contract from inferred behaviour**. Confirm each describes the software accurately | Epic 2 |
| O-2 | Narrative bundle and asset weight are **unmeasured**. § Asset Budget carries an estimate, not a measurement | Epic 2, SM-C5 |
| O-3 | Whether `@plugin "daisyui/theme"` accepts a `var()` reference: undocumented. Cheap to test in a scratch `mix phx.new` | Epic 1 Step 2, seam S-9 |
| O-4 | `cuatro-finance` and `cs-tournament` real Status: assumed, not confirmed (PRD §13 Q9). Changes the composition of the first six | Epic 2 |
| O-5 | Whether `list-wheel`'s new subdomain is `wheel.cuatro.dev`: used as a placeholder in the mocks | Epic 2 |
| O-6 | `--confillia-bold` has zero call sites and is safe to delete. `--confillia-normal` has **two**, at `HomeLayout.scss:117` and `:148` *(re-baselined 2026-08-15; was `:8`/`:246` on `main`)*, and is retargeted to `--f-display` at `wdth 75`. Confirm that reads acceptably before step 5 | Migration step 5 |
| ~~O-7~~ | ~~Which Phoenix version is `cs-tracker` on?~~ **Closed 2026-08-15.** `{:phoenix, "~> 1.8.7"}` with Tailwind v4 (`@import "tailwindcss" source(none)`) and daisyUI via `@plugin "../vendor/daisyui"`. **`cs-tracker` takes the adapter route** (AD-15) | Closed |
| ~~O-10~~ | ~~The palette reconciliation.~~ **Decided 2026-08-15: the contract palette wins.** Cybercore's hardcoded values map to token roles; full mapping in [`rebaseline-2026-08-15.md`](rebaseline-2026-08-15.md) § O-10. Story 1.18 is unblocked | Closed |
| ~~O-11~~ | ~~`--accent-glow` is declared with zero call sites.~~ **Closed 2026-08-15 with evidence.** Exactly one occurrence in the repository: its own declaration at `app.scss:11`. Nothing reserved. **Deleted at Story 1.18** | Closed |
| ~~O-12~~ | ~~Three expressive surfaces have no role in a single-hue palette.~~ **Closed 2026-08-15.** **Item 1**, GlitchText's aberration: **dropped**, not excepted (Story 2.27). **Item 2**, ScanlineOverlay's blacks: the effect retires and the legibility job it was doing becomes **`--token-scrim`** in Contract `v1.0.0` (Story 2.28). **Item 3**, the decorative numeral: **not** dissolved by any redesign: it is an accessibility question, and **both branches are specified** in § Component Patterns → Error surface, so Story 2.30 tests and records rather than stalling | Closed |
| O-8 | The 44×44px floor must be **measured in a browser**, not read off the CSS, on the Hub and on `cs-tracker` after adoption | Epic 2 |
| O-9 | Greyscale check of the Status taxonomy: render the Directory desaturated and confirm all four values remain distinguishable | Epic 2 |
| **O-13** | **`aria-label` sits on generic roles in two shipped components**: a `<div>` at `GlitchText.tsx:72`, a `<p>` at `Error404.tsx:41`. A name on a generic role is not reliably exposed, so neither component's accessible name is dependable today. **This is a pre-existing defect, not one this design introduces**, and it is not in § Information Architecture's three-defect list. Fixed by Stories 2.27 and 2.30 as part of their redesign | Stories 2.27, 2.30 |
| **O-14** | **Which surfaces of each wave-1 Satellite sit inside the restyle floor**: that is, are reachable by a Visitor without authenticating. Determinable now, from outside each application, and it sets Epic 8's real per-application cost. If a rendered application's only unauthenticated surface is a login screen, its floor collapses to one screen and that should be known before Story 8.1 is estimated | Epic 8 |
| **O-15** | **What each wave-1 Satellite actually has installed**, so [`RESTYLE-SPEC.md`](RESTYLE-SPEC.md) § Displacing a component library picks the right family per application. `cs-tracker` is confirmed family A (Tailwind v4 + daisyUI, O-7). `digital-library` and `list-wheel` are **assumed** family C and family B respectively and are **not verified** | Stories 8.2, 8.3 |

| ~~O-16~~ | ~~`epics.md` Story 2.28 still says the role is *added* at `Contract v1.1.0`.~~ **Closed 2026-08-16 by `bmad-create-epics-and-stories`.** Story 2.28 is retitled and now **consumes** the role; the `v1.1.0` bump criteria and the Epic 6 credit are deleted; every live `v1.1.0` reference in `epics.md` is swept. **Story 1.11 was also wrong** and is corrected: it published *eleven* palette values and *eleven* roles, and the contract carries **twelve** of each. **Epic 6's trigger is restated**: the count was never two, it was always **zero performed**, because a value present at first publication was never a hand-copy. **The AD-16 rehearsal is recovered deliberately in Story 1.20**, which now writes the change-propagation runbook and validates it on a throwaway `v1.0.1` that is never published | Closed |
| **O-17** | **Residual findings from this run's two lenses**, below the criticals that were fixed. The independent-implementation audit returned 26 High findings and the token lens 6; the criticals and the wrong numbers are resolved in these spines, and the remainder are recorded in the two reports rather than pretended away. Worth a triage pass before Story 8.1 opens, since most of them bite a Satellite implementer rather than the Anchor | Epic 8 |

Five lenses have now reviewed this pair. Run 1: [`review-rubric.md`](review-rubric.md),
[`review-token-contract.md`](review-token-contract.md),
[`review-accessibility.md`](review-accessibility.md), consolidated in
[`validation-report.md`](validation-report.md). Run 2, the restyle pass:
[`review-restyle-token-contract.md`](review-restyle-token-contract.md) and
[`review-independent-implementation.md`](review-independent-implementation.md).

**Run 2's token lens caught a real error and it is worth knowing about.** The scrim's contrast
table was computed by blending **luminances**, which is compositing in linear-light space; CSS
composites alpha in **gamma-encoded sRGB**. Every one of the five published ratios was wrong, by
enough to invert three verdicts, and a design rule had been written on top of them. The numbers in
these spines are the corrected ones and [`DESIGN.md`](DESIGN.md) § The scrim shows the arithmetic
so the next person can check it rather than trust it.

Every critical finding is resolved in these spines; the items above are what remains, and each
names what closes it.
