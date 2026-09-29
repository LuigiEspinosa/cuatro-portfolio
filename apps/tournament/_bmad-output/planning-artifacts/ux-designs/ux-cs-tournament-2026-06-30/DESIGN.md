---
name: InclusivCup
description: Broadcast Slate — a dark-first, data-dense visual identity for a private CS2 double-elimination tournament app, where calm sportsbook clarity carries the event and a single reserved gold accent carries the ceremony.
status: final
updated: 2026-06-30
sources:
  - ../../prds/prd-cs-tournament-2026-06-29/prd.md
  - ../../prds/prd-cs-tournament-2026-06-29/addendum.md
  - ../../briefs/brief-cs-tournament-2026-06-29/brief.md
  - ./.memlog.md
  - ./mockups/mock-home.html
  - ./mockups/mock-ceremony.html
  - ./mockups/mock-admin.html
design: ./EXPERIENCE.md
colors:
  page: '#0F1419'
  surface-1: '#171E26'
  surface-2: '#1E2832'
  border-hairline: '#232C36'
  ink-primary: '#F4F6F8'
  ink-secondary: '#B7C2CE'
  ink-muted: '#8A97A6'
  accent-live: '#2F81F7'
  reveal-gold: '#FFB23E'
  win: '#3FB950'
  loss: '#F0556A'
typography:
  wordmark:
    fontFamily: 'Archivo, system-ui, sans-serif'
    fontWeight: '700'
    letterSpacing: 0.12em
    note: 'Uppercase, tight grotesk. Set in {colors.ink-primary}; the CUP fragment in {colors.accent-live}. Never gold, identical on every surface.'
  display:
    fontFamily: 'Archivo, system-ui, sans-serif'
    fontWeight: '700'
    lineHeight: '1.05'
    letterSpacing: 0.01em
    note: 'Hero numbers, winner names, big stat values. Tabular lining numerals always.'
  heading:
    fontFamily: 'Archivo, system-ui, sans-serif'
    fontWeight: '600'
    lineHeight: '1.25'
    note: 'Section titles, card titles, nav labels.'
  body:
    fontFamily: 'system-ui, -apple-system, Inter, "Segoe UI", Roboto, sans-serif'
    fontWeight: '400'
    fontSize: 14px
    lineHeight: '1.5'
  numeral:
    note: 'Not a font family — a hard rule. ALL stats, scores, seeds, hashes, counters, timers, and counts render with tabular lining numerals (font-variant-numeric: tabular-nums lining-nums; font-feature-settings "tnum" 1, "lnum" 1) so digits align in columns and never reflow as values tick.'
  meta:
    fontFamily: 'system-ui, -apple-system, Inter, "Segoe UI", Roboto, sans-serif'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
    note: 'Timestamps, captions, secondary labels. Often uppercase + tracked for eyebrows.'
rounded:
  sm: 6px
  md: 12px
  lg: 16px
  pill: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
