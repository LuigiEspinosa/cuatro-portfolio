'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGsapContext } from '@/hooks/useGsapContext';
import { TorusKnotCanvas } from '@/components/molecules/TorusKnotCanvas/TorusKnotCanvas';
import './ProjectsHero.scss';

gsap.registerPlugin(ScrollTrigger);

export function ProjectsHero() {
  const scrollRef = useRef({ value: 0 });

  const heroRef = useGsapContext<HTMLElement>(() => {
    gsap.from('.project-hero__label h1', {
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
    <section className='project-hero' ref={heroRef} aria-hidden='true'>
      <div className='project-hero__label'>
        <h1>Personal Projects</h1>
        <TorusKnotCanvas scrollRef={scrollRef} className='project-hero__canvas' />
      </div>
    </section>
  );
}
