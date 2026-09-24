'use client';

import Link from 'next/link';
import GemComponent from '@/components/molecules/GemComponent/GemComponent';
import ContactContainer from '@/components/molecules/ContactContainer/ContactContainer';
import GlitchText from '@/components/molecules/GlitchText/GlitchText';
import ScanlineOverlay from '@/components/atoms/ScanlineOverlay/ScanlineOverlay';
import { SkipControl } from '@/components/atoms/SkipControl/SkipControl';
import { SuiteReach } from '@/components/organisms/SuiteDirectory/SuiteReach';
import { useNarrativePath, type ServedNarrativePath } from '@/hooks/useNarrativePath';
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
   * `useReduceMotion` subscription, all answering a question that has already been answered. This
   * component reads `useReduceMotion` nowhere else since Story 2-29 moved the entrance into CSS:
   * the preference reaches the hero through this hook and through the contract's own duration
   * collapse, and nothing here branches on it in render output.
   */
  const path = useNarrativePath(servedPath);
  const flat = path === 'flat';

  return (
    <div className={flat ? 'home-container home-container--flat' : 'home-container'}>
      {/* FR-2's one interaction, and only on the path that costs one. The flat path reaches the
          Directory by scrolling and no control at all, which is the diagram's zero interactions
          (`EXPERIENCE.md:154-169`). First inside the container, so a keyboard reader meets it
          immediately after the A-6 link rather than after the whole hero, and outside every
          `.home-panel`, so the two-and-a-bit-second entrance leaves it alone: the panels carry
          their own `home-enter` keyframe and this control carries none, which is the whole of why
          it sits outside them now that the dim-siblings rule it also dodged has been retired.

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
          {/* Ornament, painted from `data-ornament` by `HomeLayout.scss` rather than set as text,
              so the contrast audit does not score what no reader needs (DW-113). Same for the
              two below. */}
          <span className='home-role__jp' aria-hidden='true' data-ornament='フロントエンドエンジニア' />
        </p>
      </div>

      {/* Not rendered at all on the flat path, rather than rendered empty: below 768 this box is
          `90vw` tall in flow, and an empty one is a hole in the middle of a hero whose whole point
          is that no 3D asset was requested.

          **Its arrival cannot be mistimed, because nothing schedules anything against it.** Since
          Story 2-29 the reveal is a `home-enter` keyframe on this element's own rule rather than a
          tween positioned on a timeline that ran once at mount, so the box is revealed whenever it
          is styled, not only if it was in the DOM at hydration. The hook's decision is terminal in
          any case, so `flat` is a one-way door and this element only ever goes away.

          `aria-hidden` here is A-14's first clause at the wrapper: the canvas is decorative, and
          `Scene.tsx:40` already sets `aria-hidden` on the `<Canvas>` while `:49-50` sets it and
          `tabIndex = -1` on `gl.domElement` inside `onCreated` (Story 2-13), so the subtree is out
          of the accessibility tree and out of the tab order from two directions. **Corrected
          2026-09-21**: this named `GemComponent`, which sets neither; it renders `GemNarrative`,
          which renders `Scene`, and `Scene` is where both live. DW-46's closure says the same. `ScanlineOverlay` is the last child and inside this box on purpose:
          the box is positioned at the base level and is therefore a stacking context, so the
          scrim's own raised level is confined to it and the panels above clear the whole subtree.
          The scrim is `aria-hidden` itself and carries no content, so putting it inside a hidden
          subtree takes nothing away. */}
      {!flat && (
        <div className='home-gem' aria-hidden='true'>
          <GemComponent path={path} />
          <ScanlineOverlay />
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
            The link's geometry is untouched. Its `home-nav` row in the AD-19 ledger was Story
            2-32's until Story 2-29 took both hero link groups past the hit-target floor and deleted
            the row; see `HomeLayout.scss`'s navigation block. */}
        <Link href='/#suite' className='nav-link'>
          Suite Directory
        </Link>
        <span className='home-nav-jp' aria-hidden='true' data-ornament='ナビゲーション' />
      </nav>

      <div className='home-panel home-panel--contact'>
        <ContactContainer />
        <span className='home-contact-jp' aria-hidden='true' data-ornament='接続' />
      </div>

      {/* The Directory's reach event, rendered here because it carries this page's one decision, the
          front door, which the server-rendered Directory cannot see (Operator ruling 2026-09-24,
          DW-88). It renders nothing and observes the heading `/#suite` names. */}
      <SuiteReach target='suite' door={path} />
    </div>
  );
};

export default HomeLayout;