components:
  wordmark:
    type: '{typography.wordmark}'
    color: '{colors.ink-primary}'
    accentFragment: '{colors.accent-live}'
    note: 'INCLUSIV in {colors.ink-primary}, CUP in {colors.accent-live}.'
  live-pill:
    text: '{colors.accent-live}'
    fill: 'rgba(47,129,247,0.12)'
    border: 'rgba(47,129,247,0.45)'
    radius: '{rounded.pill}'
    dotColor: '{colors.accent-live}'
    note: 'Live/Spinning state. Final variant swaps to {colors.reveal-gold} fill+text (the one chrome moment gold is allowed, because the event is over). Not-live variant is muted {colors.ink-muted} on transparent.'
  stat-row:
    label: '{colors.ink-muted}'
    value: '{colors.ink-primary}'
    valueType: '{typography.display}'
    radius: '{rounded.md}'
    surface: '{colors.surface-1}'
    note: 'Value uses tabular numerals per {typography.numeral}. win/loss tint only when the stat is a match outcome.'
  feed-card:
    surface: '{colors.surface-1}'
    surfaceRaised: '{colors.surface-2}'
    border: '{colors.border-hairline}'
    radius: '{rounded.md}'
    pad: '{spacing.3}'
    railNodeDefault: '{colors.border-hairline}'
    railNodeLive: '{colors.accent-live}'
    railNodeWin: '{colors.win}'
    railNodeReveal: '{colors.reveal-gold}'
    note: 'Rail node encodes entry type. railNodeReveal (gold) marks an Award-reveal entry only — a reveal artifact within the gold set (FR-31); all other rail chrome stays neutral, blue, or win-green.'
  bracket-node:
    surface: '{colors.surface-1}'
    border: '{colors.border-hairline}'
    radius: '{rounded.sm}'
    winnerInk: '{colors.ink-primary}'
    loserInk: '{colors.ink-muted}'
    scoreType: '{typography.display}'
    championBorder: '{colors.reveal-gold}'
    note: 'Ordinary node chrome is monochrome + hairline. Only the resolved CHAMPION node may carry {colors.reveal-gold}.'
  advance-control:
    text: '{colors.accent-live}'
    icon: '{colors.accent-live}'
    note: 'Admin-only. Arrow + label "Avanzar". Viewers never see this affordance.'
  segmented-control:
    track: '{colors.surface-2}'
    border: '{colors.border-hairline}'
    activeFill: '{colors.surface-1}'
    activeInk: '{colors.ink-primary}'
    inactiveInk: '{colors.ink-muted}'
    radius: '{rounded.sm}'
    note: 'Tasa vs Volumen (rate vs volume) leaderboard toggle. No gold, no blue fill — selection reads by tone + weight.'
  award-card:
    surface: '{colors.surface-1}'
    border: '{colors.border-hairline}'
    radius: '{rounded.md}'
    bucketLabel: '{colors.ink-muted}'
    revealedName: '{colors.reveal-gold}'
    revealedBorder: 'rgba(255,178,62,0.45)'
    note: 'Pre-reveal: monochrome, locked. Revealed: name in {colors.reveal-gold}, hairline warms to gold-tint.'
  prize-chip:
    surface: '{colors.surface-2}'
    border: 'rgba(255,178,62,0.40)'
    shirtGlyph: '{colors.reveal-gold}'
    tag: '{colors.reveal-gold}'
    radius: '{rounded.md}'
    note: 'Inclusiv token shirt. Gold-tinted because a prize is a reveal artifact.'
  roulette-wheel:
    ringGold: '{colors.reveal-gold}'
    ringBlue: 'rgba(47,129,247,0.45)'
    hubSurface: '{colors.surface-1}'
    pointer: '{colors.reveal-gold}'
    tick: '{colors.border-hairline}'
    note: 'The INCLUSIV360 motif. The ONLY full circle in the system. Gold ring + pointer are reveal chrome.'
  reveal-flip:
    from: '{colors.surface-1}'
    toName: '{colors.reveal-gold}'
    note: 'Locked-to-revealed transition for the category card. Motion + gold carry the drama, not a palette change elsewhere.'
  verify-strip:
    surface: '{colors.surface-1}'
    border: '{colors.border-hairline}'
    radius: '{rounded.md}'
    shield: '{colors.accent-live}'
    hashInk: '{colors.ink-muted}'
    button: '{colors.accent-live}'
    note: 'Provenance/verification chrome is blue — it is system trust, not reveal drama.'
  blurred-lock:
    blur: '7px'
    overlayInk: '{colors.ink-secondary}'
    lockIconSurface: '{colors.surface-2}'
    note: 'Hides award identity until its spin. Blur + lock glyph, no gold leak.'
  approve-button:
    fill: '{colors.accent-live}'
    ink: '#06203F'
    radius: '{rounded.sm}'
    note: 'Admin-only primary action. The one solid blue fill in the system.'
  evidence-block:
    surface: '{colors.surface-1}'
    border: '{colors.border-hairline}'
    monoInk: '{colors.ink-secondary}'
    radius: '{rounded.md}'
    note: 'Hash + re-parse + seed details. Read-only, evidence-only — no in-app dispute button (OQ-6).'
  grace-timer:
    ink: '{colors.ink-secondary}'
    activeInk: '{colors.loss}'
    type: '{typography.numeral}'
    note: 'No-show countdown MM:SS in tabular numerals; reads {colors.loss} as the forfeit threshold nears.'
  bye-badge:
    text: '{colors.ink-muted}'
    border: '{colors.border-hairline}'
    radius: '{rounded.pill}'
    note: 'Pase directo. Neutral — a bye is structural, not an outcome.'
  forfeit-badge:
    text: '{colors.loss}'
    border: 'rgba(240,85,106,0.35)'
    radius: '{rounded.pill}'
    note: 'W.O. / Ausente. Loss-red because it is a competitive result, but carries "sin estadisticas".'
  anomaly-flag:
    text: '{colors.loss}'
    surface: 'rgba(240,85,106,0.08)'
    border: 'rgba(240,85,106,0.30)'
    radius: '{rounded.sm}'
    note: 'Parse anomaly needing admin review. Loss-red signals attention, never gold.'
  nav-tab:
    inactiveInk: '{colors.ink-muted}'
    activeInk: '{colors.ink-primary}'
    activeIndicator: '{colors.accent-live}'
    lockedInk: '#5D6875'
    note: 'Underline indicator in blue. Locked tabs (e.g. Ceremony before grand final) are dimmed with a lock glyph — never gold.'
