import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import './app.scss';

import { Header } from '@/components/molecules/Header/Header';
import { Body } from '@/components/atoms/Container/Container';
import { Providers } from '@/app/providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://cuatro.dev'),
  title: {
    template: '%s | Luigi Espinosa',
    default: 'Luigi Espinosa | Senior Frontend Engineer',
  },
  description:
    'Senior Frontend Engineer and Team Lead specialising in interactive web experiences and Automatization Tools.',
  openGraph: {
    siteName: 'Luigi Espinosa',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/assets/og/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Luigi Espinosa - Senior Frontend Engineer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <Body>
        <Providers>
          <Header />
          {children}
        </Providers>
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={`${process.env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy='afterInteractive'
          />
        )}
      </Body>
    </html>
  );
}
