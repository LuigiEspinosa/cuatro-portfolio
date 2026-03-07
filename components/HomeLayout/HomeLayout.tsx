'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import Link from 'next/link';
import './HomeLayout.scss';

import GemComponent from '@/components/GemComponent/GemComponent';
import ContactContainer from '@/components/ContactContainer/ContactContainer';

const HomeLayout = () => {
  const homeRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to('.row-1, .row-2', {
        duration: 1,
        top: 0,
        ease: 'power4.out',
        delay: 1,
        stagger: {
          amount: 0.5,
        },
      });

      gsap.to('.brand-name', {
        duration: 1,
        left: 0,
        ease: 'power4.out',
        delay: 2.5,
        stagger: {
          amount: 0.5,
        },
      });

      gsap.from('.lets-talk p', {
        duration: 0.1,
        opacity: 0,
        ease: 'power4.out',
        delay: 2,
      });

      gsap.to('.box', {
        duration: 1,
        top: '100%',
        ease: 'power4.out',
        delay: 2,
      });

      gsap.to('p, a', {
        duration: 1,
        top: 0,
        ease: 'power4.out',
        delay: 2,
      });

      gsap.from('.h-stripe', {
        duration: 1,
        top: '500%',
        ease: 'power4.out',
        delay: 4,
      });

      gsap.from('.h-stripe span', {
        duration: 1,
        top: '300px',
        ease: 'power4.out',
        delay: 4,
      });

      gsap.from('.line', {
        duration: 1,
        scaleX: 0,
        ease: 'power4.out',
        delay: 3.5,
      });
    }, homeRef);

    const ctx2 = gsap.context(() => {
      gsap.to(marqueeRef?.current, {
        duration: 1,
        bottom: '0.5%',
        ease: 'power4.out',
        delay: 3,
      });
    }, marqueeRef);

    return () => {
      ctx.revert();
      ctx2.revert();
    };
  }, []);

  return (
    <>
      <div className='home-container' ref={homeRef}>
        <div className='row row-1 border-bottom'>
          <div className='brand-name border-right'>
            <header className='header flex-center'>
              <h1>Luigi Espinosa</h1>
            </header>
          </div>

          <div className='brand-contact flex-center'>
            <ContactContainer />
          </div>
        </div>

        <div className='row row-2 border-bottom'>
          <div className='hero-copy border-right'>
            <div className='i-row i-row1'>
              <div className='col projects'>
                <div className='project-list'>
                  <Link href='https://tracker.cuatro.dev' target='_blank'>
                    Cuatro&apos;s Tracker
                  </Link>
                  {/* <Link href='https://github.com/LuigiEspinosa/web-clones' target='_blank'>
                    Website Clones
                  </Link> */}
                  {/* <Link href='https://github.com/LuigiEspinosa/connect-four-react' target='_blank'>
                    Find Four
                  </Link> */}
                  <Link href='https://covidmap.cuatro.dev/' target='_blank'>
                    Covid-19 Map
                  </Link>
                  {/* <Link href='/' target='_blank'>
                    Other Work Related Projects
                  </Link> */}
                </div>
                <div className='h-stripe'>
                  <span>personal_projects</span>
                </div>
              </div>

              <div className='col circle-text flex-center'>
                <div className='text'>
                  <svg viewBox='0 0 100 100' width='200' height='200'>
                    <defs>
                      <path
                        id='circle'
                        d='M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0'
                      />
                    </defs>
                    <text fontSize='14'>
                      <textPath xlinkHref='#circle'>
                        contact me contact me contact me contact me
                      </textPath>
                    </text>
                  </svg>
                </div>
              </div>
            </div>

            <div className='i-row i-row2'>
              <div className='col lets-talk flex-center'>
                <p>
                  Work experience? &#x27A1;{' '}
                  <Link href='/cv' target='_blank'>
                    CV
                  </Link>
                </p>
              </div>
              <div className='col stripe'>
                <div className='line' />
              </div>
            </div>
          </div>

          <div className='hero-img'>
            <div className='img-container border-right'>
              <div className='box' />
              <GemComponent />
            </div>
          </div>
        </div>
      </div>

      <div className='marquee' ref={marqueeRef}>
        <span>
          &nbsp; I&apos;m Luigi Espinosa &nbsp; / &nbsp; Frontend Developer &nbsp; / &nbsp; Team
          Lead &nbsp; / &nbsp; Fullstack Developer
        </span>
      </div>
    </>
  );
};

export default HomeLayout;
