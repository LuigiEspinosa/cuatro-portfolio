import Link from 'next/link';
import { PlateMark } from '@/components/molecules/PlateMark/PlateMark';
import GlitchText from '@/components/molecules/GlitchText/GlitchText';
import { DESTINATIONS } from '@/components/atoms/Navbar/Navbar';
import './Error404.scss';

/**
 * The 404 surface (Stories 2-17 and 2-30).
 *
 * **The structure is the documents' four parts and nothing else** (`EXPERIENCE.md` § Error
 * surface, `RESTYLE-SPEC.md` § 8 Empty edge): a section Plate mark, the display line as the page's
 * one `<h1>`, one supporting line, and the exits. The display line is `GlitchText`, which
 * `EXPERIENCE.md:447-448` names the error surface's heading as well as the homepage's, so the
 * heading and its entrance are that component's rather than restated here.
 *
 * **The numeral is ornament, and hidden** (O-12 item 3, branch A). With it removed from the
 * accessibility tree the page still says it was not found three times over, in its title, its
 * heading and its message, which `tests/e2e/error-surface.pw.ts` reads rather than assumes. So it
 * carries `aria-hidden` and no name: a hidden element needs none, and the `aria-label` the 2023
 * paragraph carried sat on a role that prohibits one (O-13, a pre-existing defect corrected here,
 * not one the redesign introduced). No element in this component carries a name by attribute.
 *
 * **The label is a plain word.** `// ERR_NOT_FOUND` was decoration a screen reader speaks and a
 * code rather than words (`EXPERIENCE.md` § Plate mark). `Error` is the word the code abbreviated;
 * the rest of it is what the heading says, and the page says one thing once.
 *
 * **Its exits are the header's list, not a copy of it (Story 2-17).** `RESTYLE-SPEC.md:472` fixes
 * an error surface's exits at exactly the ones the application's header already carries, never
 * more and never fewer, and rendering the same `DESTINATIONS` the header renders makes that
 * structural rather than asserted. No `aria-current`: an unrouted path is neither destination.
 * Each exit is a control (`RESTYLE-SPEC.md` § 1), and the ring is the global rule, so nothing here
 * paints one.
 *
 * **A server component.** The three GSAP tweens this surface ran on mount, two of them spatial and
 * none reading the motion preference (DW-77), are one CSS keyframe on opacity in `Error404.scss`,
 * which takes reduced motion from the stylesheet and leaves nothing here to hydrate. No
 * `ScanlineOverlay` either: the layer is for text over moving imagery, and nothing moves behind
 * this text.
 */
const NotFound = () => (
  <div className='error-page'>
    <PlateMark label='Error' />

    <p className='error-page__code' aria-hidden='true'>
      404
    </p>

    <GlitchText text='Page not found.' delay={0.3} />

    <p className='error-page__sub'>The page you’re looking for does not exist.</p>

    <div className='error-page__exits'>
      {DESTINATIONS.map((destination) => (
        <Link key={destination.href} href={destination.href} className='error-page__exit'>
          {destination.label}
        </Link>
      ))}
    </div>
  </div>
);

export default NotFound;
