// PoC: parse a CS2 (.dem) demo and output per-player KNIFE KILLS + DAMAGE/ADR,
// proving the automated-stats approach for the CS2 tournament app is viable.
//
// Stack: Go + demoinfocs-golang/v5 (https://github.com/markus-wa/demoinfocs-golang).
//
// Usage:
//
//	go run . "C:\Users\NumCuatro\Downloads\cache.dem"
//	go run .                 # defaults to ./cache.dem
//
// What it proves (the spike's go/no-go gate):
//   - per-player KNIFE KILLS via e.Weapon.Type == common.EqKnife
//   - per-player DAMAGE -> ADR via events.PlayerHurt
//   - the awards-roulette "moat" stats: wallbang / through-smoke / no-scope
//   - SteamID64 as the roster join key (printed per player)
//   - a full weapon-kill breakdown, so weapon identification is demonstrated
//     even if this particular match happens to contain zero knife kills.
package main

import (
	"fmt"
	"os"
	"sort"
	"text/tabwriter"

	dem "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
)

type playerStat struct {
	steamID   uint64
	name      string
	kills     int
	deaths    int
	assists   int
	knife     int // KNIFE KILLS -- the headline awards-roulette stat
	headshots int
	wallbang  int // through a penetrable surface
	smoke     int // through smoke
	noscope   int
	blind     int // attacker was flashed
	damage    int // capped health damage dealt (scoreboard/ADR convention)
}

func main() {
	path := "cache.dem"
	if len(os.Args) > 1 {
		path = os.Args[1]
	}

	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot open demo %q: %v\n", path, err)
		os.Exit(1)
	}
	defer f.Close()

	p := dem.NewParser(f)
	defer p.Close()

	stats := map[uint64]*playerStat{}
	weaponKills := map[string]int{}

	// get returns the stat row for a player, keyed by SteamID64.
	// Skips bots / world (SteamID64 == 0).
	get := func(pl *common.Player) *playerStat {
		if pl == nil || pl.SteamID64 == 0 {
			return nil
		}
		s := stats[pl.SteamID64]
		if s == nil {
			s = &playerStat{steamID: pl.SteamID64, name: pl.Name}
			stats[pl.SteamID64] = s
		}
		if pl.Name != "" {
			s.name = pl.Name // keep the latest known name
		}
		return s
	}

	p.RegisterEventHandler(func(e events.Kill) {
		if p.GameState().IsWarmupPeriod() {
			return
		}

		if e.Weapon != nil {
			weaponKills[e.Weapon.Type.String()]++
		}

		if k := get(e.Killer); k != nil {
			k.kills++
			if e.IsHeadshot {
				k.headshots++
			}
			if e.Weapon != nil && e.Weapon.Type == common.EqKnife {
				k.knife++
			}
			if e.PenetratedObjects > 0 {
				k.wallbang++
			}
			if e.ThroughSmoke {
				k.smoke++
			}
			if e.NoScope {
				k.noscope++
			}
			if e.AttackerBlind {
				k.blind++
			}
		}
		if v := get(e.Victim); v != nil {
			v.deaths++
		}
		if a := get(e.Assister); a != nil {
			a.assists++
		}
	})

	p.RegisterEventHandler(func(e events.PlayerHurt) {
		if p.GameState().IsWarmupPeriod() {
			return
		}
		if a := get(e.Attacker); a != nil {
			// HealthDamageTaken caps damage at the victim's remaining HP,
			// matching the in-game scoreboard / ADR convention.
			a.damage += e.HealthDamageTaken
		}
	})

	if err := p.ParseToEnd(); err != nil {
		fmt.Fprintf(os.Stderr, "parse error: %v\n", err)
		os.Exit(1)
	}

	rounds := p.GameState().TotalRoundsPlayed()
	if rounds < 1 {
		rounds = 1 // guard divide-by-zero
	}

	// ---- Per-player table, sorted by kills desc ----
	rows := make([]*playerStat, 0, len(stats))
	for _, s := range stats {
		rows = append(rows, s)
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].kills != rows[j].kills {
			return rows[i].kills > rows[j].kills
		}
		return rows[i].damage > rows[j].damage
	})

	fmt.Printf("\n=== CS2 demo parsed: %s ===\n", path)
	fmt.Printf("Rounds played: %d\n\n", rounds)

	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(w, "PLAYER\tSTEAMID64\tK\tD\tA\tKNIFE\tHS\tWB\tSMK\tNOSC\tBLND\tDMG\tADR")
	fmt.Fprintln(w, "------\t---------\t-\t-\t-\t-----\t--\t--\t---\t----\t----\t---\t---")
	for _, s := range rows {
		adr := float64(s.damage) / float64(rounds)
		fmt.Fprintf(w, "%s\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%.1f\n",
			s.name, s.steamID, s.kills, s.deaths, s.assists,
			s.knife, s.headshots, s.wallbang, s.smoke, s.noscope, s.blind,
			s.damage, adr)
	}
	w.Flush()

	// ---- Weapon kill breakdown (proves weapon identification) ----
	type wk struct {
		name  string
		count int
	}
	wks := make([]wk, 0, len(weaponKills))
	for n, c := range weaponKills {
		wks = append(wks, wk{n, c})
	}
	sort.Slice(wks, func(i, j int) bool { return wks[i].count > wks[j].count })

	fmt.Printf("\n=== Weapon kill breakdown (%d weapons) ===\n", len(wks))
	for _, x := range wks {
		fmt.Printf("  %-22s %d\n", x.name, x.count)
	}

	totalKnife := 0
	for _, s := range rows {
		totalKnife += s.knife
	}
	fmt.Printf("\nTotal KNIFE kills in this match: %d\n", totalKnife)
}
