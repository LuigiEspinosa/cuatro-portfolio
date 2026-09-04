'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapContext } from '@/hooks/useGsapContext';
import HudLabel from '@/components/atoms/HudLabel/HudLabel';
import { TorusKnotCanvas } from '@/components/molecules/TorusKnotCanvas/TorusKnotCanvas';
import ScanlineOverlay from '@/components/atoms/ScanlineOverlay/ScanlineOverlay';
import './ProjectsHero.scss';

gsap.registerPlugin(ScrollTrigger);

/**
 * `count` is a prop rather than a read of the Registry, because this is a client component: a
 * module-scope import here would ship all fourteen entries to the browser to render one number.
 * The page that renders the cards already holds the list (Story 2.7).
 */
interface ProjectsHeroProps {
  count: number;
}

export function ProjectsHero({ count }: ProjectsHeroProps) {
  const scrollRef = useRef({ value: 0 });

  const heroRef = useGsapContext<HTMLElement>(() => {
    gsap.from('.projects-hero__heading', {
      x: -40,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      delay: 0.1,
    });
    gsap.from('.projects-hero__meta', {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      delay: 0.4,
    });

    gsap.to(scrollRef.current, {
      value: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: heroRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.5,
      },
    });
  }, []);

  return (
    <section className='projects-hero' ref={heroRef}>
      <ScanlineOverlay intensity='light' />

      <div className='projects-hero__text'>
        <HudLabel label='// PROJECTS' sub='プロジェクト' />
        <h1 className='projects-hero__heading'>
          Personal and Open
          <br />
          Source Work
        </h1>
        <p className='projects-hero__meta'>
          {count}&nbsp;PROJECTS&nbsp;&nbsp;//&nbsp;&nbsp;ONGOING
        </p>
      </div>

      <div className='projects-hero__canvas-wrap'>
        <TorusKnotCanvas scrollRef={scrollRef} />
      </div>
    </section>
  );
}
