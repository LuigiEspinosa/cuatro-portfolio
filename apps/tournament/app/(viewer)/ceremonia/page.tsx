import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchVerificationBundle, fetchViewerCeremony } from '@/lib/ceremony/verification';
import { fetchRevealedCeremony } from '@/lib/ceremony/reveal-read';
import { buildRevealView } from '@/lib/ceremony/reveal-model';
import { fetchAwardCatalogCount } from '@/lib/awards/read';
import { currentTournament } from '../current-tournament';
import { es } from '@/lib/i18n/es';
import { Placeholder } from '../components/Placeholder';
import { VerifyStrip } from './VerifyStrip';
import { CeremonyReveal } from './CeremonyReveal';
import { SpinRevealNudge } from '../components/SpinRevealNudge';
import styles from './ceremonia.module.css';

/*
 * The ceremony surface (Story 6.9b, AC6/AC7 — FR-27 / FR-30 / AD-22 / AD-24).
 *
 * ⭐⭐ THIS PAGE STOPS BEING THE STORY-5.7 `<Placeholder>` HERE, AND THAT INVERTS A LINE EVERY GATE
 * TABLE SINCE 6.8a HAS ASSERTED ("/ceremonia still the 5.7 Placeholder", ~11,545 B). The inversion
 * is BY DESIGN and is called out in this story's gate table so a reviewer reads it as intended
 * rather than as a regression.
 *
 * ⭐ DECISION O — THE PAGE READS SERVER-SIDE; THE BROWSER DOES THE CRYPTO. A Server Component with
 * `force-dynamic`, reading through the anon, RLS-respecting `createSupabaseServerClient()` (NEVER
 * service-role), handing the served envelope to a `'use client'` island that owns the button. There
 * is no browser `.rpc()` anywhere in this tree and this story does not add the first one; the tap is
 * PURE COMPUTE, which is what AC13's 2 s budget should measure.
 *
 * ⚠ THE PLACEHOLDER SURVIVES AS THE NOTHING-TO-VERIFY STATE (Cuatro, 2026-08-10). `<Placeholder>` and
 * `es.placeholder.ceremony` are NOT deleted: before the ceremony starts, or before a bundle is
 * published, there is genuinely nothing to verify and the 5.7 surface is still the right answer. So
 * neither becomes an orphan, and the strip appears exactly when there is a commitment to show.
 *
 * ⭐⭐ STORY 6.10 — THE REST OF THE SURFACE ARRIVES, AND THE PAGE GROWS BY AN ORDER OF MAGNITUDE.
 * Everything 6.9b listed as "not here" is here now: the wheel, the phase copy, the trophy shelf, the
 * reveal choreography, the shared-screen mirror, the `prefers-reduced-motion` path (the repo's
 * first), and the `spin.reveal` consumer DECISION F withheld until its UI existed. The zero-winner
 * feed card's doubled "Se revela en la ceremonia" is fixed at BOTH its sites in the same commit
 * (`lib/feed/model.ts` + `TimelineFeed.tsx`), closing `deferred-work.md:369`.
 *
 * ⭐ DECISION T — THE REVEAL IS A SERVER READ. `fetchRevealedCeremony` runs on the ANON client, so
 * every gate is `0028`'s and an unrevealed spin is ABSENT rather than blanked; the browser computes
 * nothing about who won. ⛔ DECISION O still holds beside it: the only browser compute on this page
 * is `Verificar la ceremonia`, which re-derives from the BUNDLE — a different thing entirely.
 *
 * ⭐ DECISION U — the reveal is rendered RESOLVED, and motion is a CSS layer over it. There is no
 * `matchMedia` and NO MOTION BRANCH anywhere in this route; `reveal.module.css`'s one `@media`
 * block is the whole reduced-motion implementation, which is what makes AC3 provable by diffing two
 * captures rather than by assertion.
 *
 * ⚠ CODE REVIEW 2026-08-11 — THE CLAIM IS "NO MOTION BRANCH", NOT "NO JAVASCRIPT" AND NOT "NO TIMER".
 * The route does run timers: `SpinRevealNudge` retains the realtime store, which schedules the 300 ms
 * coalescer and the deferred-teardown tick. None of them reads a motion preference, so AC3 is
 * untouched — but the wider "no timer anywhere on the route" wording was false, and the source scan
 * that appeared to prove it only ever read this one directory.
 */
export const dynamic = 'force-dynamic';

