// Command qa54 is the THROWAWAY live-QA harness for Story 5.4 (THE BAR), deleted after sign-off — the
// established per-story pattern (5.1/5.2/5.3). It runs the REAL ingest.DemoinfocsParser over every .dem.gz in
// demos/ and settles the FR-21 AFK/idle derivation POSITIVELY, then carries the 5.1/5.2/5.2a/5.3 regression net
// forward and deletes cmd/qa53 in the same commit (Task 10b).
//
// ⚠ THE STORY'S HEADLINE TRAP (trap 2): Player.Position() is 5.4's AttackerBlind. If it is degenerate on our
// PBDEMS2/Source-2 demos (all-zero / all-equal / silently degrading), EVERY displacement reads < epsilon, EVERY
// round flags idle, EVERY player is idle_dq, and Story 5.5's view excludes the ENTIRE tournament from EVERY
// award — silently. So a zero here must be MEASURED, never argued.
//
//	🚨 GATE A — PROVE events.FrameDone FIRES AND Position() IS ALIVE. Counts FrameDone per demo (0 ⇒ STOP) and
//	   prints the per-round displacement distribution (min/median/max). The expected finding is displacements of
//	   HUNDREDS to THOUSANDS of game units. Every displacement ≈ 0 is a DEFECT and a STOP, not a finding.
//	🚨 GATE B — PROVE THE ALL-false idle_dq POSITIVELY (the 5.3 GATE-2 discipline). Prints, per player per demo:
//	   idle_round_count, idle_dq, the count of rounds they acted, and their median round displacement. The
//	   expected finding is idle_dq=false for EVERY player with idle_round_count ≈ 0, backed by "acted ~every
//	   round" and "moved hundreds+ of units every round". Any idle_dq=true ⇒ do not sign off, investigate.
//
// It also independently RE-DERIVES the idle facts in a second raw pass (its own FrameDone sampler, its own
// action flags, its own isIdleRound mirror) and reconciles 1:1 against the production aggregate — the only
// coverage the FrameDone/action closures and the Position() deref have, none reachable by FakeParser. Like
// qa53's second pass this MIRRORS production's rule set (same epsilon, same trap-4 assign, same idx>final
// bound), so it proves the handlers are WIRED UP AND NON-DEAD, not that the rule is the right rule.
//
// Usage: go run ./cmd/qa54 [demos-dir]   (default ../demos)
package main

import (
	"compress/gzip"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/golang/geo/r3"
	dem "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"

	"cs-tournament/worker/ingest"
)

// rawEpsilon MIRRORS ingest.afkPositionEpsilon (unexported). If the production constant is tuned, tune this too
// — a throwaway harness cannot import the unexported const, the same mirror qa53 kept for its rule set.
const rawEpsilon = 64.0

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

func median(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	s := append([]float64(nil), xs...)
	sort.Float64s(s)
	return s[len(s)/2]
}

// rawRound is the second-pass per-round FR-21 scratch, mirroring roundStats' FR-21 fields + the trap-4 commit.
type rawRound struct {
	sampled map[uint64]bool
	anchor  map[uint64]r3.Vector
	maxDisp map[uint64]float64
	acted   map[uint64]bool
	present map[uint64]bool
	idle    map[uint64]bool
}

