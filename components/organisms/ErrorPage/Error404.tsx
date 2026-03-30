'use client';

import Link from 'next/link';
import { HudLabel } from '@/components/atoms/HudLabel/HudLabel';
import ScanlineOverlay from '@/components/atoms/ScanlineOverlay/ScanlineOverlay';
import { useGsapContext } from '@/hooks/useGsapContext';
import { gsap } from 'gsap';
import './error-page.scss';

const NotFound = () => {
  const ref = useGsapContext<HTMLDivElement>(() => {
    gsap.from('.error-page__code', {
      opacity: 0,
      y: 20,
      duration: 0.6,
      ease: 'power3.out',
      delay: 0.1,
    });
    gsap.from('.error-page__message', {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      delay: 0.3,
    });
    gsap.from('.error-page__back', {
      opacity: 0,
      y: 10,
      duration: 0.4,
      ease: 'power2.out',
      delay: 0.5,
    });
  }, []);

  return (
    <div className='error-page' ref={ref}>
      <ScanlineOverlay />

      <div className='error-page__content'>
        <HudLabel label='// ERR_NOT_FOUND' sub='// SIGNAL_LOST' />

        <p className='error-page__code' aria-label='Error 404'>
          404
        </p>

        <div className='error-page__message'>
          <p className='error-page__title'>Page not found.</p>
          <p className='error-page__sub'>The page you're looking for does not exist.</p>
        </div>

        <Link href='/' className='error-page__back'>
          ← Go home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
