// Command qa53 is the THROWAWAY live-QA harness for Story 5.3 (THE BAR), deleted after sign-off — the
// established pattern from Stories 5.1/5.2. It runs the REAL ingest.DemoinfocsParser over every .dem.gz in
// demos/, checks the FR-20 derived three against the invariants the story names, and makes a SECOND raw pass
// that re-derives the opening duel and reconciles it 1:1 against the aggregate.
//
// ⚠ WHAT THE SECOND PASS DOES AND DOES NOT PROVE (corrected at the Story 5.3 code review, 2026-07-21). It is
// a SEPARATE pass, not an INDEPENDENT derivation: it deliberately mirrors production's rule set (same live
// window, same three latch guards, same roundStarted guard, same trap-4 assign, same idx > final bound), so
// any error in the RULE ITSELF reconciles perfectly in both. What it genuinely proves is that the production
// handlers are WIRED UP AND NON-DEAD and that foldRounds neither loses nor duplicates a duel on the way to
// the per-player aggregate — which is the 5.2a failure mode and worth having. It does NOT independently
// confirm that the rule is the right rule. Do not cite it as if it did.
//
// It exists because the FR-20 logic that CANNOT be unit-tested is exactly the logic most likely to be dead:
// the events.RoundFreezetimeEnd handler body and the two call lines inside the events.Kill closure are
// unreachable by FakeParser. Story 5.2a shipped a column that was permanently 0 because a zero was ARGUED
// instead of MEASURED; this harness is written so both of this story's zeros are settled by a printed count.
//
//	🚨 GATE 1 — RoundFreezetimeEnd must actually FIRE. If the count is 0, entry_frags is permanently 0 for
//	   every player with no error anywhere. A zero here is a DEFECT and a STOP, never a finding to explain.
//	🚨 GATE 2 — the empty `clutches` must be proven POSITIVELY. The per-team living counts are printed at
//	   every freeze-time end: at T:1 CT:1 a ">=2 alive -> exactly 1 alive" transition is structurally
//	   impossible, which is what makes {} the correct result rather than a suspicious one. If any round shows
//	   a team of >=2 and clutches is still empty, that is a defect — investigate before sign-off.
//
// It also carries forward Story 5.2/5.2a's weird-five regression net (Task 10b), since qa52 and qaflash are
// deleted in this same commit: nothing measured is lost.
//
// Usage: go run ./cmd/qa53 [demos-dir]   (default ../demos)
package main

import (
	"compress/gzip"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	dem "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"

	"cs-tournament/worker/ingest"
)

func openGz(path string) (*gzip.Reader, *os.File, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	gz, err := gzip.NewReader(f)
	if err != nil {
		f.Close()
		return nil, nil, err
	}
	return gz, f, nil
}

func teamName(t int) string {
	switch common.Team(t) {
	case common.TeamTerrorists:
		return "T"
	case common.TeamCounterTerrorists:
		return "CT"
	default:
		return fmt.Sprintf("team%d", t)
	}
}

// maxTeamSize reads back the largest per-team living count from a printed GATE 2 shape ("T:1 CT:1 "). It is
// what lets GATE 2 FAIL rather than merely print: a shape whose largest team is >=2 makes a clutch transition
// structurally possible, so an empty Σclutches there is a defect and not a proof.
func maxTeamSize(shape string) int {
	max := 0
	for _, tok := range strings.Fields(shape) {
		i := strings.LastIndex(tok, ":")
		if i < 0 {
			continue
		}
		if n, err := strconv.Atoi(tok[i+1:]); err == nil && n > max {
			max = n
		}
	}
	return max
}

