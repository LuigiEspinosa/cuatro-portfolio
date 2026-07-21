// Command qa52 is the THROWAWAY live-QA harness for Story 5.2 (THE BAR), deleted after sign-off — the
// established pattern from Story 5.1. It runs the REAL ingest.DemoinfocsParser over every .dem.gz in
// demos/ and checks the FR-19 weird five against the invariants the story names, then makes a SECOND raw
// pass that prints a per-kill diagnostic (weapon type + the four native flags for every counted kill).
//
// The second pass is not decoration: the parser-closure increments (cur.knifeKills[k]++ …) are the one
// site FakeParser cannot drive, so no Go unit test reddens when they are deleted (mutation-verified). THE
// BAR is their coverage — and on 1v1 duel demos these counts are legitimately small or zero, so a zero
// aggregate must be settled by showing the raw flags, never by reasoning from the aggregate alone (the
// Story-5.1 Σmvps=0 precedent).
//
// Usage: go run ./cmd/qa52 [demos-dir]   (default ../demos)
package main

import (
	"compress/gzip"
	"fmt"
	"os"
	"path/filepath"
	"sort"

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
	totals := map[string]int{}
	knifeWeapons := map[string]int{}
	rawFlagged := 0

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

		sumK, sumD, sumRW := 0, 0, 0
		for _, pl := range res.Players {
			sumK += pl.Kills
			sumD += pl.Deaths
			sumRW += pl.RoundsWon
			fmt.Printf("  %d  K %3d  D %3d  RW %2d | knife %2d  wallbang %2d  smoke %2d  noscope %2d  blind %2d\n",
				pl.SteamID64, pl.Kills, pl.Deaths, pl.RoundsWon,
				pl.KnifeKills, pl.WallbangKills, pl.ThroughSmokeKills, pl.NoScopeKills, pl.BlindKills)

			check := func(label string, v int) {
				totals[label] += v
				if v < 0 {
					failures = append(failures, fmt.Sprintf("%s: %d: %s is NEGATIVE (%d)", name, pl.SteamID64, label, v))
				}
				if v > pl.Kills {
					failures = append(failures, fmt.Sprintf("%s: %d: %s (%d) EXCEEDS kills (%d)", name, pl.SteamID64, label, v, pl.Kills))
				}
			}
			check("knife", pl.KnifeKills)
			check("wallbang", pl.WallbangKills)
			check("smoke", pl.ThroughSmokeKills)
			check("noscope", pl.NoScopeKills)
			check("blind", pl.BlindKills)
		}
		// The Story-5.1 regression net: this story must not perturb the fold.
		fmt.Printf("  rounds %d | Σkills %d  Σdeaths %d  ΣroundsWon %d\n", res.RoundsPlayed, sumK, sumD, sumRW)
		if sumK != sumD {
			failures = append(failures, fmt.Sprintf("%s: Σkills %d != Σdeaths %d (fold perturbed)", name, sumK, sumD))
		}
		if sumK != res.RoundsPlayed {
			failures = append(failures, fmt.Sprintf("%s: Σkills %d != rounds %d (fold perturbed)", name, sumK, res.RoundsPlayed))
		}
		if sumRW != res.RoundsPlayed {
			failures = append(failures, fmt.Sprintf("%s: ΣroundsWon %d != rounds %d (fold perturbed)", name, sumRW, res.RoundsPlayed))
		}

		// --- second pass: raw per-kill diagnostic, proving the native flags are present and the handler
		// has something to fire on (independent of the aggregate).
		gz2, f2, err := openGz(p)
		if err != nil {
			failures = append(failures, fmt.Sprintf("%s: reopen: %v", name, err))
			continue
		}
		p2 := dem.NewParser(gz2)
		rawByRound := map[int]int{}
		p2.RegisterEventHandler(func(e events.Kill) {
			if p2.GameState().IsWarmupPeriod() {
				return
			}
			w := "<nil>"
			if e.Weapon != nil {
				w = e.Weapon.String()
				if e.Weapon.Type == common.EqKnife {
					knifeWeapons[w]++
				}
			}
			if (e.Weapon != nil && e.Weapon.Type == common.EqKnife) || e.IsWallBang() || e.ThroughSmoke || e.NoScope || e.AttackerBlind {
				rawFlagged++
				// round = the game's own TotalRoundsPlayed() at kill time. A flagged kill at an index that
				// the FINAL fold no longer keeps (the discarded MatchZy pre-match round, which is NOT
				// warmup) is CORRECTLY absent from the aggregate — that is trap-4 working, not a miss.
				idx := p2.GameState().TotalRoundsPlayed()
				rawByRound[idx]++
				fmt.Printf("    raw kill: round=%-3d weapon=%-16s knife=%-5v pen=%d wallbang=%-5v smoke=%-5v noscope=%-5v attackerBlind=%v\n",
					idx, w, e.Weapon != nil && e.Weapon.Type == common.EqKnife, e.PenetratedObjects,
					e.IsWallBang(), e.ThroughSmoke, e.NoScope, e.AttackerBlind)
			}
		})
		if err := p2.ParseToEnd(); err != nil {
			failures = append(failures, fmt.Sprintf("%s: raw pass: %v", name, err))
		}
		idxs := make([]int, 0, len(rawByRound))
		for i := range rawByRound {
			idxs = append(idxs, i)
		}
		sort.Ints(idxs)
		for _, i := range idxs {
			note := ""
			if i == 0 {
				note = "  <- the DISCARDED MatchZy pre-match round (trap-4): correctly NOT in the aggregate"
			}
			fmt.Printf("    flagged kills at round index %d: %d%s\n", i, rawByRound[i], note)
		}
		p2.Close()
		gz2.Close()
		f2.Close()
	}

	fmt.Printf("\n=== TOTALS over %d demos\n", len(paths))
	for _, k := range []string{"knife", "wallbang", "smoke", "noscope", "blind"} {
		fmt.Printf("  %-9s %d\n", k, totals[k])
	}
	fmt.Printf("  raw flagged kills seen in the second pass: %d\n", rawFlagged)
	if len(knifeWeapons) > 0 {
		fmt.Println("  knife weapon-name breakdown (all must normalize to EqKnife):")
		for w, n := range knifeWeapons {
			fmt.Printf("    %-20s %d\n", w, n)
		}
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
