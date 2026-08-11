import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchVerificationBundle, fetchViewerCeremony } from '@/lib/ceremony/verification';
import { currentTournament } from '../current-tournament';
import { es } from '@/lib/i18n/es';
import { Placeholder } from '../components/Placeholder';
import { VerifyStrip } from './VerifyStrip';
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
 * ⛔ NOT HERE, all of it 6.10's: the wheel, the phase copy, the trophy shelf, the reveal
 * choreography, the shared-screen mirror, the `prefers-reduced-motion` path, and the fix for the
 * zero-winner feed card that renders "Se revela en la ceremonia" twice (`deferred-work.md:369` —
 * it will be visibly wrong on the feed beside this strip, and that is expected).
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
  if (read.envelope.revealedSpins === 0) return <Placeholder body={es.verify.unavailable} />;

  return (
    <div className={styles.page}>
      <VerifyStrip
        complete={read.envelope.complete}
        bundleSha256={read.envelope.bundleSha256}
        bundle={read.envelope.bundle}
        {...(ceremony.seedDemoSha256 === null ? {} : { seedDemoSha256: ceremony.seedDemoSha256 })}
      />
    </div>
  );
}