---

## Brand & Style

InclusivCup is a private CS2 double-elimination tournament for a group of 8–16 friends, and its visual language resolves one specific tension: the product must feel like a calm, trustworthy **sportsbook** for hours of bracket play, then erupt into a genuine **awards ceremony** at the end — without ever turning into a casino. The answer is Broadcast Slate: a dark, monochrome-leaning surface that lets stats lead and dashboards stay legible, with exactly two chromatic accents held in strict reserve. Blue carries everything live and trustworthy; gold is withheld from the entire app and spent only at the ceremony. Drama comes from **motion, sequencing, and one reserved color** — not from a loud palette.

The brand is anchored in The Inclusiv Brand (theinclusivbrand.com), a friend's Colombian clothing label whose ethos — *Fuerza en lo que otros ignoran* ("strength in what others ignore") — is the thesis of the whole product: everyone, not just the bracket winner, has something to play for. That ethos is literal here. Prizes are Inclusiv token shirts. The signature INCLUSIV360 circular motion graphic becomes the Awards Roulette wheel. The aesthetic inherits the brand's high-contrast, near-monochrome minimalism and geometric thin line work, and harmonizes it with the dark sportsbook palette without overriding it.

This is **dark-first and dark-only for v1**. Light mode is explicitly out of scope — the product is consumed at night, on phones, around a live match, and the dark surface is the canvas the ceremony's single gold accent needs to land against. The product UI ships in Spanish; this spine's rationale prose is in English. Comedy and shame awards ship with sharp, funny framing — there is no gentle mode.

## Colors

The palette is monochrome-leaning by design: a writing-surface-quiet field of near-blacks and cool greys, with blue and gold as the *only* chromatic accents and win/loss kept strictly for match semantics. The restraint is the point — a calm field is what makes the gold reveal feel like an event.

