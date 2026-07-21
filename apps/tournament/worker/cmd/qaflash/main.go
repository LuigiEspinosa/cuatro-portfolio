// Command qaflash is a THROWAWAY probe answering one question the Story-5.2 review left open with faulty
// reasoning: blind_kills read 0 across all 14 QA demos, and the story explained that away as "AttackerBlind
// needs a TEAMMATE to flash you, and 1v1 duels have no teammates". That premise is wrong — in a 1v1 the
// ENEMY can flash you (you kill them blind = classic "blind justice"), and you can self-flash. So a zero is
// only "proven by mode" if flashbangs were never detonated at all. This probe measures that directly.
//
// Usage: go run ./cmd/qaflash [demos-dir]   (default ../demos)
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
)

func main() {
	dir := "../demos"
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}
	paths, _ := filepath.Glob(filepath.Join(dir, "*.dem.gz"))
	sort.Strings(paths)
	if len(paths) == 0 {
		fmt.Printf("no .dem.gz in %s\n", dir)
		os.Exit(1)
	}

	var totFlashExplode, totPlayerFlashed, totBlindedNonZero, totKills, totKillerBlindNonZero, totScopedKills, totScopedNoScope int

	for _, p := range paths {
		f, err := os.Open(p)
		if err != nil {
			fmt.Println(err)
			continue
		}
		gz, err := gzip.NewReader(f)
		if err != nil {
			f.Close()
			fmt.Println(err)
			continue
		}
		pr := dem.NewParser(gz)

		var flashExplode, playerFlashed, blindedNonZero, kills, killerBlindNonZero, scopedKills, scopedNoScope int
		var maxFlashOnKiller float32

		pr.RegisterEventHandler(func(e events.FlashExplode) { flashExplode++ })
		pr.RegisterEventHandler(func(e events.PlayerFlashed) {
			playerFlashed++
			if e.Player != nil && e.Player.FlashDuration > 0 {
				blindedNonZero++
			}
		})
		pr.RegisterEventHandler(func(e events.Kill) {
			if pr.GameState().IsWarmupPeriod() {
				return
			}
			kills++
			// ⚠ FlashDuration is the ASSIGNED duration and can persist as a stale value after the effect has
			// expired. IsBlinded()/FlashDurationTimeRemaining() is the live check — that is the honest
			// comparison against AttackerBlind, and the difference decides whether a zero is a bug or my probe
			// being sloppy.
			if e.Killer != nil && e.Killer.IsBlinded() {
				killerBlindNonZero++
				if r := float32(e.Killer.FlashDurationTimeRemaining().Seconds()); r > maxFlashOnKiller {
					maxFlashOnKiller = r
				}
				fmt.Printf("    BLIND KILL: killer flashDur=%.2fs remaining=%.2fs AttackerBlind=%v weapon=%v\n",
					e.Killer.FlashDuration, e.Killer.FlashDurationTimeRemaining().Seconds(), e.AttackerBlind, e.Weapon)
			}
			// Scoped weapons are the only ones a "no-scope" is meaningful for.
			if e.Weapon != nil && (e.Weapon.Type == common.EqAWP || e.Weapon.Type == common.EqScout ||
				e.Weapon.Type == common.EqG3SG1 || e.Weapon.Type == common.EqScar20) {
				scopedKills++
				if e.NoScope {
					scopedNoScope++
				}
			}
		})
		if err := pr.ParseToEnd(); err != nil {
			fmt.Printf("%s: %v\n", filepath.Base(p), err)
		}
		pr.Close()
		gz.Close()
		f.Close()

		fmt.Printf("%-34s flashExplode %3d | playerFlashed %3d | flashed>0s %3d | kills %3d | killerFlashed>0s %2d (max %.2fs) | scopedKills %2d noscope %d\n",
			filepath.Base(p), flashExplode, playerFlashed, blindedNonZero, kills, killerBlindNonZero, maxFlashOnKiller, scopedKills, scopedNoScope)

		totFlashExplode += flashExplode
		totPlayerFlashed += playerFlashed
		totBlindedNonZero += blindedNonZero
		totKills += kills
		totKillerBlindNonZero += killerBlindNonZero
		totScopedKills += scopedKills
		totScopedNoScope += scopedNoScope
	}

	fmt.Printf("\n=== TOTALS over %d demos\n", len(paths))
	fmt.Printf("  FlashExplode events            %d\n", totFlashExplode)
	fmt.Printf("  PlayerFlashed events           %d\n", totPlayerFlashed)
	fmt.Printf("  ...of those, FlashDuration>0   %d\n", totBlindedNonZero)
	fmt.Printf("  non-warmup kills               %d\n", totKills)
	fmt.Printf("  kills where KILLER FlashDur>0  %d   <- what blind_kills should be counting\n", totKillerBlindNonZero)
	fmt.Printf("  scoped-weapon kills            %d (of which NoScope %d)\n", totScopedKills, totScopedNoScope)
	fmt.Println()
	switch {
	case totFlashExplode == 0:
		fmt.Println("VERDICT: no flashbang ever detonated in these demos -> blind_kills=0 is PROVEN BY MODE.")
		fmt.Println("         The flag itself remains UNEXERCISED by live data; it is unit-tested only.")
	case totKillerBlindNonZero > 0:
		fmt.Println("VERDICT: flashes DID detonate AND killers WERE blinded at kill time, yet blind_kills=0.")
		fmt.Println("         -> AttackerBlind is likely NOT POPULATED. This is a real gap, not a mode artifact.")
	default:
		fmt.Println("VERDICT: flashes detonated, but no killer was blinded at the moment of a kill.")
		fmt.Println("         blind_kills=0 is a genuine property of these demos; the flag stays unexercised live.")
	}
}