func newRawRound() *rawRound {
	return &rawRound{
		sampled: map[uint64]bool{}, anchor: map[uint64]r3.Vector{}, maxDisp: map[uint64]float64{},
		acted: map[uint64]bool{}, present: map[uint64]bool{}, idle: map[uint64]bool{},
	}
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
	totalFrameDone := 0
	totalIdleRounds := 0
	totalEntryFrags, totalOpeningDeaths, totalClutches := 0, 0, 0
	var allDisp []float64            // every surviving per-player round displacement (GATE A distribution)
	teamSizeSeen := map[string]int{} // "T:1 CT:1" -> round count (5.3 GATE-2 regression, carried forward)

	for _, p := range paths {
		name := filepath.Base(p)
		fmt.Printf("\n=== %s\n", name)

		gz, f, err := openGz(p)
		if err != nil {
			failures = append(failures, fmt.Sprintf("%s: open/gunzip: %v", name, err))
			continue
		}
		t0 := time.Now()
		res, err := ingest.DemoinfocsParser{}.Parse(gz)
		parseDur := time.Since(t0)
		gz.Close()
		f.Close()
		if err != nil {
			failures = append(failures, fmt.Sprintf("%s: parse: %v", name, err))
			continue
		}

		// Production aggregate: the regression sums + the FR-21 facts under test.
		sumK, sumD, sumRW, sumEF, sumOD := 0, 0, 0, 0, 0
		prodIdleDQ := map[uint64]bool{}
		prodIdleCount := map[uint64]int{}
		for _, pl := range res.Players {
			sumK += pl.Kills
			sumD += pl.Deaths
			sumRW += pl.RoundsWon
			sumEF += pl.EntryFrags
			sumOD += pl.OpeningDeaths
			prodIdleDQ[pl.SteamID64] = pl.IdleDQ
			prodIdleCount[pl.SteamID64] = pl.IdleRoundCount
			for _, n := range pl.Clutches {
				totalClutches += n
			}
			weirdTotals["knife"] += pl.KnifeKills
			weirdTotals["wallbang"] += pl.WallbangKills
			weirdTotals["smoke"] += pl.ThroughSmokeKills
			weirdTotals["noscope"] += pl.NoScopeKills
			weirdTotals["blind"] += pl.BlindKills
			// 🚨 GATE B (production side): the derived idle facts, proven POSITIVELY below against measured
			// movement + action from the raw pass.
			if pl.IdleDQ {
				failures = append(failures, fmt.Sprintf("%s: 🚨 GATE B: player %d is idle_dq=TRUE (idle %d rounds) — a real tournament has nobody AFK; investigate (real AFK or a dead Position() signal)", name, pl.SteamID64, pl.IdleRoundCount))
			}
			totalIdleRounds += pl.IdleRoundCount
		}
		totalEntryFrags += sumEF
		totalOpeningDeaths += sumOD

		// --- second raw pass: independently re-derive the FR-21 facts + collect GATE A evidence.
		gz2, f2, err := openGz(p)
		if err != nil {
			failures = append(failures, fmt.Sprintf("%s: reopen: %v", name, err))
			continue
		}
		p2 := dem.NewParser(gz2)
		frameDone := 0
		cur := newRawRound()
		byRound := map[int]*rawRound{}
		roundStarted := false
		idOf := func(pl *common.Player) uint64 {
			if pl == nil {
				return 0
			}
			return pl.SteamID64
		}

		p2.RegisterEventHandler(func(e events.RoundStart) { roundStarted = true })
		p2.RegisterEventHandler(func(e events.FrameDone) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			frameDone++
			for _, pl := range p2.GameState().Participants().Playing() {
				if pl == nil || pl.SteamID64 == 0 {
					continue
				}
				sid := pl.SteamID64
				pos := pl.Position()
				if !cur.sampled[sid] {
					cur.sampled[sid], cur.anchor[sid] = true, pos
					continue
				}
				if d := pos.Sub(cur.anchor[sid]).Norm(); d > cur.maxDisp[sid] {
					cur.maxDisp[sid] = d
				}
			}
		})
		p2.RegisterEventHandler(func(e events.RoundFreezetimeEnd) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			// Mirror armLiveWindow's FR-21 reset: pre-freeze samples are discarded so the window is freeze->end.
			cur = newRawRound()
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
			teamSizeSeen[line]++
		})
		p2.RegisterEventHandler(func(e events.WeaponFire) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			if s := idOf(e.Shooter); s != 0 {
				cur.acted[s] = true
			}
		})
		p2.RegisterEventHandler(func(e events.GrenadeProjectileThrow) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			if e.Projectile != nil {
				if s := idOf(e.Projectile.Thrower); s != 0 {
					cur.acted[s] = true
				}
			}
		})
		p2.RegisterEventHandler(func(e events.PlayerHurt) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			if a := idOf(e.Attacker); a != 0 {
				cur.acted[a] = true
			}
		})
		p2.RegisterEventHandler(func(e events.Kill) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			// Story 5.2/5.2a blind-kill regression: the round index of every genuinely-blind kill.
			if e.Killer != nil && e.Killer.IsBlinded() {
				blindRoundIdx = append(blindRoundIdx, p2.GameState().TotalRoundsPlayed())
			}
		})
		p2.RegisterEventHandler(func(e events.RoundEnd) {
			if p2.GameState().IsWarmupPeriod() || !roundStarted {
				return
			}
			roundStarted = false
			for _, pl := range p2.GameState().Participants().Playing() {
				if pl == nil || pl.SteamID64 == 0 {
					continue
				}
				sid := pl.SteamID64
				cur.present[sid] = true
				if cur.sampled[sid] && !cur.acted[sid] && cur.maxDisp[sid] < rawEpsilon {
					cur.idle[sid] = true
				}
			}
			byRound[p2.GameState().TotalRoundsPlayed()] = cur // ASSIGN (trap-4): a replay overwrites the discard
			cur = newRawRound()
		})
		if err := p2.ParseToEnd(); err != nil {
			failures = append(failures, fmt.Sprintf("%s: raw pass: %v", name, err))
		}
		finalRounds := p2.GameState().TotalRoundsPlayed()
		p2.Close()
		gz2.Close()
		f2.Close()

		// Fold the surviving raw rounds (idx <= final) into per-player idle facts + GATE-A/B evidence.
		rawIdleCount := map[uint64]int{}
		rawPresentCount := map[uint64]int{}
		rawActedRounds := map[uint64]int{}
		rawDisp := map[uint64][]float64{}
		for idx, rr := range byRound {
			if idx > finalRounds {
				continue // stranded round from a rewind — the fold drops it, so do we
			}
			for sid := range rr.present {
				rawPresentCount[sid]++
			}
			for sid := range rr.idle {
				rawIdleCount[sid]++
			}
			for sid := range rr.acted {
				if rr.present[sid] {
					rawActedRounds[sid]++
				}
			}
			for sid, d := range rr.maxDisp {
				if rr.present[sid] {
					rawDisp[sid] = append(rawDisp[sid], d)
					allDisp = append(allDisp, d)
				}
			}
			// A present, sampled player who never moved contributes a 0 to the distribution too (so the min is
			// honest): maxDisp has no entry for a player whose only sample was the anchor.
			for sid := range rr.present {
				if rr.sampled[sid] {
					if _, ok := rr.maxDisp[sid]; !ok {
						rawDisp[sid] = append(rawDisp[sid], 0)
						allDisp = append(allDisp, 0)
					}
				}
			}
		}

		totalFrameDone += frameDone
		fmt.Printf("  rounds %d | Σkills %d Σdeaths %d ΣroundsWon %d | Σentry %d Σopening %d | parse %s\n",
			res.RoundsPlayed, sumK, sumD, sumRW, sumEF, sumOD, parseDur.Round(time.Millisecond))
		fmt.Printf("  🚨 GATE A: events.FrameDone fired %d times\n", frameDone)
		if frameDone == 0 {
			failures = append(failures, fmt.Sprintf("%s: 🚨 GATE A FAILED: events.FrameDone NEVER FIRED — every displacement would read 0, flagging every player idle_dq and DQ'ing the whole tournament (trap 2 / the 5.2a failure mode)", name))
		}

		// 🚨 GATE B, per player: the derived idle facts backed by measured movement + action.
		sids := make([]uint64, 0, len(prodIdleCount))
		for sid := range prodIdleCount {
			sids = append(sids, sid)
		}
		sort.Slice(sids, func(i, j int) bool { return sids[i] < sids[j] })
		for _, sid := range sids {
			med := median(rawDisp[sid])
			fmt.Printf("    %d  idle_dq %-5v idle_rounds %d | acted %d/%d rounds  median round disp %.0f units\n",
				sid, prodIdleDQ[sid], prodIdleCount[sid], rawActedRounds[sid], rawPresentCount[sid], med)
			// Reconcile the independent raw derivation 1:1 against production (the WIRED-UP-AND-NON-DEAD proof).
			if rawIdleCount[sid] != prodIdleCount[sid] {
				failures = append(failures, fmt.Sprintf("%s: %d: raw idle_round_count %d != production %d (aggregate does not reconcile)", name, sid, rawIdleCount[sid], prodIdleCount[sid]))
			}
			rawDQ := rawPresentCount[sid] > 0 && rawIdleCount[sid]*2 >= rawPresentCount[sid]*1
			if rawDQ != prodIdleDQ[sid] {
				failures = append(failures, fmt.Sprintf("%s: %d: raw idle_dq %v != production %v (aggregate does not reconcile)", name, sid, rawDQ, prodIdleDQ[sid]))
			}
		}

		// FR-20/5.3 regression net — this story must not perturb the fold.
		if sumK != sumD {
			failures = append(failures, fmt.Sprintf("%s: Σkills %d != Σdeaths %d (fold perturbed)", name, sumK, sumD))
		}
		if sumK != res.RoundsPlayed {
			failures = append(failures, fmt.Sprintf("%s: Σkills %d != rounds %d (fold perturbed)", name, sumK, res.RoundsPlayed))
		}
		if sumRW != res.RoundsPlayed {
			failures = append(failures, fmt.Sprintf("%s: ΣroundsWon %d != rounds %d (fold perturbed)", name, sumRW, res.RoundsPlayed))
		}
		if sumEF != sumOD {
			failures = append(failures, fmt.Sprintf("%s: Σentry_frags %d != Σopening_deaths %d (fold perturbed)", name, sumEF, sumOD))
		}
	}

	// GATE A distribution over ALL demos: the single most important number in this harness.
	sort.Float64s(allDisp)
	dmin, dmed, dmax := 0.0, 0.0, 0.0
	if len(allDisp) > 0 {
		dmin, dmed, dmax = allDisp[0], allDisp[len(allDisp)/2], allDisp[len(allDisp)-1]
	}

	fmt.Printf("\n=== TOTALS over %d demos\n", len(paths))
	fmt.Printf("  🚨 GATE A — events.FrameDone fired %d times; per-round displacement min %.0f / median %.0f / max %.0f units (over %d player-rounds)\n",
		totalFrameDone, dmin, dmed, dmax, len(allDisp))
	if totalFrameDone == 0 {
		failures = append(failures, "🚨 GATE A FAILED ACROSS ALL DEMOS: events.FrameDone never fired — STOP, do not sign off")
	}
	// A live-but-degenerate Position() (all-equal / all-zero) reads median displacement ≈ 0 across a real
	// competitive corpus — impossible if players are actually moving. Make GATE A able to FAIL, not just print.
	if len(allDisp) > 0 && dmed < 1.0 {
		failures = append(failures, fmt.Sprintf("🚨 GATE A FAILED: median per-round displacement is %.2f units — Position() is degenerate; every player would read idle_dq and the whole tournament would be DQ'd (trap 2)", dmed))
	}
	fmt.Printf("  🚨 GATE B — Σidle_rounds %d across all players/demos (expected ≈ 0: a real tournament has nobody AFK)\n", totalIdleRounds)
	fmt.Printf("  Σentry_frags %d · Σopening_deaths %d · Σclutches %d\n", totalEntryFrags, totalOpeningDeaths, totalClutches)
	if totalEntryFrags != totalOpeningDeaths {
		failures = append(failures, fmt.Sprintf("Σentry_frags %d != Σopening_deaths %d across all demos", totalEntryFrags, totalOpeningDeaths))
	}

	fmt.Println("  🚨 5.3 GATE-2 regression — per-team living counts at freeze-time end (T:1 CT:1 ⇒ no clutch transition possible):")
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
	if sawMultiPlayerTeam && totalClutches == 0 {
		failures = append(failures, "🚨 5.3 GATE-2: a team of >=2 was observed at freeze-time end yet Σclutches is 0 — investigate")
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
