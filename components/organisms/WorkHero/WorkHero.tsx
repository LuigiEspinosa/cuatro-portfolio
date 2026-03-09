'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapContext } from '@/hooks/useGsapContext';
import { TorusCanvas } from '@/components/molecules/TorusCanvas/TorusCanvas';
import './WorkHero.scss';

gsap.registerPlugin(ScrollTrigger);

export function WorkHero() {
  // scrollRef is the bridge: GSAP writes, R3F useFrame reads.
  // It is a plain object so mutations do not trigger re-renders.
  const scrollRef = useRef<{ value: number }>({ value: 0 });

  const heroRef = useGsapContext<HTMLDivElement>(() => {
    gsap.from('.work-hero__label h1', {
      x: -60,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      delay: 0.2,
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
    <section className='work-hero' ref={heroRef} aria-hidden='true'>
      <div className='work-hero__label'>
        <h1>Professional Experience</h1>
        <TorusCanvas scrollRef={scrollRef} className='work-hero__canvas' />
      </div>
    </section>
  );
}