func main() {
	dir := "../demos"
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}
	paths, err := filepath.Glob(filepath.Join(dir, "*.dem.gz"))
	if err != nil || len(paths) == 0 {
		fmt.Printf("no .dem.gz found in %s (err=%v)\n", dir, err)
		os.Exit(1)
	}
	sort.Strings(paths)

	var failures []string
	weirdTotals := map[string]int{}
	var blindRoundIdx []int
	totalFreezeEnds := 0
	totalEntryFrags, totalOpeningDeaths, totalClutches := 0, 0, 0
	teamSizeSeen := map[string]int{} // "T:1 CT:1" -> how many rounds looked like that (GATE 2 evidence)

	for _, p := range paths {
		name := filepath.Base(p)
		fmt.Printf("\n=== %s\n", name)

		gz, f, err := openGz(p)
		if err != nil {
			failures = append(failures, fmt.Sprintf("%s: open/gunzip: %v", name, err))
			continue
		}
		res, err := ingest.DemoinfocsParser{}.Parse(gz)
		gz.Close()
		f.Close()
		if err != nil {
			failures = append(failures, fmt.Sprintf("%s: parse: %v", name, err))
			continue
		}

		sumK, sumD, sumRW, sumEF, sumOD := 0, 0, 0, 0, 0
		for _, pl := range res.Players {
			sumK += pl.Kills
			sumD += pl.Deaths
			sumRW += pl.RoundsWon
			sumEF += pl.EntryFrags
			sumOD += pl.OpeningDeaths
			fmt.Printf("  %d  K %3d  D %3d  RW %2d | entry %2d  opening %2d  clutches %v | knife %2d  wallbang %2d  smoke %2d  noscope %2d  blind %2d\n",
				pl.SteamID64, pl.Kills, pl.Deaths, pl.RoundsWon,
				pl.EntryFrags, pl.OpeningDeaths, pl.Clutches,
				pl.KnifeKills, pl.WallbangKills, pl.ThroughSmokeKills, pl.NoScopeKills, pl.BlindKills)

			// FR-20 per-player invariants.
			if pl.EntryFrags < 0 || pl.EntryFrags > pl.Kills {
				failures = append(failures, fmt.Sprintf("%s: %d: entry_frags %d out of range [0, kills %d]", name, pl.SteamID64, pl.EntryFrags, pl.Kills))
			}
			if pl.OpeningDeaths < 0 || pl.OpeningDeaths > pl.Deaths {
				failures = append(failures, fmt.Sprintf("%s: %d: opening_deaths %d out of range [0, deaths %d]", name, pl.SteamID64, pl.OpeningDeaths, pl.Deaths))
			}
			for x, n := range pl.Clutches {
				totalClutches += n
				if x < 1 {
					failures = append(failures, fmt.Sprintf("%s: %d: clutch key X=%d is < 1 (a 1v0 is not a clutch)", name, pl.SteamID64, x))
				}
				if n < 1 {
					failures = append(failures, fmt.Sprintf("%s: %d: clutch X=%d has non-positive count %d", name, pl.SteamID64, x, n))
				}
			}
			// The Story-5.2/5.2a weird-five regression net, carried forward from the deleted qa52.
			weird := func(label string, v int) {
				weirdTotals[label] += v
				if v < 0 || v > pl.Kills {
					failures = append(failures, fmt.Sprintf("%s: %d: %s (%d) out of range [0, kills %d]", name, pl.SteamID64, label, v, pl.Kills))
				}
			}
			weird("knife", pl.KnifeKills)
			weird("wallbang", pl.WallbangKills)
			weird("smoke", pl.ThroughSmokeKills)
			weird("noscope", pl.NoScopeKills)
			weird("blind", pl.BlindKills)
		}
		totalEntryFrags += sumEF
		totalOpeningDeaths += sumOD

		fmt.Printf("  rounds %d | Σkills %d  Σdeaths %d  ΣroundsWon %d | Σentry %d  Σopening %d\n",
			res.RoundsPlayed, sumK, sumD, sumRW, sumEF, sumOD)

		// FR-20 match-level conservation: every opening duel credits exactly ONE entry frag and ONE opening
		// death, and there is at most one duel per round.
		if sumEF != sumOD {
			failures = append(failures, fmt.Sprintf("%s: Σentry_frags %d != Σopening_deaths %d (a duel credited only one side)", name, sumEF, sumOD))
		}
		if sumEF > res.RoundsPlayed {
			failures = append(failures, fmt.Sprintf("%s: Σentry_frags %d EXCEEDS rounds %d (more than one duel per round)", name, sumEF, res.RoundsPlayed))
		}
		// The Story-5.1/5.2 regression net: this story must not perturb the fold.
		if sumK != sumD {
			failures = append(failures, fmt.Sprintf("%s: Σkills %d != Σdeaths %d (fold perturbed)", name, sumK, sumD))
		}
		if sumK != res.RoundsPlayed {
			failures = append(failures, fmt.Sprintf("%s: Σkills %d != rounds %d (fold perturbed)", name, sumK, res.RoundsPlayed))
		}
		if sumRW != res.RoundsPlayed {
			failures = append(failures, fmt.Sprintf("%s: ΣroundsWon %d != rounds %d (fold perturbed)", name, sumRW, res.RoundsPlayed))
		}

		// --- second pass: re-derive the opening duel INDEPENDENTLY (its own live window, its own latch) and
		// print GATE 1's freeze-time count + GATE 2's per-team living counts. This is the only coverage the
		// RoundFreezetimeEnd handler body and the two events.Kill call lines have — no Go test can drive them.
		gz2, f2, err := openGz(p)
		if err != nil {
			failures = append(failures, fmt.Sprintf("%s: reopen: %v", name, err))
			continue
		}
		p2 := dem.NewParser(gz2)
		freezeEnds := 0
		var live, latched bool
		var latchKillIdx int
		rawDuelByCommitIdx := map[int]int{} // commit index -> 1 if that round latched a duel
		rawDuelKillIdx := map[int]int{}     // KILL-TIME index -> how many first-live-kills were seen there
		roundStarted := false

		p2.RegisterEventHandler(func(e events.RoundStart) { roundStarted = true })
		p2.RegisterEventHandler(func(e events.RoundFreezetimeEnd) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			freezeEnds++
			live = true
			// 🚨 GATE 2 EVIDENCE: the living roster per team AT THE ARMING INSTANT. A ">=2 alive -> exactly 1
			// alive" transition is impossible for a team that is never at >=2, so these numbers are what makes
			// an empty `clutches` a structural fact rather than an argument.
			byTeam := map[int]int{}
			for _, pl := range p2.GameState().Participants().Playing() {
				if pl == nil || pl.SteamID64 == 0 {
					continue
				}
				byTeam[int(pl.Team)]++
			}
			teams := make([]int, 0, len(byTeam))
			for t := range byTeam {
				teams = append(teams, t)
			}
			sort.Ints(teams)
			line := ""
			for _, t := range teams {
				line += fmt.Sprintf("%s:%d ", teamName(t), byTeam[t])
			}
			if line == "" {
				line = "<nobody playing> "
			}
			fmt.Printf("    freeze-end @ round idx %-3d living %s\n", p2.GameState().TotalRoundsPlayed(), line)
			teamSizeSeen[line]++
		})
		p2.RegisterEventHandler(func(e events.Kill) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			var k, v uint64
			if e.Killer != nil {
				k = e.Killer.SteamID64
			}
			if e.Victim != nil {
				v = e.Victim.SteamID64
			}
			// Story 5.2/5.2a blind-kill regression: the round index of every genuinely-blind kill.
			if e.Killer != nil && e.Killer.IsBlinded() {
				blindRoundIdx = append(blindRoundIdx, p2.GameState().TotalRoundsPlayed())
			}
			if !live || latched || k == 0 || v == 0 || k == v {
				return
			}
			latched = true
			latchKillIdx = p2.GameState().TotalRoundsPlayed()
			rawDuelKillIdx[latchKillIdx]++
			fmt.Printf("    first live kill: round idx %-3d killer %d -> victim %d\n", latchKillIdx, k, v)
		})
		p2.RegisterEventHandler(func(e events.RoundEnd) {
			if p2.GameState().IsWarmupPeriod() || !roundStarted {
				return
			}
			roundStarted = false
			// Mirror the production commit: ASSIGN under the game's own index, so a MatchZy restart's replay
			// OVERWRITES the discarded pre-match round instead of adding to it (trap 4).
			idx := p2.GameState().TotalRoundsPlayed()
			if latched {
				rawDuelByCommitIdx[idx] = 1
			} else {
				delete(rawDuelByCommitIdx, idx)
			}
			live, latched = false, false
		})
		if err := p2.ParseToEnd(); err != nil {
			failures = append(failures, fmt.Sprintf("%s: raw pass: %v", name, err))
		}
		finalRounds := p2.GameState().TotalRoundsPlayed()
		rawDuels := 0
		for idx, n := range rawDuelByCommitIdx {
			if idx > finalRounds {
				continue // a stranded round from a rewind — the fold drops it, so does this count
			}
			rawDuels += n
		}
		p2.Close()
		gz2.Close()
		f2.Close()

		totalFreezeEnds += freezeEnds
		fmt.Printf("  GATE 1: RoundFreezetimeEnd fired %d times (rounds played %d)\n", freezeEnds, res.RoundsPlayed)
		if freezeEnds == 0 {
			failures = append(failures, fmt.Sprintf("%s: 🚨 GATE 1 FAILED: RoundFreezetimeEnd NEVER FIRED — entry_frags would be permanently 0 (the Story-5.2a failure mode)", name))
		}
		// Raw reconciliation: the independently re-derived duel count must match the aggregate EXACTLY.
		fmt.Printf("  raw reconciliation: independently derived duels %d vs Σentry_frags %d\n", rawDuels, sumEF)
		if rawDuels != sumEF {
			failures = append(failures, fmt.Sprintf("%s: raw duel count %d != Σentry_frags %d (the aggregate does not reconcile)", name, rawDuels, sumEF))
		}
		killIdxs := make([]int, 0, len(rawDuelKillIdx))
		for i := range rawDuelKillIdx {
			killIdxs = append(killIdxs, i)
		}
		sort.Ints(killIdxs)
		for _, i := range killIdxs {
			note := ""
			if i == 0 {
				note = "  <- includes the DISCARDED MatchZy pre-match round (trap-4): its duel is overwritten by the replay"
			}
			fmt.Printf("    first-live-kills seen at kill-time round index %d: %d%s\n", i, rawDuelKillIdx[i], note)
		}
	}

	fmt.Printf("\n=== TOTALS over %d demos\n", len(paths))
	fmt.Printf("  🚨 GATE 1 — RoundFreezetimeEnd events, all demos: %d\n", totalFreezeEnds)
	if totalFreezeEnds == 0 {
		failures = append(failures, "🚨 GATE 1 FAILED ACROSS ALL DEMOS: RoundFreezetimeEnd never fired — STOP, do not sign off")
	}
	fmt.Printf("  Σentry_frags %d · Σopening_deaths %d · Σclutches %d\n", totalEntryFrags, totalOpeningDeaths, totalClutches)
	if totalEntryFrags != totalOpeningDeaths {
		failures = append(failures, fmt.Sprintf("Σentry_frags %d != Σopening_deaths %d across all demos", totalEntryFrags, totalOpeningDeaths))
	}
	if totalEntryFrags == 0 {
		failures = append(failures, "🚨 entry_frags is ZERO across every demo — that is the Story-5.2a dead-column signature, NOT a finding to rationalize")
	}
	fmt.Println("  🚨 GATE 2 — per-team living counts observed at freeze-time end (a team never at >=2 can never transition to exactly 1):")
	shapes := make([]string, 0, len(teamSizeSeen))
	for s := range teamSizeSeen {
		shapes = append(shapes, s)
	}
	sort.Strings(shapes)
	sawMultiPlayerTeam := false
	for _, s := range shapes {
		note := ""
		if maxTeamSize(s) >= 2 {
			sawMultiPlayerTeam = true
			note = "   <- a team of >=2: a clutch transition IS structurally possible in these rounds"
		}
		fmt.Printf("    %-24s %d rounds%s\n", s, teamSizeSeen[s], note)
	}
	// GATE 2 MUST BE ABLE TO FAIL (code review, 2026-07-21). Printing the shapes is the evidence; this is the
	// gate. Σclutches == 0 is the CORRECT result only while no team was ever at >=2 alive — on a corpus that
	// contains a multi-player team it is the same silent-empty-column signature Story 5.2a shipped. Without
	// this branch the harness printed "ALL INVARIANTS HELD" for exactly that case, which is the prose-instead-
	// of-measurement habit GATE 2 exists to prevent.
	if sawMultiPlayerTeam && totalClutches == 0 {
		failures = append(failures, "🚨 GATE 2 FAILED: a team of >=2 alive was observed at freeze-time end, so a '>=2 -> exactly 1' transition was POSSIBLE, yet Σclutches is 0 — investigate before sign-off, do not rationalize")
	}
	fmt.Println("  weird-five regression (Story 5.2/5.2a — expected knife 1 · wallbang 8 · smoke 2 · noscope 0 · blind 4):")
	for _, k := range []string{"knife", "wallbang", "smoke", "noscope", "blind"} {
		fmt.Printf("    %-9s %d\n", k, weirdTotals[k])
	}
	expectWeird := map[string]int{"knife": 1, "wallbang": 8, "smoke": 2, "noscope": 0, "blind": 4}
	for k, want := range expectWeird {
		if weirdTotals[k] != want {
			failures = append(failures, fmt.Sprintf("weird-five regression: %s = %d, want %d (this story perturbed the fold)", k, weirdTotals[k], want))
		}
	}
	sort.Ints(blindRoundIdx)
	fmt.Printf("    blind kills at round indices %v (expected [3 5 9 13])\n", blindRoundIdx)
	if fmt.Sprint(blindRoundIdx) != fmt.Sprint([]int{3, 5, 9, 13}) {
		failures = append(failures, fmt.Sprintf("blind-kill round indices %v != [3 5 9 13] (Story 5.2a regression)", blindRoundIdx))
	}

	if len(failures) > 0 {
		fmt.Printf("\n!!! %d INVARIANT FAILURES\n", len(failures))
		for _, f := range failures {
			fmt.Printf("  - %s\n", f)
		}
		os.Exit(1)
	}
	fmt.Println("\nALL INVARIANTS HELD")
}
