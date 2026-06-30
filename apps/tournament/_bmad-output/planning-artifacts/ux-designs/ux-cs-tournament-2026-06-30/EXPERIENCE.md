---
name: InclusivCup
description: IA, behavior, states, interactions, accessibility, and journeys for InclusivCup — the private CS2 double-elimination tournament app. The experience spine; DESIGN.md is the visual reference.
status: final
updated: 2026-06-30
sources:
  - ../../prds/prd-cs-tournament-2026-06-29/prd.md
  - ../../prds/prd-cs-tournament-2026-06-29/addendum.md
  - ../../briefs/brief-cs-tournament-2026-06-29/brief.md
  - ./.memlog.md
  - ./mockups/mock-home.html
  - ./mockups/mock-ceremony.html
  - ./mockups/mock-bracket.html
  - ./mockups/mock-leaderboards.html
  - ./mockups/mock-admin.html
design: ./DESIGN.md
---

# InclusivCup — Experience Spine

> The experience spine for InclusivCup: a private CS2 double-elimination tournament app for ~8–16 friends. Two reward tracks ship in v1 — the Champion bracket (skill) and the Awards Roulette (luck + niche stats) — wired to an automated demo-ingestion pipeline and surfaced through a mobile-first home that culminates in a spinning-wheel ceremony where nobody leaves empty-handed. Rationale prose is English; every UI string is Spanish (the product ships in Spanish). Visual identity, tokens, and color discipline live in `DESIGN.md` and are referenced by name as `{path.to.token}`. Requirements are owned by `prd.md` (FR-1…FR-34, UJ-1…UJ-5) and the PRD Glossary, mirrored here verbatim — never re-derived.

## Foundation

InclusivCup is **mobile-first and viewer-first**: the phone is the spec. Every spectator surface — Home/Timeline feed, Bracket, Leaderboards, Player stat detail, and the Ceremony — is designed single-column at ~390px and is usable one-handed around a live match. The **Admin console may assume a larger screen** — it is an operator tool (a two-pane app shell capped near 1080px), not a spectator one. `DESIGN.md` carries the layout, breakpoint, and spacing detail; this spine governs behavior.

The product is **dark-first and dark-only for v1** — light mode is explicitly out of scope. There is **no named UI system**: the interface is custom, and `DESIGN.md` (Broadcast Slate) is the single visual reference. Drama comes from motion, sequencing, and one reserved gold accent withheld from ~95% of the app — not from a loud palette.

**Every viewer surface is read-only.** The Glossary roles are exact: a **Viewer** is any authenticated Player or spectator with read-only access; an **Admin** is a Player with elevated permissions who runs the event. Per FR-4, FR-33, and FR-34, *all* event-mutating actions are **server-gated Admin-only** — advancing a Match, approving Ingestion, re-parse/rollback, marking a Forfeit, generating the Bracket, and starting the Ceremony are rejected server-side for non-Admins, not merely hidden. A Viewer never renders a mutating affordance: there is no disabled-but-present Approve, no greyed Avanzar arrow, no inert dispute button. A Viewer follows the entire event end-to-end — Bracket, Leaderboards, Timeline feed, Ceremony — with zero Admin capability appearing or succeeding (FR-34).

