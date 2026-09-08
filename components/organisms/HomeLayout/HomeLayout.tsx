'use client';

import { gsap } from 'gsap';
import Link from 'next/link';
import GemComponent from '@/components/molecules/GemComponent/GemComponent';
import ContactContainer from '@/components/molecules/ContactContainer/ContactContainer';
import GlitchText from '@/components/molecules/GlitchText/GlitchText';
import HudLabel from '@/components/atoms/HudLabel/HudLabel';
import { SkipControl } from '@/components/atoms/SkipControl/SkipControl';
import { useGsapContext } from '@/hooks/useGsapContext';
import { useNarrativePath, type ServedNarrativePath } from '@/hooks/useNarrativePath';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import './HomeLayout.scss';

interface HomeLayoutProps {
  /**
   * What the server already decided from the request, which is `'flat'` for a `Save-Data` visitor
   * and `'undecided'` for everyone else. `app/page.tsx` reads the header; this is only its carrier.
   *
   * It goes no further than this component: `GemComponent` is handed the **decided** path instead,
   * so the decision is taken once on the page rather than once per consumer.
   */
  servedPath?: ServedNarrativePath;
}

const HomeLayout = ({ servedPath = 'undecided' }: HomeLayoutProps) => {
  const reduceMotion = useReduceMotion();

  /**
   * The one decision, read rather than re-derived (Story 2-13).
   *
   * `GemComponent` reads the same hook for the same answer. Neither derives any part of it, which
   * is what lets the fold and the skip control follow the same probe the narrative does.
   *
   * `'undecided'` renders the default path's geometry: the gem's container is present and the hero
   * keeps its viewport lock, so resolving to `'narrative'` changes nothing and resolving to
   * `'flat'` shrinks the hero rather than growing it.
   *
   * **Two of the four triggers never reach that state at all.** The reduced-motion one is answered
   * in CSS, because `HomeLayout.scss` carries the flat shape under a media query as well as under
   * the modifier, so that visitor's first paint is already flat. The `Save-Data` one is answered on
   * the server and arrives here as `servedPath`, so that visitor's first *markup* is already flat.
   * The remaining two are knowable only in the browser and take one collapse after hydration.
   *
   * **This is the page's only call to the hook.** `GemComponent` reads `path` as a prop rather than
   * calling it again: a second call is a second state machine, a second WebGL probe and a third
   * `useReduceMotion` subscription, all answering a question that has already been answered.
   */
  const path = useNarrativePath(servedPath);
  const flat = path === 'flat';

  const containerRef = useGsapContext<HTMLDivElement>(() => {
    const finalState = ['.home-panel--sys', '.home-role', '.nav-link', '.contact-container a'];

    if (reduceMotion) {
      gsap.set(finalState, { opacity: 1, y: 0 });
      gsap.set('.home-gem', { opacity: 1 });
      return;
    }

    const tl = gsap.timeline();

    // The gem's reveal. It was two `filter: brightness()` tweens until Story 2-12, against
    // `HomeLayout.scss`'s `filter: brightness(0)`; `EXPERIENCE.md:685-699` allows `transform` and
    // `opacity` only. The stylesheet's initial state moved with it, so this is still the reveal
    // rather than a flourish on top of one. It is also the only shape that survives the narrative
    // being deferred: a brightness pulse scheduled here fires against a container that may still
    // be empty, while opacity on a transparent container is a no-op the visitor never sees.
    tl.to('.home-gem', { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.5);

    // One tween, no `repeat` and no `yoyo`: `EXPERIENCE.md:693-694` allows one orchestrated
    // entrance per page load and no loop inside it.
    tl.to('.home-role', { opacity: 1, duration: 0.5, ease: 'power2.out' }, 1.3);

    tl.to('.home-panel--sys', { opacity: 1, duration: 0.4, ease: 'power2.out' }, 1.6);

    tl.to('.nav-link', { opacity: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' }, 2.0);

    tl.to(
      '.contact-container a',
      { opacity: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' },
      2.2
    );
  }, [reduceMotion]);

  return (
    <div className={flat ? 'home-container home-container--flat' : 'home-container'} ref={containerRef}>
      {/* FR-2's one interaction, and only on the path that costs one. The flat path reaches the
          Directory by scrolling and no control at all, which is the diagram's zero interactions
          (`EXPERIENCE.md:154-169`). First inside the container, so a keyboard reader meets it
          immediately after the A-6 link rather than after the whole hero, and outside every
          `.home-panel`, so the hover dimming at `HomeLayout.scss:80-82` and the two-second entrance
          both leave it alone.

          Rendered while the decision is still undecided, exactly as `.home-gem` is, because below
          768 it is a static item in the hero's column and one that appeared a frame after paint
          would push the whole page down by its own height. The undecided state is the default
          path's geometry, and this control is part of that geometry. The flat path removes it, and
          `HomeLayout.scss` hides it under the reduced-motion media query so that trigger never
          renders it at all.

          At 360 it is therefore the first thing in the stacked hero, above the name panel.
          `EXPERIENCE.md:529-530` governs the panels' order (name, imagery, navigation, contact) and
          that order is unchanged: this control is not a panel, and the document it belongs to is
          FR-2's one interaction from a cold arrival, which has to be reachable without scrolling
          past the hero it is offering to skip. */}
      {!flat && <SkipControl />}

      <div className='home-panel home-panel--name'>
        <GlitchText text='Luigi Espinosa' delay={1.0} />
        <p className='home-role'>
          <span>Senior Fullstack Engineer / Team Lead</span>
          <span className='home-role__jp' aria-hidden='true'>
            フロントエンドエンジニア
          </span>
        </p>
      </div>

      <div className='home-panel home-panel--sys'>
        <HudLabel label='// SYS_ONLINE ◕' align='right' />
      </div>

      {/* Not rendered at all on the flat path, rather than rendered empty: below 768 this box is
          `90vw` tall in flow, and an empty one is a hole in the middle of a hero whose whole point
          is that no 3D asset was requested.

          **It cannot arrive after the entrance has run, which is why the timeline above needs no
          dependency on the path.** `useGsapContext`'s effect fires on mount, when this box is in
          the DOM: the undecided state renders it, and every trigger that removes it is a resolution
          away from undecided. The hook's decision is terminal, so `flat` is a one-way door and this
          element only ever goes away. Were it able to mount later, it would mount at the
          stylesheet's `opacity: 0` with nothing left to reveal it, and the canvas would draw
          perfectly and invisibly. Verified rather than assumed, and recorded here rather than
          guarded against with a dependency that would restart the entrance mid-load. */}
      {!flat && (
        <div className='home-gem'>
          <GemComponent path={path} />
        </div>
      )}

      <nav className='home-panel home-panel--nav' aria-label='Main navigation'>
        <Link href='/work' className='nav-link'>
          Professional Experience
        </Link>
        {/* Repointed off the `/projects` redirect and relabelled by the Operator ruling of
            2026-09-08, which booked both chrome call sites to Story 2-15. On this route the click
            is a same-route fragment navigation that never reaches the 301, so the visitor lands on
            the Directory rather than at the top of the page, which is what DW-55 and DW-58 record.
            The link's geometry is untouched and its `home-nav` ledger row is Story 2-32's. */}
        <Link href='/#suite' className='nav-link'>
          Suite Directory
        </Link>
        <span className='home-nav-jp' aria-hidden='true'>
          ナビゲーション
        </span>
      </nav>

      <div className='home-panel home-panel--contact'>
        <ContactContainer />
        <span className='home-contact-jp' aria-hidden='true'>
          接続
        </span>
      </div>
    </div>
  );
};

export default HomeLayout;
