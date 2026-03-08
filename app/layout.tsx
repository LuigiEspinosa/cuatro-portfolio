import { ReactNode } from 'react';
import type { Metadata } from 'next';
import './app.scss';

import { Header } from '@/components/molecules/Header/Header';
import { Body } from '@/components/atoms/Container/Container';
import { Providers } from '@/app/providers';

export const metadata: Metadata = {
  title: 'Luigi Espinosa | Senior Frontend Engineer',
  description: "Cuatro's Portfolio",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <Body>
        <Providers>
          <Header />
          {children}
        </Providers>
      </Body>
    </html>
  );
}
