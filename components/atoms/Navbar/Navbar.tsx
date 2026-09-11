import Link from 'next/link';
import './navbar.scss';

/**
 * The header's two destinations (Story 2-15).
 *
 * **Two, in this order, and nothing else.** `EXPERIENCE.md:285` fixes the labels and
 * `EXPERIENCE.md:115-123` fixes the placement, which is what closing PRD Q8 means: `Suite` is the
 * payload SM-1 measures reaching, `CV` is the one likely next click after an opinion has formed,
 * and every further link competes with both. The five inline links plus a `mailto:` this replaced,
 * six anchors in all, were precisely the AI-nav tell `EXPERIENCE.md:126` names. `/work` survives
 * as a route and is
 * deliberately not here (`EXPERIENCE.md:96`); Story 2-16 absorbed it as a section inside `/cv` on
 * 2026-09-10, mounting the same `WorkTimeline` there and leaving `/work` rendering standalone.
 *
 * **Prominence is an IA fact rather than a visual one.** No document gives the primary and the
 * secondary destination different treatments in the header, so both take one treatment and the
 * accent underline is reserved for the current route.
 *
 * **`CV` names the route, not the PDF, and that decision is what made this file cost nothing on
 * 2026-09-10.** `/cv` answered a 308 to `/pdf/cv.pdf` when this component was written, so the label
 * pointed at a redirect; Story 2-16 removed it and built the page, and not one line here moved.
 * Pointing the label at the PDF instead would have been a link that worked and then had to be moved
 * back, and the header would have named a file rather than the route the design assigns
 * (`EXPERIENCE.md:95`). The `aria-current` comparison below has had a surface to match since that
 * story landed, which is what closes DW-64: the prefetch now warms a route bundle rather than a
 * redirect.
 *
 * **The logo is not one of the two.** It is a sibling of this element in `Header.tsx:14`, not a
 * nav link, so "exactly two destinations" is two `nav.navbar a` while `<header>` still holds three
 * anchors. It is also still under the hit-target floor, which is `chrome-logo` in
 * `ops/hit-target-floor.md` and Story 2-32's to close.
 *
 * **The pathname arrives as a prop rather than from a second `usePathname()`.** `Header.tsx:10` is
 * already the client boundary and already reads it to decide whether to render at all, so reading
 * it again here would be a second subscription answering a question that has been answered, and it
 * would make this file a client component for one attribute. Same shape as `HomeLayout` handing
 * `GemComponent` the decided path rather than letting it re-derive one.
 */

/** One header destination: where it goes, what it says, and the route on which it is current. */
interface Destination {
  /** The `href`, fragment included. */
  readonly href: string;
  /** The label, fixed at `EXPERIENCE.md:285`. */
  readonly label: string;
  /**
   * The pathname this destination *is*, which is what `aria-current` is decided against.
   *
   * Separate from `href` on purpose: a fragment is never part of a pathname, so comparing the
   * whole `href` would leave `Suite` permanently not-current and would start marking it the day
   * someone dropped the fragment.
   */
  readonly route: string;
}

const DESTINATIONS: readonly Destination[] = [
  { href: '/#suite', label: 'Suite', route: '/' },
  { href: '/cv', label: 'CV', route: '/cv' },
];

interface NavbarProps {
  /** The current pathname, from `Header`'s own `usePathname()`. */
  readonly pathname: string;
}

export const Navbar = ({ pathname }: NavbarProps) => (
  <nav className='navbar'>
    {DESTINATIONS.map((destination) => (
      <Link
        key={destination.href}
        href={destination.href}
        aria-current={pathname === destination.route ? 'page' : undefined}
      >
        {/* The label is wrapped because the current-route rule is drawn on this span rather than on
            the hit-target box (`RESTYLE-SPEC.md:198-199`): a border on the box floats away from the
            text by the height of the padding that gets the box to the floor. The token that sets
            that floor is deliberately not named here, and neither is any other contract role: this
            file is source rather than a stylesheet, so `app/__tests__/anchor-contract.test.ts`
            reads a role named in a comment as a component reaching past the alias layer. The names
            live in `navbar.scss`, which is listed there as token-native. */}
        <span className='navbar__label'>{destination.label}</span>
      </Link>
    ))}
  </nav>
);
