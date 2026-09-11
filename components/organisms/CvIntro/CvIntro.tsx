import Link from 'next/link';
import { PlateMark } from '@/components/molecules/PlateMark/PlateMark';
import { renderedApplications } from '@/lib/registry';
import { work } from '@/content/work';
import { capitalise, pluralise, spellOut } from '@/lib/words';
import './CvIntro.scss';

/**
 * The block above the work timeline on `/cv` (Story 2-16).
 *
 * `/cv` was a 308 to `/pdf/cv.pdf` until this story, so the header's second destination started a
 * download rather than opening a page. This is the page's own opening: what the surface is, whose
 * it is, and the two places a reader goes next. Everything below it is `WorkTimeline`, mounted
 * exactly as `app/work/page.tsx:21` mounts it.
 *
 * **A server component, on `Premise`'s shape.** `components/organisms/Premise/Premise.tsx:91-110`
 * is the pattern this follows: a plate mark, then a lede, with every number read rather than typed.
 * `lib/__tests__/registry.test.ts:621-668` fails any `'use client'` file that value-imports
 * `@/lib/registry`, so rendering on the server is what keeps the Registry off the wire rather than
 * a mock saying it is. There is no state here to justify a boundary.
 *
 * **No number is typed, and neither is any claim behind one.** The two counts are the length of
 * `content/work.ts` and the length of the Registry's rendered subset, spelled through `lib/words`.
 * A count written by hand goes stale the day an entry lands and nobody reads the sentence beside
 * it, which is the failure `EXPERIENCE.md:299-300` forbids and the one `Premise` was built against.
 *
 * **This block carries the page's `<h1>` and `WorkHero` is deliberately not here.** That hero owns
 * the heading on `/work` and mounts a WebGL canvas; putting it on a second route would give two
 * surfaces the same `<h1>` and pay for a 3D scene on a document that is a reading surface.
 *
 * **There is no section heading above the timeline, and that is a decision.** `WorkItem.tsx:103`
 * renders each company as an `<h2>`, so a label such as `Experience` could only be another `<h2>`
 * and would tell a screen reader the four companies are peers of the word rather than inside it.
 * On a CV the companies are the sections, so the label is dropped rather than the outline bent.
 *
 * **The PDF survives the redirect's removal.** `cuatro.dev/cv` served `/pdf/cv.pdf` from before
 * this story and people hold that URL. The file is not moved or renamed; it is linked from here, so
 * removing the redirect costs nobody the artefact it used to hand them.
 */

/** The noun the first count counts, in its singular form. Its plural is irregular, so it is given. */
const EMPLOYERS = 'company';

/** The plural of that noun, supplied because `-s` is wrong for it. */
const EMPLOYERS_PLURAL = 'companies';

/** The noun the second count counts, the same one `Premise.tsx:55` uses for the same entries. */
const PROJECTS = 'personal project';

/**
 * The lede, split at the link.
 *
 * Two fragments rather than one string because the destination sits inside the sentence:
 * `RESTYLE-SPEC.md:192` gives the in-prose link its own treatment precisely so a box does not break
 * the line it is in. Neither fragment carries a number; both counts are derived above them.
 */
const LEDE_OPENING = ', most recent first, with what each one covered. The ';
const LEDE_CLOSING = ' are in ';

export function CvIntro() {
  return (
    <section className='cv-intro'>
      <PlateMark label='Curriculum Vitae' domain='cuatro.dev/cv' />

      <h1 className='cv-intro__name'>Luigi Espinosa</h1>

      <p className='cv-intro__lede'>
        {`${capitalise(spellOut(work.length))} ${pluralise(work.length, EMPLOYERS, EMPLOYERS_PLURAL)}`}
        {LEDE_OPENING}
        {`${spellOut(renderedApplications.length)} ${pluralise(renderedApplications.length, PROJECTS)}`}
        {LEDE_CLOSING}
        <Link className='cv-intro__link cv-intro__link--prose' href='/#suite'>
          <span className='cv-intro__rule'>the suite</span>
        </Link>
        .
      </p>

      {/* The affordance the redirect used to be. It is a document rather than a route, so it is an
          `<a>` and not a `<Link>`: the App Router has nothing to prefetch for a static file, and a
          client-side navigation into one is what DW-64 recorded on the header's own link. */}
      <a className='cv-intro__link cv-intro__link--primary' href='/pdf/cv.pdf'>
        <span className='cv-intro__rule'>Download PDF</span>
      </a>
    </section>
  );
}
