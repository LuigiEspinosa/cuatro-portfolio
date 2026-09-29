import { es } from '@/lib/i18n/es';

/**
 * Pure bracket view-model + grouping (Story 5.7, Task 3). These are the node-testable units (Task 9): a raw
 * `match` row + resolved name/seed lookups in, a fully-shaped per-state node model out. The bracket surface
 * renders the model verbatim and does NO further data work (AC8). No React, no DB here.
 *
 * The node render is a PURE FUNCTION of `match.state` (AC3): a score is present ONLY for
 * `resolved`/`manual_resolved`; every other state maps to competitors + a badge/status, never a score. This
 * is where "a pending score never leaks" is actually enforced on the read side (the DB policy is `using(true)`
 * — 0022 — so the honesty lives HERE, per the flagged decision).
 */

/** The three brackets (mirrors match.bracket / lib/bracket/generate.ts, re-declared to keep this module pure). */
export type BracketName = 'winners' | 'losers' | 'grand_final';

/** The full match.state closed set (0010:65). The AC3 table is a total function over these. */
export type MatchState =
  | 'declared'
  | 'awaiting_grace'
  | 'live'
  | 'bye'
  | 'void'
  | 'forfeit'
  | 'pending'
  | 'resolved'
  | 'manual_resolved'
  | 'rolled_back';

/** A raw `match` row as selected through the anon client (hand-typed — no generated types, mirroring feed). */
export interface MatchRow {
  id: number;
  tournament_id: number;
  bracket: BracketName;
  bracket_position: string; // the human LABEL — render this, NEVER a running match number (UX-DR3)
  bracket_slot: number; // the ordering key within a bracket
  gf_order: number | null; // 1 = GF, 2 = GF-reset (AD-21); null otherwise
  competitor_a: number | null; // roster_entry.id — NOT a name, NOT steamid64 (AD-4)
  competitor_b: number | null;
  winner_entry: number | null;
  score_a: number | null;
  score_b: number | null;
  state: MatchState;
  demo_id: number | null; // present → the match has a bound demo (show the verified chip)
}

/** The blue live badge / the two structural walkover badges (machine tokens; the component maps to es.bracket). */
export type NodeBadge = 'live' | 'bye' | 'forfeit';

/** A short "por jugar" / "en espera" status token for the undecided states (component → es.bracket). */
export type NodeStatus = 'por_jugar' | 'awaiting';

/** One competitor slot of a node. `tbd` = the slot is not yet seated (a null roster_entry). */
export interface NodeCompetitor {
  name: string | null; // null = TBD (unseated); otherwise a resolved display name (or es.unknownPlayer)
  seed: number | null; // roster_entry.bracket_seed
  score: number | null; // present ONLY when the node is scored (resolved/manual_resolved)
  outcome: 'win' | 'loss' | null; // drives --win green / --loss red; null when not scored
}

/**
 * The shaped per-state node model. `competitors` is winner-first when the node is scored (mirrors the 5.6
 * feed's winner-first fix), else seat order (a, b). `null` from `matchNodeModel` means a `void` node —
 * structural-only, render nothing (AC3).
 */
export interface MatchNodeModel {
  id: number;
  bracket: BracketName;
  position: string; // bracket_position, verbatim
  competitors: [NodeCompetitor, NodeCompetitor];
  badge: NodeBadge | null;
  status: NodeStatus | null;
  scored: boolean; // whether scores render (resolved/manual_resolved only)
  noStats: boolean; // bye/forfeit → the "sin estadísticas" note
  verified: boolean; // a demo is bound → the "verificado desde el demo" chip
  isChampion: boolean; // the resolved grand-final champion — the ONLY gold on the screen (UX-DR6)
}

/** The grouped snapshot the surface renders: three vertically-stacked sections (AC2 / stacked-layout decision). */
export interface BracketGroups {
  winners: MatchNodeModel[];
  losers: MatchNodeModel[];
  grandFinal: MatchNodeModel[];
}

const isScored = (state: MatchState): boolean => state === 'resolved' || state === 'manual_resolved';

/** Resolve a roster_entry.id to a display name, degrading gracefully (removed player → neutral label). */
function nameOf(names: Map<number, string>, rosterEntryId: number | null): string | null {
  if (rosterEntryId == null) return null; // TBD — an unseated slot
  return names.get(rosterEntryId) ?? es.unknownPlayer;
}

function competitor(
  names: Map<number, string>,
  seeds: Map<number, number>,
  rosterEntryId: number | null,
  score: number | null,
  outcome: 'win' | 'loss' | null,
): NodeCompetitor {
  return {
    name: nameOf(names, rosterEntryId),
    seed: rosterEntryId == null ? null : (seeds.get(rosterEntryId) ?? null),
    score,
    outcome,
  };
}

/**
 * Detect the champion (AC2): the resolved grand-final winner — the ONLY node that gets the gold border.
 *
 * AD-21 makes the grand final up to two rows. A champion exists in exactly two shapes, both derivable from
 * the rows alone (no external flag needed — this cross-checks tournament.final_match_id conceptually):
 *   * the RESET (gf_order=2) is resolved → its winner is champion; OR
 *   * game 1 (gf_order=1) is resolved AND its winner is competitor_a — side A is ALWAYS the Winners champion
 *     (0 losses; lib/bracket/generate.ts:442), so a side-A win crowns them outright and no reset fires.
 * A gf_order=1 win by competitor_b (the Losers survivor) forces the reset, so it is NOT yet a champion —
 * this is exactly why the naive "highest resolved gf_order" rule is wrong and is avoided here.
 */
