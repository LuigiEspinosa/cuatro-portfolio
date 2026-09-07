'use client';

import { gsap } from 'gsap';
import Link from 'next/link';
import GemComponent from '@/components/molecules/GemComponent/GemComponent';
import ContactContainer from '@/components/molecules/ContactContainer/ContactContainer';
import GlitchText from '@/components/molecules/GlitchText/GlitchText';
import HudLabel from '@/components/atoms/HudLabel/HudLabel';
import { useGsapContext } from '@/hooks/useGsapContext';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import './HomeLayout.scss';

const HomeLayout = () => {
  const reduceMotion = useReduceMotion();

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
    <div className='home-container' ref={containerRef}>
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

      <div className='home-gem'>
        <GemComponent />
      </div>

      <nav className='home-panel home-panel--nav' aria-label='Main navigation'>
        <Link href='/work' className='nav-link'>
          Professional Experience
        </Link>
        <Link href='/projects' className='nav-link'>
          Personal Projects
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
