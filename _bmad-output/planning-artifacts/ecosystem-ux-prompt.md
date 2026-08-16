# UX prompt — Cuatro Ecosystem

Drafted 2026-08-15, after `bmad-prd` completed. Paste the block below into a **fresh**
Claude Code session opened at `c:\Development\cuatro-portfolio`.

Runs before `bmad-architecture`, which consumes PRD + research + this UX output.

---

/bmad-ux

## Read these first, in this order

1. `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/prd.md`
   — start at §1 Vision, §2 Target User (journeys UJ-1…UJ-4), §4 Features,
   §9 MVP Scope, §11 Success Metrics
2. `_bmad-output/planning-artifacts/prds/prd-cuatro-portfolio-2026-08-15/addendum.md`
   — §B Status taxonomy, §C.1 registry shape, §C.2 the Anchor's actual stack
3. `_bmad-output/planning-artifacts/research/technical-cuatro-ecosystem-architecture-2026-08-15/research.md`
   — **§D2 only** (design system: the token contract, where the ceiling is, the
   Phoenix LiveView outlier, why web components are not the escape hatch)

The technical foundation and the product definition are both settled. **Do not
re-decide either.** This run decides how the ecosystem *looks and feels*.

## What this UX work must produce

Fifteen personal projects are becoming the **Cuatro Ecosystem** — one suite at
`cuatro.dev`, in the sense that Google Suite or Adobe Suite are suites. Six frontend
frameworks (Next.js, React/Vite, Svelte, Vue, Angular, Phoenix LiveView) and five
backend languages must **visibly belong to each other** without any shared component
code, because a component library provably cannot span them.

Three deliverables, in priority order:

### 1. The Design Token contract — with real values (highest priority)

This is the single most load-bearing output. Epic 1 Step 2 — the first visible
ecosystem moment — is "hand-copy one `tokens.css` into the Anchor and one other Live
app." That step is blocked until the tokens exist as **actual values**.

Produce a complete token set: color (including semantic roles, not just a palette),
type scale, spacing scale, radii, elevation/shadow, motion durations and easings,
and border/stroke treatments. Constraints that are already fixed:

- **Plain CSS custom properties on `:root`** is the universal artefact. Every one of
  the six frameworks consumes it natively. A generated Tailwind `@theme inline`
  adapter is a second artefact for the Tailwind cluster.
- **The Anchor is Sass/SCSS with no Tailwind** — confirmed on disk. `cuatro-portfolio`
  uses an atomic-design structure (`components/atoms|molecules|organisms`, each with
  its own `.scss`) and `app/scss/`. The Tailwind cluster is `cuatro-finance`,
  `cuatro-tracker` and `cs-tournament`, which are *merge targets*, not the Anchor as
  it exists today. See PRD §12.2 / FR-17. **Give me the migration path from the
  current SCSS variables to tokens** — that is real work in an existing shipping app
  (v2.5.3), not a greenfield choice.
- **Light and dark must both be defined.** Several satellites already have themes.
- Tokens must not assume a build step — a Phoenix LiveView app must be able to consume
  them from a plain stylesheet.

Also give me the **honest ceiling**: the research is clear that tokens deliver "reads
as one author," not "feels like one product," because nothing federates *behaviour* —
form controls, focus management, overlays and dense data UI will differ permanently.
Tell me concretely where the seams will show, and which of those seams are worth
hand-fixing per app versus accepting.

### 2. The Hub front door — reshaped to story-then-suite

`cuatro.dev` today is a portfolio site with routes `/`, `/cv`, `/work`, `/projects`,
`/recommendation`, `/celeste`, plus a 3D narrative element. It becomes the front door
of a suite (FR-1 – FR-4).

- **Daniela** — recruiter/hiring manager, often on mobile, often with twelve tabs
  open, four minutes at most. Must leave with: *this person ships real things that
  stay up.*
- **Marcus** — senior engineer on a technical screen. Must get from any running app to
  its source in one hop, and must be able to find the seams.

