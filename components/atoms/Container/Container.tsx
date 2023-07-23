'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import './container.scss';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export const Body = ({ children }: ContainerProps) => {
  const pathname = usePathname();
  const route = pathname.substring(1).replaceAll('/', '-');
  return <body id={route}>{children}</body>;
};

export const Container = ({ className, children }: ContainerProps) => (
  <section className={`container ${className || ''}`}>{children}</section>
);
