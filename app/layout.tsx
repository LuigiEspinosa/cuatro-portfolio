import { Analytics } from '@vercel/analytics/react';
import { Metadata } from 'next';
import './app.scss';

import { Body } from '@/components/atoms/Container/Container';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Frontend web developer',
  description: "Número Cuatro's Portfolio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <Body>
        {children}
        <Analytics />
      </Body>
    </html>
  );
}
