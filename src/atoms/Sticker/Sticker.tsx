'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import './sticker.scss';

export const Sticker = () => {
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
    <div className='stickers'>
      <Image
        src={`${process.env.NEXT_PUBLIC_FIREBASE_DOMAIN}/stickers/sticker-1.png`}
        width={500}
        height={500}
        data-speed='-10'
        className='layer img-1'
        alt=''
      />

      <Image
        src={`${process.env.NEXT_PUBLIC_FIREBASE_DOMAIN}/stickers/sticker-2.png`}
        width={500}
        height={500}
        data-speed='8'
        className='layer img-2'
        alt=''
      />
    </div>
  );
};
