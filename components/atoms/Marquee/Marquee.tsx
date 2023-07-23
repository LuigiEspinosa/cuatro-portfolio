import { FC } from 'react';
import './marquee.scss';

interface MarqueeProps {
  label: string;
}

export const Marquee: FC<MarqueeProps> = ({ label }) => (
  <div className='marquee'>
    <span>{label}</span>
  </div>
);
