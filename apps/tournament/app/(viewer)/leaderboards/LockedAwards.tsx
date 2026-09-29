import { es, premioBloqueado, premioDe, categoriasSelladas } from '@/lib/i18n/es';
import styles from './leaderboards.module.css';

/**
 * The locked "Posiciones de premios" block (Story 6.1, AC4 — FR-24 / AD-22 / UX-DR20/25).
 *
 * ⛔⛔ THIS COMPONENT RECEIVES A NUMBER. NOTHING ELSE. No award row, no name, no id, no bucket, no deciding stat —
 * there is no prop through which one could arrive. AD-22 exists precisely to prevent "CSS blur being the only
 * secrecy": the mock renders the REAL award names behind `filter: blur(4.5px)` (mock-leaderboards.html:483-515),
 * which view-source, DevTools or a screen reader defeat instantly. Here the identity is not blurred — it is
 * ABSENT, all the way down to the missing `award` table grant (migration 0023). The blur below sits over a
 * decorative placeholder that never held anything.
 *
 * The visible affordance is the POSITION: `Premio 7 de 12`, in tabular numerals (`.num`, DESIGN.md:236 names this
 * exact string). The accessible name of each card is `Premio {i} de {n} — bloqueado hasta que gire` verbatim.
 *
 * ⚠ NO GOLD anywhere in this block (UX-DR6, DESIGN.md:155-159/274). Gold is reserved for reveals, winners and the
 * champion; a locked card carrying gold is a defect. The mock's gold `.gico` dot and gold `.reveal` pill are the
 * one place its visual language contradicts the design rule — the rule wins. The cover's provenance line reuses
 * the already-fixed `es.ceremony.seededByDemo`.
 *
 * A Server Component: it renders from a plain integer and holds no state. The count read lives in the page.
 */
export function LockedAwards({ count }: { count: number }) {
  // Rendering nothing is the correct answer for an un-curated catalog — never `Premio 1 de 0`. The page also
  // guards this; the component guards it again because it is the one place that cannot be wrong.
  if (!Number.isInteger(count) || count < 1) return null;

  const positions = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <section className={styles.lockSection} aria-labelledby="awards-lock-head">
      <div className={styles.lockhdr}>
        <span className={styles.lk}>
          <span className={styles.lkIco} aria-hidden="true">
            ●
          </span>
          <span id="awards-lock-head" className={styles.htxt}>
            {es.awards.sechead}
          </span>
        </span>
        <span className={styles.reveal}>{es.awards.reveal}</span>
      </div>
      <p className={styles.lockSub}>{es.awards.subhead}</p>

      <div className={styles.lockwrap}>
        <ul className={styles.lockrows}>
          {positions.map((i) => (
            <li key={i} className={styles.lockrow}>
              {/* The AC4 accessible name, verbatim (em dash). The visual below is decorative and hidden from AT
                  so the card is announced exactly once, exactly as specified. */}
              <span className={styles.srOnly}>{premioBloqueado(i, count)}</span>
              <span className={styles.badge} aria-hidden="true">
                ▦
              </span>
              <span className={styles.bk} aria-hidden="true">
                <span className={`${styles.bn} num`}>{premioDe(i, count)}</span>
                <span className={styles.bs}>{es.awards.lockedUntilSpin}</span>
              </span>
              {/* The 7px blurred placeholder — it stands in for an identity that was never sent. */}
              <span className={styles.redact} aria-hidden="true" />
              <span className={styles.lockico} aria-hidden="true">
                ⬚
              </span>
            </li>
          ))}
        </ul>
        {/* ⚠ The cover is NOT aria-hidden (6.1 code review). It carries the block's actual explanation — why the
            awards are locked, how many are sealed, and the provenance line — so hiding the whole container left a
            screen-reader user with nothing but N repetitions of "Premio i de N — bloqueado hasta que gire". Only
            the decorative glyph below is hidden; a11y is the audience the accessible-name rule exists for. */}
        <div className={styles.lockcover}>
          <span className={styles.glock} aria-hidden="true">
            ◗
          </span>
          <span className={styles.lc1}>{es.awards.coverTitle}</span>
          <span className={styles.lc2}>
            <span className="num">{categoriasSelladas(count)}</span>{' '}
            <span className={styles.gd}>{es.ceremony.seededByDemo}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