- **Page (`{colors.page}` `#0F1419`)** — the base canvas under everything. Deep blue-black, not pure black, so hairlines and surfaces have somewhere to sit. Used for the app background and the lowest layer of every screen. Not used as a fill on cards (that is what surfaces are for).
- **Surface-1 (`{colors.surface-1}` `#171E26`)** — the default raised plane: feed cards, stat rows, verify strips, the roulette hub. The workhorse container tone.
- **Surface-2 (`{colors.surface-2}` `#1E2832`)** — one step up for emphasis: the headline match card, the prize chip, the segmented-control active cell, the personal "for you" hook. Used to lift, never to shout.
- **Border-hairline (`{colors.border-hairline}` `#232C36`)** — the lowest legible separation. Almost all structure in the app is drawn with this 0.5–1px hairline rather than shadow. If a divider feels like UI, it is too heavy.
- **Ink-primary (`{colors.ink-primary}` `#F4F6F8`)** — primary text, winner names, the wordmark, hero stat values. Off-white, never pure white.
- **Ink-secondary (`{colors.ink-secondary}` `#B7C2CE`)** — supporting copy, secondary stats, hash strings, body inside cards.
- **Ink-muted (`{colors.ink-muted}` `#8A97A6`)** — captions, timestamps, eyebrows, locked/inactive labels, "sin estadisticas". The quiet voice.
- **Accent-live (`{colors.accent-live}` `#2F81F7`)** — electric blue. The single carrier of *live, selected, system-trust, and primary-action*: the live pill, active nav indicator, the CUP in the wordmark, verify chrome, the admin Approve button, advance controls, timeline live nodes. Blue is allowed throughout the app. It is **not** used for award reveals, winners, or anything ceremonial — those are gold's.
- **Reveal-gold (`{colors.reveal-gold}` `#FFB23E`) — the reserved accent.** This is the structural keystone of the whole identity. **Gold appears ONLY on:** award reveals (including award-reveal entries in the Timeline feed), award winners, the roulette / INCLUSIV360 wheel and its pointer, the CHAMPION crowning, the ceremony-entry banner, the Inclusiv token-shirt prize, and the trophy/shelf marks tied to a win. The single permitted chrome exception is the "Final" live-pill once the event is over (the event has become a reveal). **Gold is NEVER used for:** the wordmark, nav tabs, ordinary bracket or match chrome, the admin "pending" state, hyperlinks, focus rings, or decoration. Withholding gold from ~95% of the app is what gives the ceremony its charge. Treat any gold pixel outside the reveal set as a bug.
- **Win (`{colors.win}` `#3FB950`)** — match-outcome green. Winning score, "Aprobado/Verificado" ticks, advancing/won timeline nodes. Match semantics only — never a generic success accent or decoration.
- **Loss (`{colors.loss}` `#F0556A`)** — match-outcome red. Losing score, forfeit (W.O.) badges, parse anomalies, the grace-timer at threshold. Attention and competitive-loss only — never an error-fill aesthetic on a journal-style surface.

No gradients (a single decorative gradient on the ceremony banner glow is the lone tolerated exception and stays under 10% opacity). No additional accent hues. Two chromatic accents, each with a job, plus the two outcome colors — that is the entire chromatic budget.

## Typography

Two roles, one family for everything with character. **Archivo** (a tight grotesk) carries the wordmark, display numbers, headings, and every big stat — its geometric weight reads as broadcast/scoreboard. **System-ui / Inter** carries body and meta copy for quiet legibility at small sizes on a phone. There are no decorative or serif faces; the sportsbook posture wants neutral confidence, not flourish.

- **`{typography.wordmark}`** — `INCLUSIVCUP`, uppercase, weight 700, generous `0.12em` tracking. Set in `{colors.ink-primary}` with the `CUP` fragment in `{colors.accent-live}`. The wordmark is identical on every surface — phone app bar, admin sidebar, stream banner — and is never gold.
- **`{typography.display}`** — hero numbers, winner names, big stat values, scores. Weight 700, tight leading. Always rendered with tabular lining numerals.
- **`{typography.heading}`** — section and card titles, nav labels. Weight 600.
- **`{typography.body}`** — paragraph and in-card copy, 14px / line-height 1.5.
- **`{typography.meta}`** — 13px timestamps, captions, eyebrows; frequently uppercase and tracked when used as a label.

**Tabular lining numerals are mandatory for every numeric value** (`{typography.numeral}`): scores, seeds, K/D/A, ADR, HS%, round counts, award counters ("Premio 7 de 12"), grace timers, and demo hashes. Stats tick and recompute live; columns must not jitter. This is a hard rule, not a preference.

## Layout & Spacing

The spacing scale is `4 / 8 / 12 / 16 / 24 / 32` (`{spacing.1}`–`{spacing.6}`). Tight steps bind related elements (a stat label to its value); the larger steps separate sections (a feed card from the next, a ceremony stage from its prize chip). Vertical rhythm is the primary structuring device because both core surfaces scroll.

**Mobile-first (the phone is the spec).** The viewer experience — home/timeline feed, bracket, leaderboards, the ceremony — is designed at ~390px, single-column, newest-first where chronological. App bar holds the wordmark + live pill; a four-up nav tab row sits beneath it; content scrolls below. Side margins are `{spacing.4}` (16px) so cards feel framed, not edge-bled. The ceremony additionally renders a **wide shared-screen / stream banner** (a three-column recap-ready layout) so the table sees the same truth on a cast screen and on their phones (FR-30) — but the phone reveal is the source of truth and the banner mirrors it.

