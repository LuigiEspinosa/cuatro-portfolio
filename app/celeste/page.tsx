import { Metadata } from 'next';
import CelesteComponent from '@/components/organisms/Celeste/Celeste';

// `robots: { index: false }` (Story 2-17). This route is reachable from the footer alone and
// carries no chrome, no exit and nothing about the estate, so it is kept out of search results
// rather than left to be indexed as a page of the portfolio. It is the one routed page that
// declares a `robots` directive: `/`, `/work` and `/cv` declare none. The 404 carries a `noindex`
// too, and that one is Next's own, injected by its not-found boundary rather than declared in
// `app/not-found.tsx` (DW-78). There is no `robots.txt` and no sitemap.
export const metadata: Metadata = {
  title: 'I Love U <3',
  robots: { index: false },
};

// A landmark like every route's (Operator ruling 2026-09-24, DW-43), though nothing here reaches it:
// the header, and the skip link its first child, are hidden on this surface.
export default function Celeste() {
  return (
    <main id='main' tabIndex={-1}>
      <CelesteComponent />
    </main>
  );
}
