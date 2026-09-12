import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import './app.scss';

import { Header } from '@/components/molecules/Header/Header';
import { Body } from '@/components/atoms/Container/Container';
import { Providers } from '@/app/providers';
import { HUB_ORIGIN } from '@/lib/registry';

export const metadata: Metadata = {
  // The one declaration of where the Hub is served from, shared with the Suite Directory's
  // `You are here` rule so the site cannot declare one origin and compare against another.
  metadataBase: new URL(HUB_ORIGIN),
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

          {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && process.env.NEXT_PUBLIC_UMAMI_URL && (
            <Script
              src={`${process.env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
              data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
              strategy='afterInteractive'
            />
          )}
        </Providers>
      </Body>
    </html>
  );
}
