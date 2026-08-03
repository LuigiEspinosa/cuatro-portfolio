import type { EntryType } from '@/lib/feed/types';

/**
 * The project's single Spanish copy module (Story 5.6, AC9 — the FIRST one; none existed).
 *
 * ⚠ RULE: viewer components carry NO inline string literals. Every viewer-facing word resolves
 * through this module. The DB emits machine values only (entry_type, status); the maps at the
 * bottom turn them into labels.
 *
 * Load-bearing fixed strings are VERBATIM and must not be paraphrased (AC9 / EXPERIENCE.md /
 * mock-home.html): `verificado desde el demo`, `aprobado`, `El evento aún no empieza. Inscripciones
 * abiertas.`, the nav labels, and the `Sembrado por el demo final · reproducible` ceremony chip.
 */
export const es = {
  /** Four-up nav, in order (AC6). `landmark` names the <nav> region itself (not one of its tabs). */
  nav: {
    landmark: 'Navegación principal',
    feed: 'Feed',
    bracket: 'Llave',
    stats: 'Estadísticas',
    ceremony: 'Ceremonia',
  },

  /** Live/status pill (5.8 drives the transitions; 5.6 renders the state statically — AD-11 seam). */
  live: {
    on: 'En vivo',
    off: 'sin transmisión',
    final: 'final',
    reconnecting: 'Reconectando…',
    loading: 'Cargando el evento…',
  },

  /** Day-group header. */
  day: {
    winnersToday: 'Hoy · llave de ganadores',
    bracketClosed: 'Esta noche · la llave está cerrada',
  },

  /** match_result card copy. `vs` is the muted connector rendered between winner and loser. */
  result: {
    vs: 'venció a',
    approved: 'aprobado',
    verified: 'verificado desde el demo', // FIXED — do not paraphrase
  },

  /** bracket_advance card copy: `<b>{player}</b> {avanzaA} {round}`. */
  advance: {
    avanzaA: 'avanza a',
  },

  /** award_reveal teaser copy (locked; no writer yet — provided so the branch renders if a row appears). */
  award: {
    teaserTitle: 'Las carreras de premios se aprietan',
    revealAtCeremony: 'Se revela en la ceremonia',
  },

  /** Pre-event empty state (AC5). `body` is FIXED. */
  empty: {
    ringLabel: '360',
    headline: 'El feed está en silencio — por ahora',
    body: 'El evento aún no empieza. Inscripciones abiertas.', // FIXED — do not paraphrase
    sub: 'Resultados, avances y carreras de premios aterrizan aquí, lo más reciente primero.',
    regOf: 'de',
    regNoun: 'inscritos',
  },

  /** Ceremony banner (end-of-event). `seededByDemo` is FIXED. */
  ceremony: {
    live: 'La ceremonia está en vivo',
    enter: 'Entrar a la ceremonia',
    seededByDemo: 'Sembrado por el demo final · reproducible', // FIXED — do not paraphrase
  },

  /** A viewer name that could not be resolved (removed player hidden from the anon roster read). */
  unknownPlayer: 'Jugador retirado',

  /** Non-blank fallbacks for the cold-load / error paths (AC5 — never a blank screen). */
  state: {
    error: 'No pudimos cargar el evento. Inténtalo de nuevo.',
  },

  /** Discrete auth entry point relocated from the old landing page (Project Structure Notes). */
  auth: {
    signIn: 'Iniciar sesión',
    loginFailed: 'No pudimos verificar tu sesión de Steam. Inténtalo de nuevo.',
  },

  /** Story 5.7 surfaces — nav targets that exist as placeholders so the shell never 404s. */
  placeholder: {
    comingSoon: 'Próximamente',
    bracket: 'La llave llega en la próxima entrega.',
    stats: 'Las estadísticas llegan en la próxima entrega.',
    ceremony: 'La ceremonia llega en la próxima entrega.',
  },

  /**
   * Bracket surface (Story 5.7). Group labels + per-state badges. Round labels are NOT here — they come
   * from the DB `bracket_position` column ("Winners R1", "Grand Final") verbatim (UX-DR3: never a running
   * match number). Fixed strings VERBATIM: `Pase directo`, `W.O. / Ausente`, `sin estadísticas`.
   */
  bracket: {
    winners: 'Ganadores',
    losers: 'Perdedores',
    grandFinal: 'Gran final',
    tbd: 'Por definir', // an unfilled competitor slot (a null roster_entry — the match is not seated yet)
    seed: 'siembra', // `siembra {n}` for the seed chip (the DB bracket_seed position)
    porJugar: 'por jugar', // declared / pending — no score yet
    awaiting: 'en espera', // awaiting_grace — the grace window
    liveBadge: 'en vivo', // the blue live badge (lowercase per the mock node — distinct from es.live.on)
    bye: 'Pase directo', // FIXED — a walkover (UX-DR29)
    forfeit: 'W.O. / Ausente', // FIXED — a no-show forfeit, in --loss red (UX-DR30)
    noStats: 'sin estadísticas', // FIXED — a bye/forfeit records none
    champion: 'Campeón', // the resolved grand-final champion node (the ONLY gold on the screen — UX-DR6)
    victory: 'victoria', // the winner tag on the focused match (mock-bracket.html:665)
    back: 'Volver a la llave', // focused-match → back to the map
    empty: 'La llave se dibuja cuando arranca el evento.', // no match rows yet (pre-bracket)
    notFound: 'No encontramos esa partida.', // a ?match= id that is not in the bracket
  },

  /** Leaderboards surface (Story 5.7). All standings numbers come from the single `public.leaderboard` view. */
  leaderboards: {
    sechead: 'Estadísticas',
    updated: 'Actualizado desde el último demo', // the subhead
    players: 'jugadores', // `{n} jugadores`
    rate: 'Tasa',
    volume: 'Volumen',
    rateHint: 'por oportunidad',
    volumeHint: 'totales · contados',
    // The `segnote` line each class states about itself (AC4 — a class states its class).
    rateNote: 'Eficiencia por oportunidad — ADR, HS%, KAST. El número de rondas se normaliza, así que una racha corta aún puede liderar.',
    volumeNote: 'Totales brutos en todas las rondas. Más rondas jugadas pueden significar más conteos.',
    // Column headers (fixed narrow columns — no horizontal scroll).
    colRank: '#',
    colPlayer: 'Jugador',
    colAdr: 'ADR',
    colHs: 'HS%',
    colKast: 'KAST',
    colKills: 'Kills',
    colKnife: 'Cuchillo',
    colDeaths: 'Muertes',
    colRounds: 'Rondas',
    roundsUnit: 'rondas', // `{n} rondas` in a row's meta line
    eligibility: 'Elegibilidad',
    eligible: 'elegible · todos los pisos superados',
    notEligible: 'aún no elegible · Mín. 24 rondas', // FIXED — the below-floor label (UX-DR39)
    dq: 'DQ',
    // FIXED callout copy (EXPERIENCE.md:72) — note the em dash.
    floorCallout: 'Mín. 24 rondas — partidas inactivas descalificadas de los premios',
    floorSub: 'Piso anti-farmeo: 24 rondas y 20 bajas para calificar. Si te quedas AFK, el demo lo marca.',
    empty: 'Las estadísticas aparecen cuando se aprueba la primera partida.',
  },

  /**
   * The locked "Posiciones de premios" block on /leaderboards (Story 6.1, AC4 — FR-24/AD-22).
   *
   * ⚠ EVERY STRING HERE IS GENERIC ON PURPOSE. The block is rendered from the award COUNT and nothing else: an
   * award's name, bucket, class or deciding stat must not reach the client before its spin (AD-22 is the absence
   * of a viewer read grant, not the mock's blurred-real-names DOM). There is deliberately no place here to put an
   * award name — if you find yourself wanting one, that is Story 6.8's reveal gate, not a copy change.
   *
   * ⚠ NO GOLD in this block (UX-DR6): gold is reserved for reveals, winners and the champion. The cover's
   * provenance line REUSES the already-fixed `es.ceremony.seededByDemo` — never retype it.
   */
  awards: {
    sechead: 'Posiciones de premios', // mock-leaderboards.html:477
    reveal: 'SE DESBLOQUEA EN LA CEREMONIA', // mock-leaderboards.html:478
    subhead: 'Quién gana una camiseta sigue siendo un misterio hasta que gire la ruleta.',
    lockedUntilSpin: 'bloqueado hasta que gire', // the second half of the AC4 accessible name
    coverTitle: 'Posiciones de premios ocultas hasta la ceremonia', // mock-leaderboards.html:512
    sealedSuffix: 'categorías selladas.', // `{n} categorías selladas.` — see categoriasSelladas()
    sealedSuffixOne: 'categoría sellada.', // the SINGULAR — a 1-award catalog is a legal curation (6.1 review)
  },

  /** Player stat detail (Story 5.7). Headline from the leaderboard row; weird totals + matches-behind. */
  player: {
    baseStats: 'Estadísticas base', // FIXED
    weirdStats: 'Estadísticas raras solo del demo', // FIXED
    kda: 'Muertes / Bajas / Asist.', // FIXED (K / D / A order per the mock label)
    adr: 'ADR',
    hsPct: '% de cabeza', // FIXED
    kast: 'KAST',
    noData: 'sin datos', // FIXED — a NULL rate (0-opportunity denominator)
    matches: 'Partidas', // the matches-behind section header (FR-23)
    lostTo: 'Perdió contra',
    beat: 'Venció a',
    backToStats: 'Volver a estadísticas',
    notFound: 'No encontramos a este jugador.',
    // The weird demo-only stat labels (mock: mock-leaderboards.html:611-635).
    weird: {
      knife: 'Muertes con cuchillo',
      wallbang: 'Atraviesa-muros',
      smoke: 'A través del humo',
      noScope: 'Sin mira',
      blind: 'Muertes a ciegas',
    },
  },

  /**
   * Provenance line (Story 5.7 player detail). `verified` is the CAPITALIZED, sentence-initial form —
   * DISTINCT from the lowercase feed/bracket chip `es.result.verified` = 'verificado desde el demo'. Keep both.
   */
  provenance: {
    verified: 'Verificado desde el demo', // FIXED — do not paraphrase
    seedPublished: 'semilla publicada', // `· semilla publicada {hash}`
  },
} as const;

