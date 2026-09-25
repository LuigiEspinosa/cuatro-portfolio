import type { Metadata } from 'next';
import Error404 from '@/components/organisms/ErrorPage/Error404';

// No `openGraph` block (Story 2-17). The one this carried pinned `openGraph.title` to
// `Projects | Luigi Espinosa`, a page that has not existed since Story 2-14, so every unrouted
// path shared as a link previewed under another route's name. Next resolves `openGraph.title` from
// `title` when none is declared, and the layout template supplies the rest.
export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page does not exist.',
};

// The skip-link's target, as on every route (Operator ruling 2026-09-24, DW-43).
export default function NotFound() {
  return (
    <main id='main' tabIndex={-1}>
      <Error404 />
    </main>
  );
}
