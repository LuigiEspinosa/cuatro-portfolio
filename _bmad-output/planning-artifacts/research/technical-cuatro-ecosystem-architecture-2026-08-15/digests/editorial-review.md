# Editorial review: structure and prose

Target: `research.md` (1,615 lines). Reviewed against its contract: succinct, decision-grade,
findings-and-verdicts, readable in minutes, and consumable by an architecture spine, a product
brief and a roadmap.

15 findings, ranked within each lens by impact on the reader's ability to decide.

---

## Structure findings

### 1. The headline estate number does not add up, and it contradicts itself in three places: IMPACT: high

Executive summary: "Archive three empty shells and absorb one toy: **15 repos → 11.**"
Recommendations: "**Net effect: 15 repos → 11** (3 archived, 3 merged, 1 absorbed, +1 anchor
retained)."
Step 0: "→ *Estate 15→12, and for the first time you have an error signal.*"
Contrary evidence: "The Anchored Hub takes the estate 15 → 12" … "**Twelve repos still each
show their own staleness**".

Three different conventions are in play. Counting the per-project calls: 3 archived + 3 merged
+ 1 absorbed = 7 repos leave; 7 satellites + the anchor = **8 remaining**. `15 − 3 − 1 = 11`
only works if archived repos still count as repos, but Step 0 subtracts exactly those three
archives to reach 12. The parenthetical "(3 archived, 3 merged, 1 absorbed, +1 anchor
retained)" produces 8 under its own arithmetic, not 11.

