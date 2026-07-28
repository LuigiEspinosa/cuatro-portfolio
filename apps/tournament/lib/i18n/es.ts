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
} as const;

/**
 * Screen-reader announcement for a newly-approved result (AC10, EXPERIENCE.md:145 — a fixed pattern):
 * `Resultado aprobado: Dex venció a Theo 16-13`.
 */
export function resultadoAprobado(winner: string, loser: string, a: number, b: number): string {
  return `Resultado aprobado: ${winner} ${es.result.vs} ${loser} ${a}-${b}`;
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
