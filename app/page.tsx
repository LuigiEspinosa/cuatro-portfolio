import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SkipLink } from '@/components/atoms/SkipLink/SkipLink';
import type { ServedNarrativePath } from '@/hooks/useNarrativePath';
import HomeLayout from '@/components/organisms/HomeLayout/HomeLayout';
import { Premise } from '@/components/organisms/Premise/Premise';
import { SiteFooter } from '@/components/organisms/SiteFooter/SiteFooter';
import { SuiteDirectory } from '@/components/organisms/SuiteDirectory/SuiteDirectory';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Senior Frontend Engineer',
  description:
    'Senior Frontend Engineer and Team Lead specialising in interactive web experiences and Automatization Tools.',
  openGraph: {
    title: 'Luigi Espinosa | Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer and Team Lead specialising in interactive web experiences and Automatization Tools.',
    // Relative, so `metadataBase` in `app/layout.tsx` resolves it against the one declared origin.
    // A literal here would be a second place the Hub's hostname is written down.
    url: '/',
  },
};

/** The header name. `Headers.get` is case-insensitive, so the casing here is only for reading. */
const SAVE_DATA = 'save-data';

/** The one affirmative token, per the client hints specification. Anything else is not a signal. */
const SAVE_DATA_ON = 'on';

/**
 * Whether this request asked for data saving (Story 2-13, Operator ruling of 2026-09-07).
 *
 * `Save-Data: on` is the client hint a data-saving visitor sends on every request, and it is the
 * only one of the four non-3D triggers that reaches the server. Reading it here is what makes the
 * served bytes already the flat hero for that visitor: `HomeLayout` starts at `'flat'` on both
 * sides of hydration, so nothing is rendered and then taken away. A slow `effectiveType` and an
 * absent WebGL context exist only in the browser and cannot be answered this early.
 *
 * **Parsed as a token list rather than compared as a string.** A header can arrive duplicated, and
 * `Headers.get` then answers the values joined with a comma, so a strict equality against `on`
 * reads `on, on` as no signal at all and puts a data-saving visitor on the 3D path. Any token that
 * is `on`, after trimming and lower-casing, is the signal.
 *
 * **This opts `/` out of static rendering**, which is the price of the ruling and is deliberate:
 * `headers()` is a dynamic API, so the route is server-rendered on demand. Nothing gates on `/`
 * being prerendered, `ops/asset-budget.md` records what that costs its own measurement, and DW-50
 * records the rest.
 */
const savesData = (header: string | null): boolean =>
  (header ?? '').split(',').some((token) => token.trim().toLowerCase() === SAVE_DATA_ON);

export default async function Home() {
  // `'undecided'` rather than `'narrative'` when the header is absent: the header's absence says
  // nothing about WebGL or about the motion preference, both of which are still the browser's to
  // answer. What the server can settle it settles, and it settles nothing else, which is why the
  // type it is handed down as admits those two values and not the third.
  const served: ServedNarrativePath = savesData((await headers()).get(SAVE_DATA)) ? 'flat' : 'undecided';

  return (
    <>
      {/* A-6, and it is first in the fragment because being the first tabbable element is the whole
          of what makes it the accessibility skip-link rather than a second skip control. `Header`
          renders nothing on `/` (`Header.tsx:12`), so nothing focusable precedes this. */}
      <SkipLink />
      {/* `id` is the skip-link's target and `tabIndex={-1}` is what makes the landmark receive
          focus rather than only scroll, the same treatment `SuiteDirectory`'s heading carries. It
          is negative, so `<main>` never becomes a tab stop of its own. */}
      <main id='main' tabIndex={-1}>
        <HomeLayout servedPath={served} />
        {/* The hero is one viewport tall on the default path, shorter than one on the non-3D path
            (Story 2-13), and the directory follows it either way, which is what gives `/#suite` a
            target that resolves. The premise sits between them, so the claim is encountered before
            the evidence for it rather than after (FR-4). On the non-3D path it is also the first
            thing the visitor lands on, which is the typographic hero `EXPERIENCE.md:154-169`
            diagrams: the block is the same one, and only what precedes it changes. */}
        <Premise />
        <SuiteDirectory />
      </main>
      {/* Outside `<main>`, because a footer is not part of the document's main content. Nothing
          follows the Directory except this, which is what FR-1 asks. */}
      <SiteFooter />
    </>
  );
}
