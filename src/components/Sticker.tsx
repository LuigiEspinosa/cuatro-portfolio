'use client';

import { useEffect } from 'react';

export default function Sticker() {
  useEffect(() => {
    const parallax = (e: { pageX: number; pageY: number }) => {
      Array.from(
        document.querySelectorAll('.layer') as unknown as HTMLCollectionOf<HTMLElement>
      ).forEach((layer) => {
        const speed = layer.getAttribute('data-speed') as unknown as number;
        const x = (window.innerWidth - e.pageX * speed) / 150;
        const y = (window.innerHeight - e.pageY * speed) / 150;

        layer.style.transform = `translateX(${x}px) translateY(${y}px)`;
      });
    };

    document.addEventListener('mousemove', parallax);
  }, []);

  return (
    <section className='stickers'>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src='/stickers/sticker-1.png'
        width={500}
        height={500}
        data-speed='-10'
        className='layer img-1'
        alt=''
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src='/stickers/sticker-2.png'
        width={500}
        height={500}
        data-speed='8'
        className='layer img-2'
        alt=''
      />
    </section>
  );
}