The product UI ships in **Spanish**. Comedy and shame Awards ship with sharp, funny framing — **there is no gentle mode** (the group is private and trusted; §2.2, FR-24).

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| **Home / Timeline feed** | App open (cold), nav tab | The single surfaced source of truth (FR-31): Bracket advances, Approved Match results, and Award reveals post here chronologically and live. Holds the personal "for you" hook and ties together every other surface. |
| **Bracket — map** | Nav tab, feed card → | The seeded double-elimination structure (FR-6): Winners bracket, Losers bracket, Grand final. Read-only overview; pan/zoom on a phone. |
| **Bracket — focused Match** | Bracket map node tap | One Match in detail: players, derived score, bracket position label, Bye/Forfeit/grace state. Admin sees `Avanzar`; Viewers do not. |
| **Leaderboards** | Nav tab, feed card → | Rate vs Volume rankings (FR-22, FR-23). `Tasa` / `Volumen` segmented toggle; only Approved stats; below-floor and DQ'd contributions hidden. |
| **Player stat detail** | Leaderboard row, feed mention | One Player's core, weird, and derived stats with the Matches behind them (FR-23). Mobile-first, no horizontal scroll on the primary ranking. |
| **Ceremony** | Home banner / nav tab (unlocks when Admin starts it) | The Awards Roulette reveal (FR-30): the INCLUSIV360 wheel, per-Spin Two-stage draws, Anti-sweep cap, Pity round, and the persistent verify affordance. Phone is source of truth; a wide shared-screen banner mirrors it. |
| **Admin console — Roster / registration** | Admin entry (gated) | Open/close the registration window; view/manage the Roster; surface unreconciled stat rows (FR-1, FR-2, FR-3). |
| **Admin console — Ingest (Pending → Approve)** | Admin entry (gated) | The ingest queue: parsed Pending stats, eyeball score + a few lines, **Aprobar** (FR-13). Re-parse / rollback live here (FR-14). |
| **Admin console — Bracket control** | Admin entry (gated) | Generate the seeded Bracket, advance Matches (`Avanzar`, tap or drag), mark `W.O.`, declare Match format/tie policy (FR-5, FR-7, FR-9, FR-10). |
| **Admin console — Awards catalog (the 12)** | Admin entry (gated) | Curate the 12-award catalog before the Ceremony: bucket, class, deciding stat, eligibility floor, blurred-until-Spin (FR-24). |
| **Admin console — Ceremony control** | Admin entry (gated) | Start the Ceremony, drive the Spins, run the Pity round (FR-30, FR-28). |
| **Evidence view** | Admin Match record; surfaced read-only to settle disputes | The demo hash + re-parse result + seed snapshot (FR-15, FR-27). **Read-only, evidence-only** — there is no in-app raise-dispute button (OQ-6); disputes are raised out-of-app in Discord and settled here. |

**Viewer vs Admin gating.** The first six surfaces are public read-only. The Admin console group (Roster, Ingest, Bracket control, Awards catalog, Ceremony control) is server-gated (FR-33). The Evidence view's *content* is viewer-readable as the dispute referee, but its mutating actions (re-parse, rollback) are Admin-only. The Ceremony nav tab is **locked** (dimmed + lock glyph, `{components.nav-tab}`) until the Admin starts it.

→ Composition reference: `mockups/mock-home.html`, `mockups/mock-bracket.html`, `mockups/mock-leaderboards.html`, `mockups/mock-ceremony.html`, `mockups/mock-admin.html` (final Spanish mocks; English drafts retained in `.working/`). Spine wins on conflict.

## Voice and Tone

Microcopy in **Spanish**, using the Glossary terms verbatim. Sentence case. The voice is playful and competitive — banter, not corporate cheer — and the comedy/shame framing is sharp and funny, never softened. Brand voice and aesthetic posture live in `DESIGN.md`; ethos line: *Fuerza en lo que otros ignoran*.

| Do | Don't |
|---|---|
| "Verificado desde el demo" | "Resultado confirmado por el sistema" |
| "Sembrado por el demo final · reproducible" | "Sorteo aleatorio justo, confía en nosotros" |
| "Verificar la ceremonia" | "Más info sobre la equidad" |
| "Aprobado" · "Pendiente" | "Procesado correctamente ✓" |
| "Quedaste fuera. Pero sigues vivo en 3 premios." | "¡No te rindas, sigue intentándolo! 💪" |
| "El Más Generoso — repartió 28 muertes como regalos." | "Jugador con más muertes (¡suerte la próxima!)." |
| "Cegó a los Suyos — 11 flashes a su propio equipo." | "Detalle: flashes accidentales al equipo." |
| "Ausente — W.O. en 03:42" | "El oponente parece no estar disponible." |
| "Pase directo" | "Avance automático sin rival (bye)" |
| "sin estadísticas" | "esta partida no cuenta para nada, lo sentimos" |
| "Nadie se va con las manos vacías." | "Premio de consolación para los que no ganaron." |
| "resuélvelo en Discord con esto" | "Abrir una disputa" *(there is no in-app dispute button — OQ-6)* |
| "Mín. 24 rondas — partidas inactivas descalificadas de los premios" | "No elegible (motivo no especificado)" |
| "Fuerza en lo que otros ignoran." | "Todos son ganadores aquí." |

