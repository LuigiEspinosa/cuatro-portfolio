'use client';

import { useLayoutEffect, useRef } from 'react';
import { Expo, gsap } from 'gsap';
import './error-page.scss';
import Link from 'next/link';

const NotFound = () => {
  const errorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to('.header > span', {
        duration: 1.5,
        top: '120vh',
        ease: 'back.out',
        delay: 1,
        stagger: {
          amount: 0.2,
        },
      });

      gsap.to('.footer span', {
        duration: 0.4,
        y: -40,
        ease: Expo.easeInOut,
        delay: 2.4,
      });
    }, errorRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className='error-container' ref={errorRef}>
      <div className='header-container'>
        <header className='header'>
          <span>4</span>
          <span>0</span>
          <span>4</span>
        </header>
      </div>

      <footer className='footer'>
        <span>
          Where you going ⊙﹏⊙∥? Come back <Link href='/'>Home</Link>
        </span>
        <div className='footer-wrapper' />
      </footer>
    </div>
  );
};

export default NotFound;
