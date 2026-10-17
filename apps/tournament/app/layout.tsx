import type { ReactNode } from 'react';
import './globals.css';

/*
 * Root layout. Imports the global stylesheet once: the Cuatro token contract (tokens, then the three
 * self-hosted faces in `contracts/fonts.css`) and the restyle's hand-fix lines (Story 8.6). The faces
 * come from the contract, so the build fetches no font host and no `next/font` face is declared.
 */
export const metadata = {
  title: 'InclusivCup',
  description: 'Torneo CS2 — InclusivCup',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
