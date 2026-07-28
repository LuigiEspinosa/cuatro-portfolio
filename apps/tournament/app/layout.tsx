import type { ReactNode } from 'react';
import { Archivo } from 'next/font/google';
import './globals.css';

/*
 * Root layout. Establishes the viewer foundation Story 5.6 introduces:
 *  - the global design-token stylesheet (app/globals.css), imported once here;
 *  - the Archivo display font, self-hosted by next/font (NOT hotlinked — the mock's
 *    Google Fonts <link> is mock-only). Exposed as the `--font-archivo` CSS variable
 *    that globals.css folds into `--font-display`.
 * The body palette is now driven by the tokens (var(--page)/var(--tp)) rather than the
 * old inline `#0e1015`/`#e8e8ea`, reconciled to the canonical dark tokens (AC1/AC10).
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata = {
  title: 'InclusivCup',
  description: 'Torneo CS2 — InclusivCup',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