This is the number the product brief is told to consume ("**Product brief** | The 15→11 estate
decision"), and it appears in the frontmatter `recommendation` field.

**Fix:** pick one convention and state it once, e.g. "15 repos → **8 active**, plus 3 archived
but still visible on the profile." Then propagate to: frontmatter, exec summary, Step 0, the
Contrary-evidence staleness argument (which needs "eight repos still each show their own
staleness"), and the Downstream bindings table.

### 2. Sub-question 4 (dev environment) never gets a verdict in Recommendations: IMPACT: high

D4 spends a full subsection ("Are devcontainers worth adopting on their own merits?")
reaching "Qualified, and less urgent than the framing implies," then documents maturity
(pre-1.0), editor portability and alternatives. Nothing in **Recommendations** ever renders a
call. The deployment table, the identity section and the design-system section each close their
dimension; D4's devcontainer question closes nowhere. Step 8 covers relocation only.

A reader who skips to Recommendations (the intended behaviour for a decision-grade report)
leaves without an answer to one of the seven sub-questions.

**Fix:** add a three-line "Dev environment" block to Recommendations before the migration path:
the call (not now), the reason (pre-1.0 CLI, no published 6–12-month cost, and the WSL2 move
captures most of the win), and the trigger that would change it (a second machine, or a
toolchain conflict on the host).

### 3. There is no map from the seven sub-questions to their answers: IMPACT: high

The "Report contents" nav lists sections by dimension label only. Sub-questions 5 (project
consolidation) and 6 (migration sequencing) have **no dimension at all**: each dimension's
status line claims 1, 2, 3, 4, 7 and "a requirement not present in the original prompt", and
5–6 live only inside Recommendations. Nothing tells the reader that.

**Fix:** replace or supplement the contents line with a seven-row pointer list:
"1 source layout → D1 + Recommendations §matrix · 2 design system → D2 · 3 deployment → D3 ·
4 dev environment → D4 + Recommendations · 5 project consolidation → Recommendations
§Per-project calls · 6 sequencing → Recommendations §The sequenced migration path · 7
relocation → D4 §Windows placement + Step 8." Costs four lines, removes the report's single
biggest navigation failure.

### 4. Reading order: move D4 last, keep the numbers, IMPACT: medium-high

Current order D1, D4, D2, D3, D5. The exec summary's three driving findings come from D2, D3
and D5: the three sections a reader hits *last*. D4, whose only load-bearing output is "move
the repos to WSL2 ext4" (Step 8, explicitly "independent of everything above"), sits second,
between the source-layout decision and the two dimensions that actually decide the
architecture.

**Fix:** move the whole D4 block to after D5. Do **not** renumber, "D1…D5" are stable
identifiers referenced by Cross-dimension insights ("(D2)", "(D5)", "see #2") and by the
staleness map, and renumbering buys nothing. New order: D1, D2, D3, D5, D4. One block move plus
the contents line. Low churn, real gain.

### 5. Cross-dimension #6 is a verbatim restatement of Executive summary finding 3: IMPACT: medium-high

Exec: "for a hiring-manager audience, six frameworks under one coherent visual identity is
arguably a stronger artifact than one framework repeated fifteen times, and you have said you
value the variety."
Cross-dim #6: "for a hiring-manager audience, six frameworks under one coherent visual identity
is arguably a *stronger* artifact than one framework repeated fifteen times."

Same sentence. The same section also repeats the "reads as one author, not feels like one
product" formulation already given in the exec. Its only non-duplicated content is the sentence
"The research never says this outright, and it should", which is a note left over from the
red-team pass and is now false, since the exec says it outright.

**Fix:** delete Cross-dimension #6 entirely. The insight is already owned by the exec summary
and by D2's "Where the ceiling actually is." Cross-dimension is for what only the *combination*
shows; this is single-dimension content.

### 6. Contrary evidence re-states the capacity arithmetic almost word for word: IMPACT: medium

Exec: "2 vCPU is a 200% budget; four Next.js apps at the one measured figure would demand 412%
before the BEAM node, Postgres or Traefik. The two-source bar was met **zero times** for every
other footprint: meaning unknown numbers, not small ones."
Contrary evidence: "2 vCPU is a **200% budget**. The sole measured datapoint is one Next.js at
**103.3%**. Four Next.js apps demand 412% before the BEAM node, Postgres or Traefik. The
two-source bar was met **zero times** for every other footprint: meaning *unknown* numbers were
being treated as *small* ones."

The same arithmetic also opens D3 and reappears in Open questions and the Staleness map, five
appearances. Exec + D3 are licensed; the Contrary-evidence copy adds nothing except its final
clause.

**Fix:** cut the Contrary-evidence paragraph down to what is genuinely adversarial: "The
original plan treated unknown footprints as small ones (arithmetic in D3). The revised plan adds
a measure-first gate and a named overflow target; it does not make the arithmetic close." Same
treatment applies to Cross-dimension #2, which restates exec finding 2 and keeps only one new
sentence ("Had identity been researched in isolation, Keycloak would have been the obvious
answer and would have been wrong"): reduce #2 to that sentence plus its pointer.

### 7. "The app registry" is load-bearing and never defined: IMPACT: medium

It appears as a published contract in the exec ("publishes tokens, reusable workflows and the
app registry"), as a counter-argument premise in Contrary evidence ("An app registry on
`cuatro.dev` **never touches** `github.com/<your-profile>`"), as the unification mechanism for
the tracker family ("a shared 'Trackers' section in the app registry"), and as a standing rule
("**The app registry ships only after the bot filter**"). No dimension covers it; no sentence
says what it is, what format it takes, or who consumes it.

The Downstream bindings table hands the architecture spine a contract set that includes it.
**Fix:** one paragraph in Recommendations §Design system or a new §The app registry, what it
is (a JSON/MD manifest of the estate published by the anchor), what it renders (the portfolio
index), and that it is the third contract alongside tokens and workflows. Two sentences would
close it.

### 8. Proportion: three subsections outrun their decision value, IMPACT: medium

- **D3 §"The outgrow threshold"** (PSI, `avg10`/`avg60`/`avg300`, per-container `cpu.pressure`)
  is orphaned: nothing in Recommendations, the migration path, or the risk bindings consumes
  it. The Monitoring row says only "external uptime + certificate-age check."
  **Fix:** compress to two sentences inside the Step 1 gate ("measure per-container pressure via
  cgroup v2 `cpu.pressure`; the kernel publishes no universal threshold"), or promote PSI into
  the Step 1 gate criteria and keep it.
- **D3 §"Backups"** prices four tools with versions (restic, Borg, pgBackRest, Barman) where the
  recommendation uses exactly one plus `pg_dump`. **Fix:** keep restic and the `wal-g` warning;
  reduce the other three to a one-line "also live" note.
- **D2's Nord paragraph** ("The nearest thing to a counter-example is Nordhealth's Nord…")
  spends six lines to conclude "It does not disturb the verdict." **Fix:** two lines, name it,
  mark it low-confidence vendor marketing, move on.

Conversely, **Recommendations §Design system is too thin**: three lines that point back to D2.
It is one of the three headline decisions and it is the only one a Recommendations-only reader
cannot act on. **Fix:** reproduce the two-artefact table (`tokens.css` / `tailwind.css`) there.

### 9. Two tables are doing work prose does better; one table is unreadable: IMPACT: low

- **D1's "Survives at N=1" table** has three rows and one citation column, and its third row
  ("Project liveness and audience navigation signal") immediately gets the full paragraph it
  needed anyway. **Fix:** make it three sentences.
- **D5's self-hosted field table** crams a paragraph into the Keycloak cell ("~1250 MB base RAM
  (10k cached sessions), 70% of container limit to JVM heap + ~300 MB non-heap, 1 vCPU per 15
  password logins/sec, 150% headroom; worked example requests 3 vCPU per pod [73]") plus a
  parenthetical confidence note in the verdict column. **Fix:** keep the table to
  Product / Vendor-stated floor / Verdict, and move the sizing detail and confidence caveats to
  footnotes beneath it.
- Everything else earns its space. The D4 "What actually breaks when you move a git repo" table
  is the best artifact in the report: it is a runbook checklist, including the four honest
  **UNEVIDENCED** rows. Keep exactly as is.

---

## Prose findings

### 1. D3 still headlines a claim that Contrary evidence explicitly demotes: IMPACT: high

D3: "> **The most actionable finding of this entire run:** the trigger for that CPU spike was
**bot crawlers, not human users** … **The cheapest capacity fix available to you is a bot
filter, not tuning and not a bigger box.**"

Contrary evidence: "The bot-filter claim is retained because it is cheap, reversible and
low-risk, but it is hereby **demoted from 'the cheapest capacity fix' to 'a cheap experiment
worth running first'**, which is what its evidence actually supports."

The correction was appended at the end of the report and never propagated back into D3. A reader
who reads linearly takes the superlative as the report's position for 500 lines before learning
it was withdrawn. The exec summary's "turn on Cloudflare bot rules" in Step 0 inherits the
un-demoted framing too.

**Fix:** rewrite the D3 blockquote to carry its own demotion: "**A cheap experiment worth running
first:** the trigger for that CPU spike was bot crawlers, not human users, and Cloudflare
filtering cut it by over 90% [51]: *single contested thread; treat as a hypothesis to test in
Step 1, not as a measured capacity fix.*" Then delete the now-redundant demotion sentence from
Contrary evidence, or reduce it to one clause.

### 2. An unsourced quantifier is stated as fact inside the section that marks the same ground as inference: IMPACT: high

D2: "Color, type, spacing, radii, elevation and motion carry the overwhelming majority of
perceived brand coherence: that is precisely the payload Primer distributes to three unrelated
implementations [33]."

Two problems. "Overwhelming majority of perceived brand coherence" is a quantified claim with no
agent, no measurement and no source: the Primer citation supports *what Primer distributes*,
not *how much coherence it buys*. And D2's own gap list says "**No first-hand retrospective on
where token-only coherence breaks** was found." The report's most quotable justification for the
tokens-only verdict is its least evidenced sentence.

**Fix:** "Color, type, spacing, radii, elevation and motion are the layers a visitor actually
perceives, and they are precisely the payload Primer distributes to three unrelated
implementations [33]. *How much coherence that buys is not quantified anywhere in public; this
is inference from what these systems chose to ship.*"

### 3. "Hub" and "anchor" name the same thing, and "Anchored Hub" is never introduced: IMPACT: medium

The recommendation is called **Anchored Hub** in the frontmatter, in the decision matrix
("**5. Anchored Hub** ⭐") and in Contrary evidence ("The Anchored Hub takes the estate…"). The
executive summary (where a reader meets the recommendation) never uses the name. The reader
first encounters "Anchored Hub" ~1,290 lines in, undefined.

Then the same object is called two things: D2 says "**Hub** publishes `@scope/tokens`", Step 2
says "no **hub** machinery", Step 7 says "the **hub**", while Recommendations says "Merge into
the **anchor** (`cuatro-portfolio`)" and Step 3 is "**the anchor merge**". Worse, "hub" is also
the name of the *rejected* Option 3 ("Hub + satellites (new repo)") and of D1's general pattern
discussion ("The hub-and-satellite pattern").

**Fix:** (a) name it in the exec's one-sentence recommendation: "make `cuatro-portfolio` the
**Anchored Hub**: a Turborepo monorepo holding…". (b) Pick one word for the repo. Recommended:
"the anchor" for the repo, "hub duties" only when describing the role, and keep "Hub +
satellites" strictly for rejected Option 3. "Satellites" is used consistently throughout: no
change needed there. "Contracts", "token layer" and "the box" are also used consistently and
well; "the box" in particular is doing real work ("half the box", "the box chose the identity
provider", "the box never compiles").

### 4. The report keeps narrating its own production: IMPACT: medium

A recurring register slip into process voice, in a document whose contract is findings and
verdicts:

- Header note: "_Sections are appended per the approved research plan; the executive summary is
  written last and placed here, first._": tells the reader nothing decision-relevant. **Cut.**
- D3: "Two separate researchers independently found that every circulating proxy RAM figure
  (85/120/180 MB) traces to AI-generated SEO content farms recycling each other, and both
  correctly declined to report a number." → "Every circulating proxy RAM figure (85/120/180 MB)
  traces back to AI-generated SEO content farms recycling each other. No number is given here."
- D5: "A previous researcher **refused** to report Clerk/Kinde/Stytch/Supabase numbers found only
  in listicles and content farms; these replace those refusals with vendor-source reads." → keep
  only the preceding sentence ("Every figure above was read from the vendor's own pricing page on
  2026-08-15").
- D3: "**Restore-testing guidance was searched for and not found**: the researcher declined to
  invent it. Stated as a gap.": the same fact three times in two sentences. → "Restore-testing
  guidance: searched for, not found."
- D1: "Repeating the stale complaint would have been a false claim, so it was checked." → cut;
  the following sentence already gives the checked result.
- Dimension status lines ("closed on coverage after 3 rounds", "added mid-run at the requester's
  instruction… plus a ForwardAuth pass"): keep the "Serves sub-question N" half, move the round
  counts to frontmatter.

### 5. Hedging applied mechanically to things that are settled: IMPACT: medium

- D2: "**Form participation, FIXED.** Form-associated custom elements are Baseline **widely
  available since 2025-09-27** (Chrome 77, Edge 79, Firefox 98, Safari 16.4). … *(Single-source;
  below this run's two-source bar.)*" Baseline status with four named browser versions is about
  as settled as a web-platform fact gets; flagging it as sub-bar reads as rule-following rather
  than judgement, and it undercuts a "FIXED" the report wants believed. **Fix:** drop the
  parenthetical, or replace with "(Baseline data; corroborated by the version list itself.)"
- The Traefik confidence caveat is stated twice, and both times hedges the wrong thing: D3
  "*(Medium-high confidence: Cloudflare is not named inline on the page read.)*" and the
  Recommendations table "Medium-high (Cloudflare not named inline in the Traefik page read)".
  But the *deciding* fact is Caddy's side: "Caddy's own module page states it 'does not come
  with Caddy'", which is primary and firm. **Fix:** state confidence once, and scope it:
  "High: the deciding fact (xcaddy rebuild per upgrade) is primary; only the Traefik-side
  Cloudflare naming is inferred."

By contrast, the hedging in D4's relocation table, D3's "Honesty about the rest of the numbers",
and D1's "only one search was run for it, so treat that asymmetry as suggestive rather than
settled" is exactly right. Do not touch those.

### 6. Recommendations states as flat cost something the report calls unevidenced: IMPACT: medium

Recommendations, on the runner-up: "Its cost is that four unrelated toolchains share a tree with
no orchestrator able to help."

Contrary evidence: "Absence of a bonus is not presence of a cost, and D1 found **no measured CI
fan-out numbers exist**, so the one real monorepo cost is unevidenced." The runner-up sentence
commits precisely the error the red team caught and the report says it corrected.

**Fix:** "Its cost is that four unrelated toolchains share a tree with no orchestrator able to
help: an unmeasured cost, since no CI fan-out numbers for a polyglot monorepo exist in any
source retrieved (D1)."

### 7. Three sentences a reader has to re-read: IMPACT: low-medium

- D3: "**The PaaS decision comes first and makes the proxy decision downstream**, because all
  four own their own front door [69]." → "**Choose the PaaS first: it decides the proxy for
  you**, because all four ship their own front door [69]."
- Cross-dimension opener: "What only the *combination* of dimensions shows. Four of these changed
  the recommendation." Which four? Unattributed and uncheckable. → mark the four with a symbol,
  or cut the clause.
- D4: "The framing is wrong, and the evidence is structural rather than rhetorical." The
  structural/rhetorical distinction has no referent in what follows. → "The framing is wrong, and
  the reason is mechanical: the two decisions answer different questions."

Minor drift also worth one pass: the exec lists the contract set as "design tokens, reusable
workflows, the app registry" while Cross-dimension #1's table lists "UI components / design
tokens / identity / CI definitions": identity is a contract in one list and absent from the
other; the app registry is in one and absent from the other. Make the two lists identical.

---

## Sub-question coverage check

| Sub-question | Answered? | Where | Easy to find? |
|---|---|---|---|
| 1. Source layout | Yes | D1 (analysis) + Recommendations §The scored decision matrix (verdict) | Yes: named in contents nav |
| 2. Design system | Yes | D2 (full, best-evidenced section) + Recommendations §Design system (3-line pointer) | Yes to the analysis; the Recommendations answer is too thin to act on alone |
| 3. Deployment | Yes | D3 + Recommendations §Deployment topology table | Yes: the table is excellent |
| 4. Dev environment | **Partial** | D4 §"Are devcontainers worth adopting on their own merits?": verdict "qualified, less urgent". **No call in Recommendations.** | **No**: a Recommendations-only reader gets nothing |
| 5. Project consolidation | Yes | Recommendations §Per-project calls (three tables) + the tracker-family paragraph | **No**: no dimension owns it, it is absent from the contents nav, and the net-effect number is wrong (Structure #1) |
| 6. Migration sequencing | Yes | Recommendations §The sequenced migration path, Steps 0–8 | Partly: only reachable by scrolling to Recommendations; not in the contents nav |
| 7. Repo relocation | Yes | D4 §"The finding that outranks the devcontainer question entirely" + §"What actually breaks" table + Step 8 | Yes, and the reframing (`C:\` → WSL2 ext4, not `C:\` → another Windows folder) is the report's cleanest single move |

**Verdict:** 5 of 7 fully answered and findable. Sub-question 4 is analysed but never decided.
Sub-question 5 is decided but unnavigable and carries an arithmetic contradiction. Both are
cheap to fix: one three-line block, one number, one nav list.

---

## Cut candidates

Delete with no loss:

1. The header italic note: "_Sections are appended per the approved research plan; the executive
   summary is written last and placed here, first._"
2. **Cross-dimension insight #6** in full (duplicates exec finding 3 verbatim; see Structure #5).
3. Cross-dimension #6's "The research never says this outright, and it should.": a red-team
   note-to-self, and no longer true.
4. Contrary evidence, first paragraph of "Against the deployment topology": the 200%/412%
   arithmetic restated from the exec and D3. Keep only the final sentence.
5. D5: "A previous researcher **refused** to report Clerk/Kinde/Stytch/Supabase numbers found only
   in listicles and content farms; these replace those refusals with vendor-source reads."
6. D3: "the researcher declined to invent it. Stated as a gap." (two redundant restatements of the
   preceding clause).
7. D1's second "Costs that do not apply here" paragraph (`scalar`, partial/shallow clone),
   concludes "argues neither way" after six lines. One sentence suffices: "Modern git scale
   tooling is a non-factor at this size; GitHub advises full clones for reasonably-sized repos
   [14][15]."
8. D1: "Repeating the stale complaint would have been a false claim, so it was checked."
9. D3 §"The outgrow threshold": the PSI trigger-format detail (`avg10`/`avg60`/`avg300`, the
   150 ms/1 s and 50 ms/1 s worked examples). Keep only the per-container cgroup v2 point, folded
   into Step 1.
10. D3 §Backups: the Borg / pgBackRest / Barman version roster. Nothing downstream uses them.

Compress rather than cut: D2's Nord counter-example paragraph (6 lines → 2), D5's self-hosted
field table cells (paragraph-in-cell → footnotes).

---

## What is working well

- **D2 is the best section in the report** and the red team's own assessment agrees. The
  behavioural-convergence argument (Google defunded, GitHub retired, Adobe double-pays, IBM
  community-ports the tail) is a genuinely strong evidentiary shape, and the "tokens federate
  *values*, nothing federates *behaviour*" formulation is the sentence the whole design decision
  turns on. The confidence caveat splitting the holds/drifts table into "well-evidenced left
  column, inference right column" is model epistemic hygiene.
- **The D4 relocation table** is the single most usable artifact here: a runbook with four
  honest **UNEVIDENCED** rows rather than four plausible-sounding inventions.
- **The scored decision matrix arithmetic is correct** (355 / 310 / 345 / 360 / 410, all five
  verified), the weights trace to the requester's ranking, and "Re-weight the columns and the
  answer may change: that is the point of showing the working" plus a named runner-up condition
  is exactly what a decision-grade matrix should carry.
- **The sequenced migration path** is well-shaped: every step leaves a working system, Step 2 is
  deliberately the smallest visible win, and Step 7 is trigger-gated ("only after you have
  hand-copied a token change three times") rather than scheduled. That instinct: refuse to build
  machinery before the frequency justifies it: is the report's best judgement call.
- **The refusals hold up.** Declining to quote the "10–20× slower" WSL figure, the proxy RAM
  numbers, and the "100-second Cloudflare timeout" is the right call each time, and each refusal
  says what would close the gap.
- **"The box" as a recurring concrete noun** does more work than any diagram would: "half the
  box", "the whole box", "the box chose the identity provider", "the box never compiles".