**Admin may assume a larger screen.** The admin console uses a two-pane app shell: a fixed ~212px left navigation rail plus a fluid main column (ingest queue, evidence view), capped around 1080px. It is the one surface allowed to be denser and wider — it is an operator tool, not a spectator one.

## Elevation & Depth

The system is **flat**. Depth is communicated by **tone and hairline**, almost never by shadow. Cards sit on `{colors.surface-1}`; emphasis lifts to `{colors.surface-2}`; separation is a 0.5–1px `{colors.border-hairline}`. This keeps the dark field calm and lets the only real "glow" in the product — the ceremony's gold — read as special rather than as one more drop-shadow.

Shadows are reserved for literal physical metaphor (the device frame in mocks, a single soft lift under a modal) and never used to manufacture hierarchy that tone and type can carry. Hierarchy comes from surface tone, type weight, and spacing — not elevation.

## Shapes

Corners are soft, not pill-happy: `{rounded.sm}` (6px) for inputs, badges, small surfaces and admin chrome; `{rounded.md}` (12px) for cards, the standard container; `{rounded.lg}` (16px) for large panels like the stream banner; `{rounded.pill}` (9999px) only for pills, dots, and tags. Surfaces are never fully rounded.

**The one true circle is the INCLUSIV360 wheel.** Perfect circles are otherwise avoided for surfaces, which is precisely what reserves the circle as an identity signal: the Awards Roulette *is* the brand's INCLUSIV360 motion graphic — a gold outer ring, a thin blue inner ring, geometric tick marks, and a `{colors.surface-1}` hub bearing the `3·6·0` glyph. Small echoes of the ring (the ceremony-banner eyebrow, the admin sidebar brand mark) quote it deliberately. Avatars and live-dots are the only other circles, and they are functional, not decorative. When you see a full circle in InclusivCup, it should mean "this is the ceremony."

## Components

Each component references frontmatter tokens; the resolver flattens at consumption. States are described where they carry meaning.

