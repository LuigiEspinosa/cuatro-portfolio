import { PlateMark } from '@/components/molecules/PlateMark/PlateMark';
import { ESTATE_FRAMEWORKS, applications, hubEntry } from '@/lib/registry';
import { capitalise, pluralise, spellOut } from '@/lib/words';
import './Premise.scss';

/**
 * The premise block and the framework band (Story 2-11, FR-4).
 *
 * Story 2-9 put the Suite Directory on the homepage with nothing above it saying what the suite is,
 * so a visitor met a page of evidence before the claim it is evidence for. This is that claim,
 * placed above the Directory in the document so it is encountered before or with it.
 *
 * **A server component, and that is load-bearing rather than incidental.**
 * `lib/__tests__/registry.test.ts:621-668` fails any `'use client'` file that value-imports
 * `@/lib/registry`, because doing so would ship every entry to the browser to render one number.
 * Rendering on the server satisfies that by construction rather than by a mock, and there is no
 * state here to justify a boundary: the band is styled entirely in CSS and carries nothing.
 *
 * **Nothing on this block states a fact of its own.** The opening number is the length of the
 * published Registry, the mark's identity and its trailing cell are the Hub's own entry read through
 * `hubEntry`, and the band's names are the estate's declared list held against that same Registry by
 * test. A count is never typed (`EXPERIENCE.md:299-300`), so none of it can go stale in a way a
 * maintainer has to remember to correct.
 *
 * **No heading.** The reference mockup puts a display line here and the page already has one, which
 * `HomeLayout` renders above this block. A second would be a heading-structure defect, and the
 * premise is prose rather than a section that needs announcing.
 *
 * **The band is `aria-hidden`, and the argument for that does not rest on the Directory.**
 * `DESIGN.md:682-684` alternates it into the muted accent, and `:702` says that role computes to
 * 2.74:1 and is ornament only, never text that means anything, so half the band is sub-contrast text
 * by design. The same file resolves the identical tension for the plate mark's subordinate line at
 * `:701-704` by hiding it in every implementation without exception. What carries the decision is
 * FR-4: the premise beside it must carry for a reader who cannot name a single framework, so nothing
 * on the page depends on the band being read, and hiding text that is decorative by construction is
 * what keeps the contrast audit honest rather than suppressed.
 *
 * **What is *not* true, and was claimed here in an earlier pass, is that every name in the band is
 * also on a row of the Directory below.** Measured against the committed Registry: four of the six
 * appear verbatim in a rendered entry's `tech`, one appears only inside a longer meta-framework
 * value on a rendered row, and one appears on no rendered row at all, its only application being
 * held back by the FR-35 filter. So the band is not a restatement of what is on the page, and an
 * argument that leaned on it being one would be leaning on a coincidence that the next status flip
 * changes. It is ornament, and ornament is hidden because it is ornament.
 */

/**
 * The noun the opening count counts, in its singular form.
 *
 * Separate from the sentence below because it is the one word in the copy that has to agree with a
 * number nobody typed. A Registry holding a single entry read `One personal projects` before this
 * was split out, and the derivation is exactly what made that unreachable by eye: the count comes
 * from a length, so nothing draws attention to the noun beside it.
 */
const COUNTED = 'personal project';

/**
 * The rest of the premise, `EXPERIENCE.md:276-277` verbatim from its third word on.
 *
 * Two sentences, no framework named, no adjective doing work. FR-4 caps it at three and requires it
 * to carry for a reader who cannot name a single one of the things the band lists, which is why the
 * band is not a legend for it and the claim stands with the band deleted.
 *
 * Neither the opening word nor the noun after it is here, because both follow the Registry's length.
 * `one suite` is not one of them: the suite is the thing being described and there is exactly one of
 * it however many applications it holds.
 */
const PREMISE =
  'became one suite. Everything below is running right now, so open it and you are using the real ' +
  'thing, not looking at a picture of it.';

export function Premise() {
  /**
   * The Hub's own entry, which the mark names.
   *
   * Read through the origin comparison rather than by id, so the mark is the same fact as the
   * `You are here` mark on the row below it. Absent, the mark is not drawn: an identity the
   * Registry does not carry is one this block would have to invent.
   */
  const hub = hubEntry();

  /**
   * The domain, off that same entry rather than off a second literal.
   *
   * `new URL` cannot throw here. `hubEntry` matched through `isCurrentOrigin`, which returns true
   * only for an entry whose `live` value `URL` already parsed. The optional test is what the type
   * system requires, `live` being optional on an entry, and not a branch the Registry can reach.
   */
  const domain = hub?.live === undefined ? undefined : new URL(hub.live).hostname;

  return (
    <section className='premise'>
      {hub !== undefined && <PlateMark label={hub.name} domain={domain} />}

      <p className='premise__lede'>
        {`${capitalise(spellOut(applications.length))} ${pluralise(applications.length, COUNTED)} ${PREMISE}`}
      </p>

      {/* Ornament, and the only ornament in the system. It carries no state, is not a legend, and
          is made of real facts: `lib/__tests__/registry.test.ts` holds every name in it against
          some entry's `tech`, because a name that named nothing would be an invented metric. */}
      <p className='premise__band' aria-hidden='true'>
        {ESTATE_FRAMEWORKS.map((framework) => (
          <span className='premise__framework' key={framework}>
            {framework}
          </span>
        ))}
      </p>
    </section>
  );
}