/**
 * Screen-reader announcement for a newly-approved result (AC10, EXPERIENCE.md:145 — a fixed pattern):
 * `Resultado aprobado: Dex venció a Theo 16-13`.
 */
export function resultadoAprobado(winner: string, loser: string, a: number, b: number): string {
  return `Resultado aprobado: ${winner} ${es.result.vs} ${loser} ${a}-${b}`;
}

/**
 * The visible counter on a locked award card: `Premio 7 de 12`. Called out BY NAME at DESIGN.md:236 as one of the
 * values that must use tabular lining numerals — the caller wraps it in `.num`.
 */
export function premioDe(index: number, total: number): string {
  return `Premio ${index} de ${total}`;
}

/**
 * The ACCESSIBLE NAME of a locked award card (Story 6.1, AC4) — verbatim, EM DASH included:
 * `Premio 7 de 12 — bloqueado hasta que gire`. The visual may split it across two spans; the accessible name is
 * this one string. ⚠ It names an award by its POSITION and never by its identity — that is the whole point.
 */
export function premioBloqueado(index: number, total: number): string {
  return `${premioDe(index, total)} — ${es.awards.lockedUntilSpin}`;
}

/**
 * The cover line's count: `12 categorías selladas.` (mock-leaderboards.html:513).
 *
 * ⚠ Agrees in NUMBER (6.1 code review). The catalog may legally hold a single award — `curate_award_catalog`
 * accepts 1..64 — and `1 categorías selladas.` is wrong Spanish on the one fixed-copy line of the locked block.
 */
export function categoriasSelladas(total: number): string {
  return `${total} ${total === 1 ? es.awards.sealedSuffixOne : es.awards.sealedSuffix}`;
}

/** entry_type → human label (AD-24 machine-value → label). Node COLOR is a separate pure map (AC3). */
export const entryTypeLabel: Record<EntryType, string> = {
  match_result: 'Resultado',
  bracket_advance: 'Avance',
  award_reveal: 'Premio',
};

/** stat/publish status → label. The feed carries no status column (AD-7), but the chip reads `aprobado`. */
export const statusLabel = {
  approved: 'Aprobado',
  pending: 'Pendiente',
} as const;
