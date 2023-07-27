'use client';

import { useEffect, useState } from 'react';
import { gsap, Expo } from 'gsap';
import './intro.scss';

export default function Intro() {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const storage = sessionStorage.getItem('typoAnimation');

    if (storage !== 'true') {
      gsap.to('.text-wrapper > div', {
        duration: 1,
        x: '500',
        ease: Expo.easeInOut,
        delay: 1,
        stagger: 0.1,
      });

      gsap.to('.text-wrapper', {
        duration: 3,
        y: -600,
        scale: 4.5,
        rotate: -90,
        ease: Expo.easeInOut,
        delay: 1.5,
      });

      gsap.to('.text', {
        duration: 1,
        opacity: 1,
        ease: Expo.easeInOut,
        delay: 3,
      });

      gsap.to('.text-wrapper > div', {
        duration: 4,
        x: '-3500',
        ease: Expo.easeInOut,
        delay: 3.5,
        stagger: 0.05,
      });

      gsap.to('.text-container', {
        duration: 2,
        bottom: '-100%',
        ease: Expo.easeInOut,
        delay: 6,
      });

      gsap.to('.text-wrapper', {
        duration: 6,
        delay: 1,
        display: 'none',
        onComplete: () => {
          sessionStorage.setItem('typoAnimation', 'true');
        },
      });
    } else {
      setHide(true);
    }
  }, []);

  return !hide ? (
    <div className='intro-container'>
      <div className='text-container' />

      <div className='text-wrapper'>
        {Array.from({ length: 20 }, (_, idx) => (
          <div className='text' key={idx}>
            Coming Soon! Numero Cuatro. Frontend Developer. Coming Soon! Numero Cuatro. Frontend
            Developer.
          </div>
        ))}
      </div>
    </div>
  ) : null;
}
