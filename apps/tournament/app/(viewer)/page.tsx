import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchFeedSnapshot, fetchRegisteredCount } from '@/lib/feed/read';
import { currentTournament } from './current-tournament';
import { es } from '@/lib/i18n/es';
import { TimelineFeed } from './components/TimelineFeed';
import { EmptyState } from './components/EmptyState';
import { SpinRevealNudge } from './components/SpinRevealNudge';
import { fetchViewerCeremony } from '@/lib/ceremony/verification';
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

      {/*
        ⭐⭐ CODE REVIEW 2026-08-11 — THE `spin.reveal` CONSUMER ON THE FEED, WHICH IS THE SURFACE
        DECISION F's ACCEPTED CONSEQUENCE ACTUALLY NAMED: *"a viewer sitting on the feed during the
        ceremony does not see the new card until they reload"* (`6-8b:827-834`). Story 6.10 shipped the
        consumer on `/ceremonia` only, so the gap it was told to close stayed open.
        ⛔ `spin.reveal` is NOT added to `NUDGE_EVENTS` — AC6 forbids it by name, and the shell's
        `RealtimeNudge` rides `tournament:<id>`. This is a second retainer on `ceremony:<id>`, which is
        precisely what the ref-counted topic store exists to serve.
        ⚠ The extra read happens ONLY in `ceremony` state, so the feed's cost outside the ceremony is
        unchanged. The island renders `null`.
      */}
      {await renderCeremonyNudge(client, resolved)}

      {await renderBody(client, resolved)}

      <footer className={styles.footer}>
        <a href="/auth/steam/login" className={styles.signin}>
          {es.auth.signIn}
        </a>
      </footer>
    </>
  );
}

/**
 * Retain `ceremony:<id>` while the ceremony is running, so an `award_reveal` card arrives live.
 *
 * ⚠ FAILS SILENT BY DESIGN. `ceremony_viewer_read` hides a `not_started` ceremony, so a miss here is
 * the gate working, not an error — and AD-11 makes the nudge a pure optimisation anyway: a reload
 * always shows the correct feed, with or without this island.
 */
async function renderCeremonyNudge(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  resolved: Awaited<ReturnType<typeof currentTournament>>,
) {
  if (!resolved.ok || resolved.state !== 'ceremony') return null;
  const ceremony = await fetchViewerCeremony(client, resolved.id);
  if (!ceremony.ok) return null;
  return <SpinRevealNudge ceremonyId={ceremony.ceremony.id} />;
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
