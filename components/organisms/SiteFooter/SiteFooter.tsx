import Link from 'next/link';
import { ESTATE_LANGUAGES, renderedApplications } from '@/lib/registry';
import { capitalise, pluralise, spellOut } from '@/lib/words';
import './SiteFooter.scss';

/**
 * The site footer (Story 2-11, footer navigation added by Story 2-17).
 *
 * One line and one row of links, which is the shape `EXPERIENCE.md:1024` allows a footer and
 * nothing more. FR-1 says nothing follows the Suite Directory except footer content, and until
 * Story 2-11 there was no footer anywhere in the tree for that to be true of.
 *
 * **A server component**, for the same reason the Directory above it is one: a client component
 * that value-imported the Registry would ship every entry to the browser to render one figure,
 * which `lib/__tests__/registry.test.ts:621-668` refuses.
 *
 * **Both figures are lengths, never words typed here.** `EXPERIENCE.md:295` writes the line and adds
 * that it is updated when the count changes or deleted. A rule that cannot go stale satisfies both
 * without a maintainer remembering: flip an entry's status in the Registry and the first word
 * follows it in the same change, with no edit to this file.
 *
 * **One `<nav>`, one link, and it is the only way onto `/celeste`.** `EXPERIENCE.md:115-123` puts
 * that route in the footer and nowhere else: the header carries its two destinations
 * (`Navbar.tsx`) and every further link anywhere competes with reaching the Directory. The
 * `aria-label` is what tells this landmark apart from `nav.navbar` for assistive tech, and it is
 * a landmark at all because one link in a footer is still footer navigation. `/recommendation`
 * was to sit beside it until Story 2-17 retired that route on the Operator ruling of 2026-09-11.
 *
 * **The link is the Secondary kind** (`RESTYLE-SPEC.md:191`): the line it joins is fine print in
 * secondary text, and a Primary underline here would out-weigh the Directory above it. The rule is
 * drawn on the inner span rather than on the hit-target box, or it floats away from the text by
 * the height of the padding that gets the box to the floor (`RESTYLE-SPEC.md:198-199`); the token
 * names live in `SiteFooter.scss`, which is listed as token-native, and not here.
 *
 * **This moves `/`'s per-surface count in `tests/e2e/hit-target-floor.pw.ts` by exactly one**, and
 * that count is pinned so a second control arriving here by accident fails naming a number.
 */

/**
 * Already the product's own separator, in the Directory's tech line and in `EXPERIENCE.md:295`.
 *
 * `SuiteDirectory.tsx` declares its own, and the two are held equal by
 * `components/organisms/SiteFooter/__tests__/SiteFooter.test.tsx` through what each one renders
 * rather than by one importing the other. Each file's comment cites the other as evidence that one
 * separator serves the whole product, and that claim needs something behind it: a character changed
 * in one place would leave both files still agreeing with themselves.
 */
const SEPARATOR = ' · ';

/**
 * The one thing the operator count is: a person, not a length.
 *
 * Written out because there is nothing in the Registry it could be derived from, which is exactly
 * the distinction that makes deriving the other two worth the machinery. An estate with a second
 * maintainer is a change to who runs it, not a row appearing in a file.
 */
const OPERATORS = 'one operator';

export function SiteFooter() {
  const applications = renderedApplications.length;
  const languages = ESTATE_LANGUAGES.length;

  // Each figure agrees with the noun beside it. Both are lengths, so a Registry rendering one entry
  // would otherwise read `One applications` with nothing anywhere disagreeing.
  const line = [
    `${capitalise(spellOut(applications))} ${pluralise(applications, 'application')}`,
    `${spellOut(languages)} ${pluralise(languages, 'language')}`,
    OPERATORS,
  ].join(SEPARATOR);

  return (
    <footer className='site-footer'>
      <p className='site-footer__line'>{line}</p>
      <nav className='site-footer__nav' aria-label='Footer'>
        <Link href='/celeste' className='site-footer__link'>
          <span className='site-footer__label'>Celeste</span>
        </Link>
      </nav>
    </footer>
  );
}
