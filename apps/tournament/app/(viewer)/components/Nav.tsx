'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { es } from '@/lib/i18n/es';
import styles from './Nav.module.css';

/**
 * The four-up viewer nav (AC6): Feed / Llave / Estadísticas / Ceremonia, in that order.
 * Active tab = blue underline (derived from the pathname, so every viewer surface shares this shell).
 * Ceremonia is dimmed + lock-glyphed until the ceremony starts (`ceremonyUnlocked`), and is NOT a
 * link while locked. A `'use client'` island purely so it can read the current route — the labels/
 * lock state come from the server.
 *
 * Route targets are Story 5.7 surfaces; 5.6 wires the nav to them (placeholder pages avoid a 404).
 */
const TABS = [
  { key: 'feed', href: '/', label: es.nav.feed, match: (p: string) => p === '/' },
  { key: 'bracket', href: '/bracket', label: es.nav.bracket, match: (p: string) => p.startsWith('/bracket') },
  {
    key: 'stats',
    href: '/leaderboards',
    label: es.nav.stats,
    match: (p: string) => p.startsWith('/leaderboards'),
  },
] as const;

export function Nav({ ceremonyUnlocked }: { ceremonyUnlocked: boolean }) {
  const pathname = usePathname() ?? '/';
  const ceremonyActive = pathname.startsWith('/ceremonia');

  return (
    <nav className={styles.nav} aria-label={es.nav.landmark}>
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`${styles.navitem} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
      {ceremonyUnlocked ? (
        <Link
          href="/ceremonia"
          className={`${styles.navitem} ${ceremonyActive ? styles.active : ''}`}
          aria-current={ceremonyActive ? 'page' : undefined}
        >
          {es.nav.ceremony}
        </Link>
      ) : (
        <span className={`${styles.navitem} ${styles.locked}`} aria-disabled="true">
          {es.nav.ceremony}
          <span className={styles.lock} aria-hidden="true">
            {'\u{1F512}'}
          </span>
        </span>
      )}
    </nav>
  );
}
