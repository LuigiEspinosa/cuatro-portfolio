'use client';

import { gsap } from 'gsap';
import Link from 'next/link';
import GemComponent from '@/components/molecules/GemComponent/GemComponent';
import ContactContainer from '@/components/molecules/ContactContainer/ContactContainer';
import GlitchText from '@/components/molecules/GlitchText/GlitchText';
import { HudLabel } from '@/components/atoms/HudLabel/HudLabel';
import { useGsapContext } from '@/hooks/useGsapContext';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import './HomeLayout.scss';

const HomeLayout = () => {
  const reduceMotion = useReduceMotion();

  const containerRef = useGsapContext<HTMLDivElement>(() => {
    const finalState = ['.home-panel--sys', '.home-role', '.nav-link', '.contact-container a'];

    if (reduceMotion) {
      gsap.set(finalState, { opacity: 1, y: 0 });
      gsap.set('.home-gem', { filter: 'brightness(1)' });
      return;
    }

    const tl = gsap.timeline();

    tl.to('.home-gem', { filter: 'brightness(1.4)', duration: 0.4, ease: 'power2.out' }, 0.5);
    tl.to('.home-gem', { filter: 'brightness(1)', duration: 0.4, ease: 'power2.in' }, 0.9);

    tl.to('.home-role', { opacity: 1, duration: 0.5, repeat: 4, yoyo: true }, 1.3);

    tl.to('.home-panel--sys', { opacity: 1, duration: 0.4, ease: 'power2.out' }, 1.6);

    tl.to('.nav-link', { opacity: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' }, 2.0);

    tl.to(
      '.contact-container a',
      { opacity: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' },
      2.2
    );
  }, [useReduceMotion]);

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
