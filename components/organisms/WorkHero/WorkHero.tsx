'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapContext } from '@/hooks/useGsapContext';
import { HudLabel } from '@/components/atoms/HudLabel/HudLabel';
import { TorusCanvas } from '@/components/molecules/TorusCanvas/TorusCanvas';
import ScanlineOverlay from '@/components/atoms/ScanlineOverlay/ScanlineOverlay';
import { work } from '@/content/work';
import './WorkHero.scss';

gsap.registerPlugin(ScrollTrigger);

const POSITION_COUNT = work.length;
const EARLIEST_YEAR = '2017';

export function WorkHero() {
  // scrollRef is the bridge: GSAP writes, R3F useFrame reads.
  // It is a plain object so mutations do not trigger re-renders.
  const scrollRef = useRef<{ value: number }>({ value: 0 });

  const heroRef = useGsapContext<HTMLDivElement>(() => {
    gsap.from('.work-hero__heading', {
      x: -40,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      delay: 0.1,
    });
    gsap.from('.work-hero__meta', {
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
    <section className='work-hero' ref={heroRef}>
      <ScanlineOverlay intensity='light' />

      <div className='work-hero__text'>
        <HudLabel label='// EXPERIENCE' sub='経験' />
        <h1 className='work-hero__heading'>
          Frontend Developer
          <br />
          and Team Lead
        </h1>
        <p className='work-hero__meta'>
          {POSITION_COUNT}&nbsp;POSITIONS&nbsp;&nbsp;//&nbsp;&nbsp;{EARLIEST_YEAR} - PRESENT
        </p>
      </div>

      <div className='work-hero__canvas-wrap'>
        <TorusCanvas scrollRef={scrollRef} />
      </div>
    </section>
  );
}
