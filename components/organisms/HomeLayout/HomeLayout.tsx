'use client';

import { useEffect } from 'react';
import { Linear, gsap } from 'gsap';
import './HomeLayout.scss';

const HomeLayout = () => {
  useEffect(() => {
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

    gsap.from('.text', {
      duration: 2,
      scale: 0,
      ease: 'power4.out',
      delay: 2,
    });

    gsap.from('.text', {
      duration: 20,
      rotation: 360,
      ease: Linear.easeNone,
      repeat: -1,
    });

    gsap.to('.box', {
      duration: 1,
      top: '100%',
      ease: 'power4.out',
      delay: 2,
    });

    gsap.to('h1, p', {
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

    gsap.to('.marquee', {
      duration: 1,
      bottom: '1%',
      ease: 'power4.out',
      delay: 3,
    });
  }, []);

  return (
    <>
      <div className='home-container'>
        <div className='row row-1 border-bottom'>
          <div className='brand-name flex-center border-right'>
            <header className='header'>
              <h1>Numero Cuatro</h1>
            </header>
          </div>

          <div className='brand-contact flex-center'>
            <div className='contact-container'>
              <p>Github</p>
              <p>LinkedIn</p>
              <p>Email</p>
            </div>
          </div>
        </div>

        <div className='row row-2 border-bottom'>
          <div className='hero-copy border-right'>
            <div className='i-row i-row1'>
              <div className='col projects'>
                <div className='project-list'>
                  <p>CovidMap</p>
                  <p>My Own Tracker</p>
                  <p>Find Four</p>
                  <p>Website Clones</p>
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

                <div className='contact-container'>
                  <p>Github</p>
                  <p>LinkedIn</p>
                  <p>Email</p>
                </div>
              </div>
            </div>

            <div className='i-row i-row2'>
              <div className='col lets-talk flex-center'>
                <p>
                  Work experience? &#x27A1; <span>Blog</span>
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
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src='/home/hero.jpg' alt='' className='image' />
              </div>
            </div>

            <div className='empty-rows'>
              <div className='white-space border-bottom' />
              <div className='white-space' />
            </div>
          </div>
        </div>
      </div>

      <div className='marquee'>
        <span>
          &nbsp; Frontend Developer &nbsp; / &nbsp; Team Lead &nbsp; / &nbsp; Fullstack Developer
          &nbsp; / &nbsp; I&apos;m Luigi Espinosa :) &nbsp;
        </span>
      </div>
    </>
  );
};

export default HomeLayout;