- **wordmark** — `INCLUSIVCUP` per `{typography.wordmark}`. `INCLUSIV` in `{colors.ink-primary}`, `CUP` in `{colors.accent-live}`. Invariant across surfaces; never gold, never restyled.
- **live-pill** — pill with a leading dot. *Live/Spinning:* `{colors.accent-live}` text/fill/border (the dot pulses when live). *Not live:* `{colors.ink-muted}` on transparent, static dot. *Final:* the sole permitted gold chrome — `{colors.reveal-gold}` fill+text, because the event has resolved into reveal.
- **stat-row** — label in `{colors.ink-muted}`, value in `{typography.display}` with tabular numerals on `{colors.surface-1}`, `{rounded.md}`. win/loss tint applies only when the value *is* a match outcome.
- **feed-card** — `{colors.surface-1}` (raised headline = `{colors.surface-2}`), `{colors.border-hairline}`, `{rounded.md}`. Anchored to a timeline rail whose node color encodes type: hairline (neutral), `{colors.accent-live}` (advance/live), `{colors.win}` (result/won), `{colors.reveal-gold}` (award-reveal entry only — a reveal artifact).
- **bracket-node** — `{colors.surface-1}`, `{colors.sm}` corners, hairline. Winner line in `{colors.ink-primary}`, loser in `{colors.ink-muted}`, score in `{typography.display}` with win/loss tint. The bracket is the seeded source of truth; matches are labeled by bracket position (Winners R1, Losers R1, …), never a running match number. Only the resolved **CHAMPION** node may take a `{colors.reveal-gold}` border.
- **advance-control** — admin-only "Avanzar" arrow + label in `{colors.accent-live}`. Server-gated; viewers never render this affordance (FR-34).
- **segmented-control** — Tasa / Volumen toggle for leaderboards. Track `{colors.surface-2}`, active cell lifts to `{colors.surface-1}` with `{colors.ink-primary}` text; inactive `{colors.ink-muted}`. Selection reads by tone + weight — no blue fill, no gold.
- **award-card** — *Locked:* monochrome, bucket label in `{colors.ink-muted}`, identity hidden. *Revealed:* name in `{colors.reveal-gold}`, hairline warms to `rgba(255,178,62,0.45)`. Carries the deciding stat and bucket (Habilidad / Clutch / Rarezas del demo / Comedia).
- **prize-chip** — Inclusiv token shirt. `{colors.surface-2}`, gold-tinted border, shirt glyph + "Prize" tag in `{colors.reveal-gold}` — legitimate gold because a prize is a reveal artifact.
- **roulette-wheel** — the INCLUSIV360 motif and only full-circle surface. Gold outer ring + gold pointer, thin blue inner ring, hairline ticks, `{colors.surface-1}` hub. *Pre-spin:* hub blurred-locked. *Spinning (Stage 1, luck picks category):* conic segment sweep, decelerating. *Resolved:* category card flips to gold.
- **reveal-flip** — the locked→revealed transition for the category/winner. Motion and the gold arrival carry the suspense; nothing elsewhere changes color.
- **verify-strip** — provenance chrome in **blue**, not gold: shield + "Sembrado por el demo final · reproducible", SHA-256 in `{colors.ink-muted}`, "Verificar la ceremonia" button in `{colors.accent-live}`. Persistent during the ceremony.
- **blurred-lock** — 7px blur + lock glyph over an award's identity until its spin ("Premio X de 12 — bloqueado hasta que gire"). No gold leak through the blur.
- **approve-button** — admin-only primary action; the system's single solid `{colors.accent-live}` fill, dark ink, `{rounded.sm}`. "Approve advances the bracket, posts the feed card, and recomputes leaderboards."
- **evidence-block** — read-only hash + re-parse + seed detail on `{colors.surface-1}`. Evidence-only: there is no in-app raise-dispute button (OQ-6); disputes are settled by inspecting this and re-parsing, raised out-of-app in Discord.
- **grace-timer** — no-show countdown MM:SS in tabular numerals, `{colors.ink-secondary}`, shifting to `{colors.loss}` as the forfeit threshold nears ("Ausente — W.O. en MM:SS").
- **bye-badge** — "Pase directo", neutral `{colors.ink-muted}` pill. Structural, not an outcome.
- **forfeit-badge** — "W.O. / Ausente" in `{colors.loss}`, carrying "sin estadisticas" (forfeits contribute no stats; leaderboards normalize per matches actually played — FR-17).
- **anomaly-flag** — parse anomaly needing review, `{colors.loss}` text on a faint loss-tint surface ("Vale: 0 stats — did not load? review").
- **nav-tab** — inactive `{colors.ink-muted}`, active `{colors.ink-primary}` with a `{colors.accent-live}` underline indicator. Locked tabs (Ceremony before the grand final) are dimmed with a lock glyph — never gold.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Reserve gold `{colors.reveal-gold}` strictly for reveals, winners, the INCLUSIV360 wheel, the champion, the ceremony-entry banner, the token-shirt prize, and award-reveal feed entries | Use gold on the wordmark, nav, bracket/match chrome, admin "pending", links, focus rings, or any decoration |
| Keep the CUP fragment of the wordmark in blue `{colors.accent-live}`, identical on every surface | Recolor or restyle the wordmark per screen — especially never gold |
| Render every stat, score, seed, counter, timer, and hash with tabular lining numerals | Let proportional numerals make live-updating columns jitter or reflow |
| Carry live / selected / verify / primary-action with blue `{colors.accent-live}` | Introduce a third chromatic accent or use blue for anything ceremonial |
| Separate with hairlines `{colors.border-hairline}` and lift with surface tone | Manufacture hierarchy with drop-shadows or elevation |
| Reserve win/loss `{colors.win}`/`{colors.loss}` for match semantics (scores, forfeits, anomalies, grace threshold) | Repurpose green/red as generic success/error decoration |
| Keep the full circle exclusive to the INCLUSIV360 wheel (plus functional avatars/dots) | Round surfaces into perfect circles or pills where a soft-corner card belongs |
| Drive ceremony drama with motion, sequencing, and the single gold reveal | Add gradients, glows, or extra color to "punch up" a reveal |
| Treat the phone reveal as source of truth and mirror it on the stream banner | Let the shared-screen banner diverge from what the table sees on their phones |
| Hide admin-only actions (approve, advance, re-parse, hashes) from viewers entirely | Show disabled mutating affordances to read-only viewers |
| Ship dark-first only for v1 and say so | Build or imply a light mode this version |