export default async function CeremoniaPage() {
  const client = await createSupabaseServerClient();

  // The tournament is resolved through the SHARED per-request cache (5.6 review, P3) — a second
  // resolver here would mean a second `tournament` read on every render.
  const tournament = await currentTournament();
  if (!tournament.ok) return <Placeholder body={es.placeholder.ceremony} />;

  // ⚠ `ceremony_viewer_read` hides a `not_started` ceremony, so an unstarted one reads as
  // `no_ceremony` from a viewer's seat. That is the gate working, and the placeholder is the honest
  // rendering of it.
  const resolved = await fetchViewerCeremony(client, tournament.id);
  if (!resolved.ok) return <Placeholder body={es.placeholder.ceremony} />;
  const ceremony = resolved.ceremony;

  const read = await fetchVerificationBundle(client, ceremony.id);
  // ⚠ FAIL CLOSED, AND `not_published` IS NOT AN ERROR. Between `lock_ceremony` and `publish_bundle`
  // there is a real window with a ceremony and no commitment; rendering the placeholder there is
  // correct, and rendering a strip with an empty hash would be a verification affordance that
  // verifies nothing.
  //
  // ⭐ 6.9b CODE REVIEW (Cuatro, 2026-08-11) — THE COPY IS `es.verify.unavailable` HERE, NOT THE
  // STORY-5.7 COMING-SOON LINE. `es.placeholder.ceremony` is *"La ceremonia llega en la próxima
  // entrega."*, so a LIVE tournament sitting in the `lock_ceremony` → `publish_bundle` window told
  // viewers the ceremony ships in a future release, and a transport error said the same thing.
  // `es.verify.unavailable` (*"Todavía no hay nada publicado que verificar."*) was authored for
  // exactly this state — its JSDoc says so — and was wired only into the hash line. The
  // coming-soon copy stays for the states where it is true: no tournament, and no ceremony at all.
  if (!read.ok) return <Placeholder body={es.verify.unavailable} />;

  // ⭐⭐ 6.9b CODE REVIEW (Cuatro, 2026-08-11) — THE k=0 GATE, AND IT IS THE HEADLINE FIX.
  // `verification_bundle_read` serves the SUCCESS PREFACE from the instant of publication, with
  // `spin_plan` and `awards` coalesced to `[]`, so between `publish_bundle` and spin 1 the strip
  // rendered over a document describing nothing. `verifyCeremony` then looped zero times and
  // returned `not_yet_revealed` with `mainSpinsChecked: 0` — and the island renders only the
  // outcome, so a skeptical viewer tapped the button and was told *"Hasta aquí cuadra: cada premio
  // ya revelado sale igual al rehacerlo"* over ZERO re-derivations. That is the exact shape
  // `lib/ceremony/verification.ts` warns against in its own header, and it inverts this project's
  // "measure zeros, never narrate them" rule.
  // ⚠ Gated HERE rather than inside `verify.ts` so AC7's five approved strings are untouched:
  // `revealedSpins` was already carried by the reader and simply discarded by this page.
  // ⭐⭐ CODE REVIEW 2026-08-11 — THE SUBSCRIBER MOUNTS HERE TOO, AND WITHOUT IT THE CEREMONY NEVER
  // STARTS BY ITSELF. This is the state the audience sits in: they open `/ceremonia` BEFORE spin 1,
  // which is exactly when people gather. With no `ceremony:<id>` retainer on this branch, the k=0 →
  // k=1 transition required every viewer to reload manually — the "does not see it until they
  // reload" consequence AC6 exists to remove, left in place at the one moment it matters most.
  // ⛔ AC2 IS UNTOUCHED: `SpinRevealNudge` renders `null`, so this adds no strip, no button, no hash,
  // no wheel, no shelf, no locked grid and no `próxima entrega` line — the rendered document is
  // still `Todavía no hay nada publicado que verificar.` and nothing else.
  if (read.envelope.revealedSpins === 0) {
    return (
      <>
        <SpinRevealNudge ceremonyId={ceremony.id} />
        <Placeholder body={es.verify.unavailable} />
      </>
    );
  }

  // ⭐ AC1/AC2 — "PERSISTENT" MEANS PERSISTENT THROUGH THE CHOREOGRAPHY, NOT MOUNTED BEFORE THERE IS
  // ANYTHING TO VERIFY. The strip is built ONCE here, past the k=0 gate, and handed to the reveal as
  // a child so that no component below can construct one on a surface with nothing to check.
  const strip = (
    <VerifyStrip
      complete={read.envelope.complete}
      bundleSha256={read.envelope.bundleSha256}
      bundle={read.envelope.bundle}
      {...(ceremony.seedDemoSha256 === null ? {} : { seedDemoSha256: ceremony.seedDemoSha256 })}
    />
  );

  // ⚠ TWO READS, IN PARALLEL, AND NEITHER IS A SECOND COPY OF SOMETHING ALREADY HELD.
  // `fetchRevealedCeremony` is this story's own reader; `award_catalog_count` is the ONE pre-reveal
  // catalog fact (`lib/awards/read.ts`) and supplies the `n` of `Premio i de n`. ⛔ Nothing here
  // re-reads what the envelope already carries, and widening `lib/ceremony/verification.ts`'s
  // projection is forbidden by its own header.
  // ⚠ CODE REVIEW 2026-08-11 — `revealedSpins`/`totalSpins` no longer reach the view model at all:
  // they were threaded in and rendered by nothing. The k=0 gate above still uses `revealedSpins`,
  // which is what the envelope carries them for.
  const [revealed, catalog] = await Promise.all([
    fetchRevealedCeremony(client, ceremony.id),
    fetchAwardCatalogCount(client, tournament.id),
  ]);

  // ⚠ FAIL CLOSED, AND THE STRIP SURVIVES. If the reveal read refuses, there is still a published
  // commitment to verify — that is what got us past the gate above — so the honest page is the strip
  // alone rather than a half-built ceremony. ⛔ It is NOT the coming-soon placeholder: this is a LIVE
  // ceremony, and rendering `es.placeholder.ceremony` here would be 6.9b review finding D3 again.
  if (!revealed.ok || !catalog.ok) {
    return (
      <div className={styles.page}>
        <SpinRevealNudge ceremonyId={ceremony.id} />
        {strip}
      </div>
    );
  }

  const view = buildRevealView({
    ceremony: revealed.ceremony,
    awardCount: catalog.count,
    complete: read.envelope.complete,
  });

  return (
    <div className={styles.page}>
      {/* AC6 — the `spin.reveal` consumer, shipping in the same commit as the UI it drives. */}
      <SpinRevealNudge ceremonyId={ceremony.id} />
      <CeremonyReveal view={view} verifyStrip={strip} />
    </div>
  );
}