Hard constraints from §11:
- **SM-1 targets ≥60% of sessions reaching the Suite Directory.** The narrative must
  frame the suite, never swallow it. The Suite Directory must be reachable
  independently of the narrative (FR-2).
- **SM-C5 counter-metric:** Hub asset weight. The 3D story must not delay first
  meaningful paint of the suite. If the narrative is expensive, tell me what it costs
  and what the budget should be.
- **SM-C1 counter-metric:** time on site is *not* a goal. Daniela forming a correct
  positive opinion in ninety seconds is a success.

**Close PRD open question Q7** — does the narrative get a static fallback on
`prefers-reduced-motion`, or is it simply skipped? Decide it.

**Close PRD open question Q8** — what happens to `/cv`, `/work`, `/recommendation` and
`/celeste`? They survive as routes (FR-1) but their navigation prominence is
unspecified. Decide it.

### 3. The Suite Directory and the Registry entry

The Suite Directory is the homepage climax (FR-35). At MVP it renders **only `Live`
and `Complete`** entries — six of them. The four `In progress` apps hold Registry
entries but stay unrendered.

Design the entry card: name, one-line description (≤3 sentences, reader-facing, no
marketing adjectives — FR-8), status, tech array, live link, source link (FR-10).
Both Daniela and Marcus read the same card and want different things from it.

Also specify the **Suite Switcher** as a pattern plus a data contract (FR-13 – FR-15).
It is deferred to v2 and implemented natively per satellite — so specify it as
something a Svelte app and a Phoenix LiveView app can each build from tokens and the
registry contract, **not** as a shared component. See PRD §15 / FR-15.

## Design direction

- **Six frameworks under one visual identity is the thesis.** The variety is the
  product, not the debt. The design should make heterogeneity read as *range*, not as
  incoherence (§14 names this as a Medium risk).
- The audience is a hiring audience. Evidence over adjectives.
- I would like to use the `frontend-design` skill's sensibility here — this should not
  look like generic AI-generated portfolio output. It is my public showcase.
- **Accessibility is not optional**: reduced-motion, keyboard navigation, focus
  visibility, and contrast ratios that hold in both themes. Focus management is
  explicitly named as something tokens *cannot* federate, so the Hub should set the
  reference standard the satellites copy by hand.
- Mobile-first. Daniela is on a phone.

## Constraints

- **Solo maintainer.** Anything designed must be maintainable by one person across
  eight repositories, by hand, indefinitely.
- **No shared component package across frameworks** — this is a decision, not a
  deferral (§8). Optionally one React-only package inside the Next.js cluster later.
- **Capacity is unproven** — 2 vCPU / 8 GB, a `docker stats` week is running.
  Nothing may assume headroom (SM-C4 wins every conflict).
- Four subdomains are live today and must keep working: `cuatro.dev`,
  `cs-tracker.cuatro.dev`, `tracker.cuatro.dev`, `library.cuatro.dev`.
- `cuatro-portfolio` is shipping at v2.5.3. This is a **reshape of a working site**,
  not a rebuild.

## Non-goals

- Redesigning the interior of any satellite application (Per-App Layer, §8)
- A shared cross-framework component library
- Cross-app identity UI — deferred to v2 (§9.2)
- Embedded Connect Four — v2 (§9.2)

## What I want out of it

Design specifications a fresh `bmad-architecture` run can consume, plus enough for me
to execute Epic 1 Step 2 immediately:

1. **The complete token set with real values**, in both artefact forms, plus the
   SCSS-to-token migration path for the Anchor
2. **A recommendation for which second app adopts tokens at Step 2** — PRD open
   question Q5. `cs-tracker` (Elixir) maximises the polyglot proof; `digital-library`
   (Svelte) is likely cheapest. Pick one and say why.
3. **The Hub front-door structure and flow**, with Q7 and Q8 closed
4. **The Registry entry card and Suite Directory layout**
5. **The Suite Switcher pattern + data contract**, framework-agnostic
6. **The seams inventory** — where token-only federation visibly fails, and the
   per-app hand-fix list worth doing anyway

Flag anything where a design decision would change a settled technical decision, the
way PRD §12 did. I would rather find it here than in architecture.
