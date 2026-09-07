import { ESTATE_LANGUAGES, renderedApplications } from '@/lib/registry';
import { capitalise, pluralise, spellOut } from '@/lib/words';
import './SiteFooter.scss';

/**
 * The site footer (Story 2-11).
 *
 * One line and nothing else. FR-1 says nothing follows the Suite Directory except footer content,
 * and until now there was no footer anywhere in the tree for that to be true of.
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
 * **No `<nav>` and no links.** Footer navigation belongs to Stories 2-15 and 2-17, and the narrative
 * handoff above it to Story 2-12. This ships the line and stops, so
 * `tests/e2e/hit-target-floor.pw.ts`'s per-surface counts do not move: nothing added here is
 * interactive, and a count that moved would mean a control arrived by accident.
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
    </footer>
  );
}
