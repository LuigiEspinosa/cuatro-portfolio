'use client';

import Link from 'next/link';
import { PlateMark } from '@/components/molecules/PlateMark/PlateMark';
import { DESTINATIONS } from '@/components/atoms/Navbar/Navbar';
import { useGsapContext } from '@/hooks/useGsapContext';
import { gsap } from 'gsap';
import './error-page.scss';

/**
 * The 404 surface.
 *
 * **Its exits are the header's list, not a copy of it (Story 2-17).** `RESTYLE-SPEC.md:472` fixes
 * an error surface's exits at exactly the ones the application's header already carries, never
 * more and never fewer, and the cheapest way to make that structural rather than asserted is to
 * render the same `DESTINATIONS` the header renders. A third exit cannot arrive here without
 * arriving in the header, and a label changed there changes here in the same edit. The single
 * `← Go home` this replaced was one exit where the header offered two.
 *
 * **No `aria-current`.** The header on this page marks nothing either: an unrouted path is neither
 * destination, so a mark here would announce a page the visitor is not on.
 *
 * **Everything else on this surface is Story 2-30's.** The title, the numeral, the Plate mark, the
 * cybercore literals in `error-page.scss` and the focus ring are all booked there
 * (`EXPERIENCE.md:540-542`). The `ScanlineOverlay` was booked there too until it left with Story
 * 2-28 on 2026-09-14: the layer is a scrim for text over moving imagery, and nothing moves behind
 * the text here, so the surface carries no scrim rather than a faint one (`EXPERIENCE.md:480-481`,
 * `epics.md:3252`). This story adds the two exits and gets them to the hit-target
 * floor, which is why the `error-page__back` class survives on both: `error-page.scss:52-80` styles
 * it, `app/app.scss:82-85` scopes a boundary role on it, and the entrance tween below targets it,
 * so both exits fade in together. The name is 2023 legacy Story 2-30 retires with the rest.
 */
const NotFound = () => {
  const ref = useGsapContext<HTMLDivElement>(() => {
    gsap.from('.error-page__code', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      ease: 'power3.out',
      delay: 0.1,
    });
    gsap.from('.error-page__message', {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      delay: 0.3,
    });
    gsap.from('.error-page__back', {
      opacity: 0,
      y: 10,
      duration: 0.4,
      ease: 'power2.out',
      delay: 0.5,
    });
  }, []);

  return (
    <div className='error-page' ref={ref}>
      <div className='error-page__content'>
        {/* Moved onto the Plate mark's annotated variant by Story 2-31, which retired `HudLabel`, with
            its strings exactly as they were: the label's wording is Story 2-30's criterion. */}
        <PlateMark variant='annotated' label='// ERR_NOT_FOUND' sub='// SIGNAL_LOST' />

        <p className='error-page__code' aria-label='Error 404'>
          404
        </p>

        <div className='error-page__message'>
          <p className='error-page__title'>Page not found.</p>
          <p className='error-page__sub'>The page you're looking for does not exist.</p>
        </div>

        <div className='error-page__exits'>
          {DESTINATIONS.map((destination) => (
            <Link key={destination.href} href={destination.href} className='error-page__back'>
              {destination.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