export function detectChampion(matches: MatchRow[]): { entryId: number; matchId: number } | null {
  const gfs = matches.filter((m) => m.bracket === 'grand_final');
  const reset = gfs.find((m) => m.gf_order === 2);
  if (reset && isScored(reset.state) && reset.winner_entry != null) {
    return { entryId: reset.winner_entry, matchId: reset.id };
  }
  const game1 = gfs.find((m) => m.gf_order === 1);
  if (
    game1 &&
    isScored(game1.state) &&
    game1.winner_entry != null &&
    game1.winner_entry === game1.competitor_a
  ) {
    return { entryId: game1.winner_entry, matchId: game1.id };
  }
  return null;
}

/**
 * Shape one match into its per-state node model, or `null` for a `void` node (render nothing — AC3).
 *
 * `championMatchId` is the id returned by `detectChampion` (or null); only that grand-final node is gold.
 */
export function matchNodeModel(
  match: MatchRow,
  names: Map<number, string>,
  seeds: Map<number, number>,
  championMatchId: number | null,
): MatchNodeModel | null {
  if (match.state === 'void') return null; // structural-only — never played, advances nobody

  const scored = isScored(match.state);

  // Per-state badge + status (the AC3 table).
  let badge: NodeBadge | null = null;
  let status: NodeStatus | null = null;
  let noStats = false;
  switch (match.state) {
    case 'live':
      badge = 'live';
      break;
    case 'bye':
      badge = 'bye';
      noStats = true;
      break;
    case 'forfeit':
      badge = 'forfeit';
      noStats = true;
      break;
    case 'awaiting_grace':
      status = 'awaiting';
      break;
    case 'declared':
    case 'pending':
    case 'rolled_back': // an approved result was undone → revert to the undecided display (AC3)
      status = 'por_jugar';
      break;
    default:
      break; // resolved / manual_resolved → no badge/status; the score carries it
  }

  const aScore = scored ? match.score_a : null;
  const bScore = scored ? match.score_b : null;
  // Outcome (win/loss) only when scored — drives --win/--loss coloring; never on an undecided node.
  const aOutcome: 'win' | 'loss' | null = scored
    ? match.winner_entry != null && match.winner_entry === match.competitor_a
      ? 'win'
      : 'loss'
    : null;
  const bOutcome: 'win' | 'loss' | null = scored
    ? match.winner_entry != null && match.winner_entry === match.competitor_b
      ? 'win'
      : 'loss'
    : null;

  const a = competitor(names, seeds, match.competitor_a, aScore, aOutcome);
  const b = competitor(names, seeds, match.competitor_b, bScore, bOutcome);

  // Winner-first ordering when scored (mirrors the 5.6 feed fix): the winner's row leads.
  const competitors: [NodeCompetitor, NodeCompetitor] =
    scored && b.outcome === 'win' ? [b, a] : [a, b];

  return {
    id: match.id,
    bracket: match.bracket,
    position: match.bracket_position,
    competitors,
    badge,
    status,
    scored,
    noStats,
    verified: match.demo_id != null,
    isChampion: match.bracket === 'grand_final' && championMatchId != null && match.id === championMatchId,
  };
}

/**
 * Group + shape a whole bracket. Orders each section by `bracket_slot` (the structural key; index
 * match_tournament_bracket_idx), drops `void` nodes, and marks the champion node gold. Empty input → three
 * empty groups (the surface renders its pre-bracket empty state).
 */
export function groupBracket(
  matches: MatchRow[],
  names: Map<number, string>,
  seeds: Map<number, number>,
): BracketGroups {
  const champion = detectChampion(matches);
  const championMatchId = champion?.matchId ?? null;

  const shape = (bracket: BracketName): MatchNodeModel[] =>
    matches
      .filter((m) => m.bracket === bracket)
      // Tiebreak on gf_order: the grand final's two rows share bracket_slot=0 (game 1 / reset — AD-21),
      // so bracket_slot alone leaves their order to input order. Keep game 1 (gf_order=1) above the reset.
      .sort((x, y) => x.bracket_slot - y.bracket_slot || (x.gf_order ?? 0) - (y.gf_order ?? 0))
      .map((m) => matchNodeModel(m, names, seeds, championMatchId))
      .filter((n): n is MatchNodeModel => n !== null);

  return {
    winners: shape('winners'),
    losers: shape('losers'),
    grandFinal: shape('grand_final'),
  };
}

/** Every roster_entry.id a snapshot references (both competitors + the winner), for one batched resolve. */
export function collectCompetitorIds(matches: MatchRow[]): number[] {
  const ids = new Set<number>();
  for (const m of matches) {
    for (const v of [m.competitor_a, m.competitor_b, m.winner_entry]) {
      if (typeof v === 'number' && Number.isFinite(v)) ids.add(v);
    }
  }
  return [...ids];
}
