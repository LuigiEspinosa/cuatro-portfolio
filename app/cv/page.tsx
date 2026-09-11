import type { Metadata } from 'next';
import { Container } from '@/components/atoms/Container/Container';
import { CvIntro } from '@/components/organisms/CvIntro/CvIntro';
import { WorkTimeline } from '@/components/organisms/WorkTimeline/WorkTimeLine';

/**
 * `/cv`, built around the timeline `/work` already mounts (Story 2-16).
 *
 * **This file existed and never rendered.** `next.config.js` answered `/cv` with a 308 to
 * `/pdf/cv.pdf`, which shadows a route file rather than replacing it, so the one-line stub that
 * stood here was compiled, prerendered and unreachable. Removing the redirect is what makes this
 * the document a visitor gets, and it is why `CV` in the header now marks itself as the current
 * page: `Navbar.tsx:56` has compared against this route since Story 2-15 with nothing to match.
 *
 * **`WorkTimeline` is mounted, not touched.** This is the identical component `app/work/page.tsx:21`
 * mounts, with no props, and `/work` goes on rendering it standalone. Story 2-33 restyles it and is
 * required not to alter its structure, props or behaviour, so a prop added here would be work that
 * story is forbidden to undo. **One mount per document**: `WorkItem.tsx:100,117` builds each panel id
 * as `${entry.id}-content`, so a second timeline in one page would duplicate all four ids and break
 * `aria-controls` on both.
 *
 * **The title is `CV` and not the whole string.** `app/layout.tsx:15-18` applies a
 * `'%s | Luigi Espinosa'` template, so the stub's `'CV | Luigi Espinosa - Frontend Developer'` would
 * have rendered as `CV | Luigi Espinosa - Frontend Developer | Luigi Espinosa` the first time this
 * page was ever served. `app/work/page.tsx:6-15` is the shape copied here, relative `openGraph.url`
 * included.
 */
export const metadata: Metadata = {
  title: 'CV',
  description: 'Curriculum vitae: work history, roles and the technologies each one used.',
  openGraph: {
    title: 'CV | Luigi Espinosa',
    description: 'Curriculum vitae: work history, roles and the technologies each one used.',
    // Relative, so `metadataBase` in `app/layout.tsx` resolves it against the one declared origin.
    url: '/cv',
  },
};

export default function CvPage() {
  return (
    // **A `<main>`, which `/work` does not have.** Story 2-15 made the header sticky at 140px and
    // this surface renders no skip link, so without a landmark there is no way past the chrome for
    // assistive technology. Adding one here is a single element on a page being written from
    // scratch; adding it to `/work`, `/celeste` and the 404 is a chrome change and belongs to Story
    // 2-32, so that half is filed rather than done.
    <main>
      <Container>
        <CvIntro />
        <WorkTimeline />
      </Container>
    </main>
  );
}
