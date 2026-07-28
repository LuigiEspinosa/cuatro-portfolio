import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchFeedSnapshot, fetchRegisteredCount } from '@/lib/feed/read';
import { currentTournament } from './current-tournament';
import { es } from '@/lib/i18n/es';
import { TimelineFeed } from './components/TimelineFeed';
import { EmptyState } from './components/EmptyState';
import styles from './feed.module.css';

/*
 * The tournament home (Story 5.6) — the feed IS the home at `/` (PRD: "the tournament home … where
 * everyone lives during the event"). A Server Component that reads published state through the anon,
 * RLS-respecting `createSupabaseServerClient()` (NEVER service-role) and renders the newest-first feed,
 * the empty/cold state, and a relocated Steam-login affordance. `force-dynamic`: the read is per-request,
 * so the page must not be statically prerendered (mirrors the route-handler precedent).
 */
export const dynamic = 'force-dynamic';

export default async function FeedHome({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>;
}) {
  const { login } = await searchParams;
  const loginFailed = login === 'error';

  const client = await createSupabaseServerClient();
  const resolved = await currentTournament();

  return (
    <>
      {loginFailed ? (
        <p role="alert" className={styles.alert}>
          {es.auth.loginFailed}
        </p>
      ) : null}

      {await renderBody(client, resolved)}

      <footer className={styles.footer}>
        <a href="/auth/steam/login" className={styles.signin}>
          {es.auth.signIn}
        </a>
      </footer>
    </>
  );
}

async function renderBody(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resolved: Awaited<ReturnType<typeof currentTournament>>,
) {
  if (!resolved.ok) {
    // No tournament yet → the pre-event empty state; a genuine read error → a non-blank error line.
    return resolved.reason === 'no_tournament' ? (
      <EmptyState registeredCount={0} />
    ) : (
      <ErrorState />
    );
  }

  const snapshot = await fetchFeedSnapshot(client, resolved.id);
  if (!snapshot.ok) {
    return <ErrorState />;
  }
  if (snapshot.cards.length === 0) {
    const registered = await fetchRegisteredCount(client, resolved.id);
    return <EmptyState registeredCount={registered} />;
  }

  const dayHeader =
    resolved.state === 'ceremony' || resolved.state === 'closed'
      ? es.day.bracketClosed
      : es.day.winnersToday;
  return <TimelineFeed cards={snapshot.cards} dayHeader={dayHeader} />;
}

/** Never a blank screen (AC5): a read failure still renders a readable, Spanish message. */
function ErrorState() {
  return (
    <div className={styles.empty}>
      <div className={styles.ring}>{es.empty.ringLabel}</div>
      <p className={styles.emptyBody}>{es.state.error}</p>
    </div>
  );
}