**Transparency strings are load-bearing and fixed:** "Verificado desde el demo" (a stat's provenance), "Sembrado por el demo final · reproducible" (the seed), "Verificar la ceremonia" (the verify affordance). They appear wherever a number could be doubted.

## Component Patterns

Behavioral rules. Visual specs live in `DESIGN.md.Components` and are referenced by token.

| Component | Use | Behavioral rules |
|---|---|---|
| `{components.wordmark}` | Every surface | `INCLUSIVCUP`, invariant; never restyled per screen. Decorative only — not a control. |
| `{components.live-pill}` | Home, Ceremony | *En vivo:* dot pulses while the event/Spin is active. *Final:* swaps to the one permitted gold chrome once the event resolves. Static when not live. |
| `{components.feed-card}` | Timeline feed | Newest-first. Rail node color encodes type: hairline (neutral), live (advance), win (result), gold (an Award-reveal entry — a reveal artifact, FR-31). Tapping a card routes to its subject (Bracket Match, Leaderboard, Player detail). Read-only. |
| `{components.bracket-node}` | Bracket map + focused | Labeled by **bracket position** (Winners R1, Losers R1, Grand final) — never a running match number. Winner line ink-primary, loser ink-muted, score with win/loss tint. Only the resolved CHAMPION node may carry a gold border. |
| `{components.advance-control}` | Bracket control (Admin) | `Avanzar` arrow. Tap to advance, or **drag the winner forward** (FR-7). Idempotent — re-issuing the same advance never double-routes a Player. Server-gated; Viewers never render it. |
| `{components.segmented-control}` | Leaderboards | `Tasa` / `Volumen` toggle (FR-22). Switching re-ranks in place; each board states its class. Selection reads by tone + weight, no color fill. |
| `{components.stat-row}` | Leaderboards, Player detail | Value in tabular numerals so live ticks never jitter. win/loss tint only when the value *is* a match outcome. Tap a player row → Player stat detail. |
| `{components.award-card}` | Ceremony, Awards catalog | *Bloqueado:* monochrome, identity hidden, carries "Premio X de 12 — bloqueado hasta que gire". *Revelado:* name in gold, hairline warms; shows the deciding stat + bucket (Habilidad / Clutch / Rarezas del demo / Comedia). |
| `{components.roulette-wheel}` | Ceremony | The INCLUSIV360 motif and only full circle. *Pre-spin:* hub blurred-locked. *Spinning (Stage 1):* decelerating conic sweep. *Resolved:* category card flips to gold. One trophy per Spin. |
| `{components.reveal-flip}` | Ceremony | The locked→revealed transition. Motion + gold arrival carry the drama; nothing elsewhere changes color. Has a non-animated path under reduced-motion (see Accessibility). |
| `{components.prize-chip}` | Ceremony, winner detail | The Inclusiv token-shirt prize, gold-tinted because a prize is a reveal artifact. Display only — prizes settle outside the app (no money in the app). |
| `{components.verify-strip}` | Ceremony (persistent) | Shield + "Sembrado por el demo final · reproducible", SHA-256, "Verificar la ceremonia" button in blue (system trust, not reveal). Persistent through the Ceremony. |
| `{components.blurred-lock}` | Ceremony, catalog (Viewer) | 7px blur + lock glyph hides an Award's identity until its Spin. No gold leaks through the blur. |
| `{components.approve-button}` | Ingest queue (Admin) | The system's single solid blue fill. "Aprobar" advances the Bracket, posts the feed card, and recomputes leaderboards — one action, three consequences (FR-13). |
| `{components.evidence-block}` | Evidence view | Read-only hash + re-parse + seed detail. **No raise-dispute button** (OQ-6); the block *is* the dispute resolution. |
| `{components.grace-timer}` | Bracket Match | No-show countdown `MM:SS` in tabular numerals; shifts to loss-red as the Forfeit threshold nears ("Ausente — W.O. en MM:SS"). |
| `{components.bye-badge}` | Bracket | "Pase directo", neutral. Structural, not an outcome — never reads as a win. |
| `{components.forfeit-badge}` | Bracket, feed | "W.O. / Ausente" in loss-red, carrying "sin estadísticas" — the Match contributes no stats (FR-17). |
| `{components.anomaly-flag}` | Ingest queue (Admin) | Parse anomaly needing review, loss-red on faint tint. Never blocks the Bracket silently — it surfaces for Admin attention. |
| `{components.nav-tab}` | Every viewer surface | Four-up row. Active = blue underline. The Ceremony tab is **locked** (dimmed + lock glyph) until the Admin starts it — never gold. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold feed (first load) | Home | Render cached feed if present; otherwise skeleton feed-cards. "Cargando el evento…" — never a blank screen. |
| Live feed | Home | `{components.live-pill}` pulses; new entries arrive within ~2 s of an Approved event (FR-31). Newest-first; no manual refresh. |
| Pre-event empty | Home, Bracket | Before the Bracket is generated: "El evento aún no empieza. Inscripciones abiertas." Bracket shows the Roster, not nodes. |
| Pending → Approved (FR-13) | Ingest (Admin) | Parsed stats land **Pendiente**, visible only to the Admin, excluded from leaderboards, Award eligibility, and Bracket advancement. On **Aprobar**: stats publish, the Match can advance, the feed posts. Viewers never see Pending. |
| Re-parse / rollback (FR-14) | Ingest, Evidence (Admin) | Re-parse replaces stat rows idempotently (no duplicates on `match_id` + SteamID64). Rollback removes a Match's leaderboard contribution and reverts dependent Bracket advancement, returning it to Pending/unparsed. Both logged. |
| Forfeit / Walkover (FR-17) | Bracket, Leaderboards, feed | A Forfeit produces **no Stat row** for either Player. The advancing Player gets a structural advance, not a phantom stat win. Leaderboards **normalize per Matches actually played** — rate Awards over rounds actually played, volume Awards over completed Matches only. `{components.forfeit-badge}` carries "sin estadísticas". |
| Bye (FR-8) | Bracket | The Player advances with `{components.bye-badge}` "Pase directo" and creates no stats. Neutral chrome — a Bye is structural, never an outcome. |
| Grace-timer no-show (FR-9) | Bracket Match | `{components.grace-timer}` counts down `MM:SS`, shifting to loss-red near the threshold. Only after it elapses can the Admin mark `W.O.`; the present Player advances; the Forfeit is logged with who and when. |
| Blurred-until-ceremony (FR-24) | Leaderboards, Ceremony | Award categories are hidden from Viewers behind `{components.blurred-lock}` until their Spin. A Viewer can lead a *stat* (e.g. knife kills) without knowing which Award it feeds — keeping every race alive to the ceremony. |
| AFK/idle DQ + anti-farm floor (FR-21) | Leaderboards, Player detail | Players below the floor are hidden from rate boards with "aún no elegible · Mín. 24 rondas". An idle-DQ'd Match's stats are excluded from all Award eligibility; the Admin console shows the `idle_dq` marker + idle-round count. "Min 24 rondas — partidas inactivas descalificadas de los premios." |
| Evidence view (FR-15 / FR-27) | Evidence (read-only) | Shows the retained demo's SHA-256, re-parse result, and seed snapshot, byte-for-byte verifiable. "resuélvelo en Discord con esto." No in-app dispute action. |
| Reveal / Spin states | Ceremony | *Bloqueado* → *Girando* (Stage 1 luck) → *Resuelto* (Stage 2 stats) → *Revelado* (gold flip). One trophy per Spin; the Pity round closes the sequence. |
| Offline / realtime-lag | Any viewer surface | If the realtime channel drops, hold the last known truth and show a quiet "Reconectando…" — never wipe the feed or invent state. Reads stay available; no optimistic mutation on a viewer surface (they have none). On reconnect, reconcile silently to the Approved truth. |
| Identity reconciliation (FR-2) | Roster, Ingest (Admin) | A parsed Stat row joins to its Roster entry by **SteamID64** (the canonical key), tolerating Steam display-name changes — a renamed Player never breaks the link to their stats. A row whose SteamID64 matches no Roster entry surfaces in the Admin Roster as **unreconciled** for one-tap manual linkage; it never silently drops. |
| Match format / tie policy locked (FR-10) | Bracket control (Admin), Bracket Match | Each Match's format and overtime/tie rule is declared and **stored before the Match starts**, then enforced unchanged — no ad-hoc mid-Match change. A Match cannot be marked complete under a format different from the one stored; any manual override (e.g. a mis-declared format) is written to the Audit log (logged + flagged on the record). |
| Award tie → shared co-winner (FR-29) | Ceremony, Awards | When two Players tie on a deciding stat, the **Award-tie ladder** — a fixed, deterministic order published in the reproduction snapshot — breaks it; if it bottoms out, the Award is a **shared co-winner trophy**. The reveal presents both names on one `{components.award-card}`, two `{components.prize-chip}`s, and the screen reader announces both. The ladder's exact rung order is a catalog/Architecture detail; the UX guarantees it is deterministic, reproducible via "Verificar la ceremonia", and that co-winners are a designed outcome, never an error state. |

## Interaction Primitives

Mobile, one-handed. Tap is the universal act.

- **Tap to act / tap to navigate.** Feed cards, leaderboard rows, and bracket nodes route on tap. Viewers only ever navigate — they never mutate.
- **Drag-to-advance (Admin, FR-7).** On Bracket control, the Admin advances a Match by tapping the `Avanzar` arrow *or* dragging the winner forward into the next slot. Both paths are idempotent and server-gated.
- **Rate vs Volume segmented toggle.** `Tasa` / `Volumen` switches the leaderboard class in place (FR-22) — a deliberate, reversible toggle, not a hidden filter.
- **Spin → flip → reveal (Ceremony).** Each Spin: the wheel decelerates (Stage 1 luck picks the live category), then the category card flips to gold (Stage 2 stats resolve the winner). One award per Spin, maximal per-reveal suspense.
- **Verify-the-seed.** "Verificar la ceremonia" recomputes the draw client-side from the published seed + stat snapshot + algorithm and shows it matches (FR-27). A first-class affordance, persistent during the Ceremony — skepticism is welcomed, not deflected.
- **Banned everywhere:** disabled-but-visible mutating controls on viewer surfaces; an in-app raise-dispute button (OQ-6 — evidence-only); gold on anything outside the reveal set; a running "match number" anywhere the bracket position is the label; auto-refresh that wipes feed scroll position; hover-only affordances (this is a touch product).

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md`.

- **Reduced motion is CRITICAL for the Ceremony.** When `prefers-reduced-motion` is set, the wheel does **not** spin and `{components.reveal-flip}` does **not** animate: the category resolves and the winner's name appears directly in gold, with a brief, non-animated emphasis. The *outcome and order are identical* to the animated path — only the motion is removed. Reduced motion must never cost a user the reveal or its drama; it changes the delivery, not the result.
- **Tap targets ≥ 44px.** Every interactive element — feed cards, nav tabs, leaderboard rows, the `Tasa`/`Volumen` toggle, the verify button, the Admin `Aprobar`/`Avanzar` controls.
- **Tabular-numeral legibility.** All stats, scores, seeds, timers, counters, and hashes render with tabular lining numerals (`{typography.numeral}`) so live-updating columns align and never reflow as values tick.
- **Focus order follows reading order** on every surface. `Esc` closes the topmost overlay. The Ceremony's persistent verify-strip is reachable in tab order at all times.
- **One-handed reach.** Primary actions sit in the lower two-thirds on the phone; the four-up nav row is thumb-reachable; nothing essential lives in a top corner.
- **Screen-reader labels for live updates + reveals.** New feed entries announce via `aria-live` ("Resultado aprobado: Dex venció a Theo 16-13"). Each Award reveal announces name + bucket + deciding stat ("Don Clutch — Clutch — 4 clutches 1vX"). The grace timer announces threshold crossings, not every tick. Live/Final pill state changes are announced.

## Provably-Fair & Verification

Trust is the keystone, and it is a *visible* affordance, not a claim.

- **The seed is the final demo's hash.** `seed = SHA-256(final_demo_bytes)` — the championship-deciding Match's retained `.dem` (FR-15, FR-27). It is fixed once the final Demo is Approved; there is no re-roll.
- **Published reproduction snapshot.** With results, the app publishes the seed, the locked Approved stat snapshot, the catalog (buckets / classes / deciding stats / floors), and the algorithm/version — everything needed to recompute the Ceremony.
- **In-app verify affordance.** `{components.verify-strip}` + "Verificar la ceremonia" runs the reproduction client-side and shows the live-category selections and winners match the published outcome. Provenance chrome is **blue** (system trust), never gold (reveal drama).
- **Evidence-only disputes (OQ-6).** There is no in-app raise-dispute button. A skeptic inspects `{components.evidence-block}` — re-hash the retained demo, re-parse it byte-for-byte, verify the seed — and raises any argument out-of-app in Discord. "resuélvelo en Discord con esto." The demo settles it, not the Admin's word (UJ-3, SM-3).

## Live & Realtime

- **~2 s propagation.** Approved Match results, Bracket advances, and Award reveals reach connected Viewers within ~2 s, with no manual refresh (FR-7, FR-31; NFR).
- **Approved-only.** The feed reflects only Approved events; Pending Ingestion never posts. The line between "the Admin sees it" and "everyone sees it" is the **Aprobar** action.
- **Optimistic vs confirmed.** Viewer surfaces are read-only and therefore never optimistic — they show confirmed Approved truth only. Admin actions may render optimistically in the console, but the *published* state (feed, leaderboards, bracket) updates only on server confirmation, so no Viewer ever sees a result that later un-happens.

## Ceremony Choreography

The Ceremony is the product's climax — the move that manufactures spotlight for the players the bracket left behind. It paces the 12-award Spanish catalog one award per Spin, then closes with the Pity round.

1. **Locked.** The Ceremony tab unlocks when the Admin starts it; the wheel hub is blurred-locked; all 12 categories sit behind `{components.blurred-lock}` ("Premio X de 12 — bloqueado hasta que gire"). The entry banner reads "La ceremonia está en vivo · Entrar a la ceremonia".
2. **Spin → Stage 1 (luck).** The INCLUSIV360 wheel decelerates. "Fase 1 — la suerte elige la categoría." Seeded luck (with the hidden Anti-sweep luck-meter biasing toward empty shelves) picks the live category for this Spin.
3. **Stage 2 (stats).** "Fase 2 — las estadísticas eligen al ganador." The eligible Player with the best deciding stat in the locked snapshot wins, deterministically; ties resolve via the Award-tie ladder (FR-29), bottoming out in a shared co-winner trophy.
4. **One-trophy cap.** "un trofeo por giro." If a Player would win two live categories in one Spin, they take the higher-priority one; the other passes to the next eligible Player (FR-26).
5. **Reveal.** `{components.reveal-flip}` flips the category card to gold; name, deciding stat, and `{components.prize-chip}` (the Inclusiv token shirt) appear. The feed posts the reveal. Then the next Spin.
6. **Pity round.** After all 12, every Player still holding zero Awards enters the **ronda de consolación** — a separate, seeded, guaranteed draw (FR-28). "Nadie se va con las manos vacías."
7. **Champion crowning.** The resolved CHAMPION node carries its gold border; the crowning is part of the ceremony arc.
8. **Recap / shared-screen mode.** The phone reveal is the **source of truth**; a wide three-column shared-screen banner mirrors it so the table sees the same truth on a cast screen (FR-30). The banner never diverges from the phones. The whole ceremony is replayable/linkable afterward and reproduces identical winners.

## Inspiration & Anti-patterns

- **Lifted from the sportsbook / broadcast scoreboard:** data-dense calm, tabular numerals, hairline structure, a live pill. Hours of bracket play should feel trustworthy and quiet, not loud.
- **Lifted from The Inclusiv Brand (theinclusivbrand.com):** the INCLUSIV360 circular motion graphic *becomes* the Awards Roulette wheel; prizes are Inclusiv token shirts; the ethos *Fuerza en lo que otros ignoran* is the literal thesis — everyone has something to play for.
- **Lifted from provably-fair draw systems:** publishing the seed + snapshot + algorithm and offering an in-app recompute, so fairness is checkable rather than asserted.
- **Rejected — participation-trophy framing.** The Pity round is *not* "everyone's a winner" consolation. The awards spotlight **strength in what others ignore** — knife kills, through-smoke frags, eco heroics, gloriously bad generosity — framed sharply and competitively. "Nadie se va con las manos vacías" is a promise of spotlight, not a pity-pat.
- **Rejected — the casino aesthetic.** It is a wheel and a draw, but never neon, coins, or jackpot chrome. Gold is reserved and motion is disciplined precisely so the reveal lands as an *event*, not a slot machine.
- **Rejected — gentle/opt-out mode for shame awards.** The group is private; the comedy bucket ships sharp (FR-24, §5). Revisit only before any non-private deployment.
- **Rejected — an in-app dispute button.** Disputes belong in Discord; the app's job is to make the evidence irrefutable (OQ-6).

## Responsive & Platform

| Breakpoint | Behavior |
|---|---|
| **Phone (~390px) — viewer default** | Single-column. App bar (wordmark + live pill), four-up nav row, scrolling content below. Every viewer surface (Home, Bracket, Leaderboards, Player detail, Ceremony) is one-handed. This is the spec. |
| **Shared screen / stream (wide) — Ceremony only** | A three-column recap-ready banner mirrors the phone reveal (FR-30). The phone is source of truth; the banner never diverges. |
| **Desktop — Admin console** | A two-pane app shell: fixed ~212px left nav rail + fluid main column (ingest queue, evidence view), capped ~1080px. The one surface allowed to be denser and wider. Admin may assume a larger screen; viewers may not be assumed to have one. |

## Key Flows

### Flow 1 — Still in two award races (Theo, knocked out early, ~9pm, on his phone) — UJ-1

1. Theo loses his second bracket Match; his run is over. Authenticated via Steam, he opens Home.
2. The Timeline feed shows his elimination — and directly below it, that newly Approved stats put him **#1 in knife kills** and **#2 in "El Más Generoso"** (most deaths).
3. He taps through to Leaderboards and flips `Volumen`; he's leading the knife-kills board outright.
4. The Awards categories are still behind `{components.blurred-lock}` — any of those stat leads could feed a live Award at the Ceremony.
5. **Climax:** Theo sees he is leading one volume race outright and alive in two more, with the categories blurred so *nothing is decided yet*. He is not out of anything. He stays in the group chat trash-talking and shows up for the ceremony (→ Flow 4).

Failure: a stat lead evaporates when a later Match is Approved → the leaderboard re-ranks live within ~2 s; Theo sees the change honestly, no stale podium.

### Flow 2 — Ingest a finished Match without a spreadsheet (Mara, organizer, laptop) — UJ-2

1. A bracket Match ends on the MatchZy server; the Demo lands in Ingestion and parses into per-Player stat rows.
2. The rows appear **Pendiente** under that Match in Mara's ingest queue — visible to her, invisible to Viewers.
3. She opens the Pending Match, eyeballs the derived score and a couple of stat lines (the conservation check holds: kills = deaths).
4. She taps **Aprobar** (`{components.approve-button}`).
5. **Climax:** in one action the Bracket advances the winner, the Leaderboards recompute, and the Timeline feed posts the result — live, on every Viewer's phone, within ~2 s. Total hands-on time: under a couple of minutes (SM-C2).

Failure: the parse throws an `{components.anomaly-flag}` (e.g. a 0-stat row) → it surfaces for review and does **not** auto-publish; Mara re-parses or investigates before approving.

### Flow 3 — The demo settles a dispute (Dex, loudly accusing the Admin of rigging) — UJ-3

1. Dex insists an Approved score is wrong and is accusing Mara of rigging in Discord.
2. Mara opens the Match in the Admin console and triggers a **re-parse** of the retained raw Demo.
3. The parsed score is identical; the published demo hash matches the retained file byte-for-byte (`{components.evidence-block}`).
4. The Evidence view is shown — read-only, no dispute button, just "Verificado desde el demo" and the matching SHA-256. "resuélvelo en Discord con esto."
5. **Climax:** the result resolves byte-for-byte to the demo. There is nothing to argue with — the dispute closes against the **demo**, not Mara's word (SM-3).

Failure: re-parse reveals the original Approval was genuinely wrong → Mara rolls back (FR-14), the Bracket and leaderboards revert, and the corrected truth re-publishes — the evidence trail still holds.

### Flow 4 — The ceremony, and nobody leaves empty-handed (the whole group, shared screen + phones) — UJ-4

1. The championship Match is Approved; the final Demo is retained and hashed — fixing the seed. Mara starts the **Ceremony**; the tab unlocks ("La ceremonia está en vivo · Entrar a la ceremonia").
2. Spin 1: the INCLUSIV360 wheel decelerates ("Fase 1 — la suerte elige la categoría"); Stage 2 resolves the winner from the locked snapshot ("Fase 2 — las estadísticas eligen al ganador"); the card flips to gold; a token-shirt `{components.prize-chip}` appears.
3. The Spins march through all 12 awards, one trophy per Spin ("un trofeo por giro"); the Anti-sweep cap stops any one stat-monster from hoovering a single Spin (FR-26).
4. After the 12, the **ronda de consolación** runs: every Player still on zero Awards gets a guaranteed Pity draw ("Nadie se va con las manos vacías", FR-28).
5. **Climax:** every category flips dramatically; the winless are guaranteed a consolation; the CHAMPION node crowns in gold; and the persistent "Verificar la ceremonia" lets any skeptic recompute the entire ceremony from the published seed — Theo (Flow 1) wins his knife-kills Award. Everyone won *something*, and anyone can prove it was fair.

Failure / reduced motion: a Viewer has `prefers-reduced-motion` set → the wheel doesn't spin and cards don't flip; winners resolve directly in gold in the identical seeded order. The drama is in the reveal, not the animation — nobody is shortchanged.

### Flow 5 — A clean no-show (Mara, a player never shows) — UJ-5

1. A scheduled bracket Match has one absent Player; the `{components.grace-timer}` runs ("Ausente — W.O. en MM:SS"), shifting toward loss-red as the threshold nears.
2. The grace timer expires. Only now can Mara mark the absent Player a **Forfeit** (`W.O.`); the action is logged with who and when (FR-9).
3. The present Player advances — with a structural advance, **not** a phantom stat win.
4. The forfeited Match contributes **no stats** to either Player; the `{components.forfeit-badge}` carries "sin estadísticas", and Leaderboards normalize per Matches actually played (FR-17).
5. **Climax:** bracket integrity is preserved with zero manual stat surgery — no invented numbers, no skewed averages. The advancing Player's leaderboards look exactly as if the no-show never happened, because for the stats, it didn't.

Failure: the absent Player arrives mid-grace-timer → Mara does not mark `W.O.`; the timer is moot and the Match proceeds normally. The Forfeit can only finalize *after* the timer elapses (FR-9), so there is no premature, un-doable forfeit.
