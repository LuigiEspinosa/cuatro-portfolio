import type { ReactNode } from 'react';

export const metadata = {
  title: 'InclusivCup',
  description: 'Torneo CS2 — InclusivCup',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#0e1015',
          color: '#e8e8ea',
        }}
      >
        {children}
      </body>
    </html>
  );
}
