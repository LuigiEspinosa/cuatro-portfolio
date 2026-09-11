import { render, screen } from '@testing-library/react';
import { SiteFooter } from '../SiteFooter';
import { SuiteDirectoryRow } from '@/components/organisms/SuiteDirectory/SuiteDirectory';
import { ESTATE_LANGUAGES, renderedApplications, type RegistryEntry } from '@/lib/registry';
import { capitalise, pluralise, spellOut } from '@/lib/words';

/**
 * The footer line against the published Registry (Story 2-11), and the one link beside it
 * (Story 2-17).
 *
 * **The Registry is not mocked**, for the reason the Directory's own suite gives: the footer is a
 * server component with no state, so it renders in jsdom as it renders in production, and a mocked
 * Registry would prove nothing about the wiring that ships. `next/link` is mocked the way
 * `components/atoms/Navbar/__tests__/Navbar.test.tsx` mocks it, so the anchor is real markup
 * rendered outside the App Router rather than a router context assembled for one `href`.
 *
 * `EXPERIENCE.md:295` writes this line and adds that it is updated when the count changes or
 * deleted. Both figures are lengths here, so neither can go stale, which is what let the line exist
 * rather than be deleted. That the word follows the length is proved over fixtures in
 * `lib/__tests__/registry.test.ts`; what is proved here is that the line the footer renders is that
 * composition and not a second copy of it.
 *
 * **Until 2026-09-11 the first block below asserted emptiness four ways**: no `<nav>`, no link, no
 * interactive element, one child. Story 2-17 gave the footer its one link, so those cases are
 * rewritten rather than patched: one `<nav>`, one link, to `/celeste`, and nothing else interactive.
 *
 * jsdom applies no stylesheets, so the mono treatment, the hairline above the line,
 * `tabular-nums` and the link's box at the floor belong to `tests/e2e/premise.pw.ts` and
 * `tests/e2e/secondary-surfaces.pw.ts`.
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const line = (container: HTMLElement): string => container.querySelector('.site-footer__line')?.textContent ?? '';

/** Everything the hit-target sweep would count, in the shape `Premise.test.tsx:183` uses. */
const INTERACTIVE = 'a, button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';

describe('the footer ships one line and one link', () => {
  it('is a footer holding the line and then a navigation landmark, and nothing else', () => {
    const { container } = render(<SiteFooter />);
    const footer = container.querySelector('footer');
    expect(footer, 'nothing renders a footer element').not.toBeNull();
    expect([...(footer?.children ?? [])].map((child) => child.tagName), 'the footer holds something else').toEqual([
      'P',
      'NAV',
    ]);
  });

  it('carries exactly one navigation landmark, labelled apart from the header', () => {
    // `aria-label='Footer'` is what tells this landmark from `nav.navbar` for assistive tech. A
    // second `<nav>` here, or one without a label, would be two unnamed navigation regions on `/`.
    const { container } = render(<SiteFooter />);
    const navs = container.querySelectorAll('nav');
    expect(navs, 'the footer does not render exactly one nav').toHaveLength(1);
    expect(navs[0].getAttribute('aria-label')).toBe('Footer');
    expect(screen.getByRole('navigation', { name: 'Footer' })).toBe(navs[0]);
  });

  it('links /celeste, once, from inside that landmark, and links nothing else', () => {
    // `EXPERIENCE.md:115-123` puts `/celeste` in the footer and nowhere else. `/recommendation`
    // was to sit beside it until Story 2-17 retired that route, so one link is the whole list, and
    // a second arriving here is a design change rather than a count moving.
    const { container } = render(<SiteFooter />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([['Celeste', '/celeste']]);
    expect(links[0].closest('nav'), 'the link sits outside the navigation landmark').toBe(
      container.querySelector('nav')
    );
    expect(links[0].getAttribute('target'), 'the link opens a new tab').toBeNull();
  });

  it('wraps the label in the span the underline is drawn on', () => {
    // `RESTYLE-SPEC.md:198-199`: the rule is drawn on an inner span, not on the hit-target box, or
    // it floats away from the text by the height of the padding. `SiteFooter.scss` selects
    // `.site-footer__label`, so a bare text node would leave that rule matching nothing and the
    // link with no underline while every case above stays green.
    const { container } = render(<SiteFooter />);
    const labels = container.querySelectorAll('.site-footer__label');
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toBe('Celeste');
    expect(labels[0].closest('a.site-footer__link'), 'the label is not inside its own link').not.toBeNull();
  });

  it('renders nothing interactive besides that link', () => {
    // The per-surface count `tests/e2e/hit-target-floor.pw.ts` pins for `/` moved by exactly one
    // with this link. A button, a second anchor or a `tabindex` arriving here would move it again
    // with a failure that names a number rather than this file, so it is refused here by name.
    const { container } = render(<SiteFooter />);
    const interactive = [...container.querySelectorAll(INTERACTIVE)];
    expect(interactive.map((node) => node.tagName)).toEqual(['A']);

    // The selector, on a planted control, so the one-element result is a measurement rather than
    // a selector that stopped matching: a button planted into the footer has to be seen.
    const planted = document.createElement('button');
    container.querySelector('footer')?.append(planted);
    expect(container.querySelectorAll(INTERACTIVE), 'the interactive scan does not see a planted button').toHaveLength(
      2
    );
  });

  it('carries no heading', () => {
    render(<SiteFooter />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('both figures on the line are lengths', () => {
  it('reads the rendered application count, the language count and the operator', () => {
    // Composed here the way the component composes it, noun included, so the noun is covered by the
    // rule rather than by a word typed in this file. The singular arm, which the committed Registry
    // cannot reach, is proved over fixtures in `lib/__tests__/registry.test.ts`.
    const applications = renderedApplications.length;
    const languages = ESTATE_LANGUAGES.length;
    const { container } = render(<SiteFooter />);
    expect(line(container)).toBe(
      `${capitalise(spellOut(applications))} ${pluralise(applications, 'application')} · ` +
        `${spellOut(languages)} ${pluralise(languages, 'language')} · one operator`
    );
  });

  it('agrees between each figure and the noun beside it', () => {
    // Read off the rendered line rather than composed, so a plural rule wired into the test but not
    // into the component fails here. `One applications` is the shape this refuses.
    //
    // The two lengths are widened to `number` before they are compared: `ESTATE_LANGUAGES` is a
    // `const` tuple, so its length is the literal `5` and TypeScript rejects the comparison against
    // `1` as one that can never be true. That is the type system being right about today's Registry
    // and wrong about the claim, which is that the noun follows whatever the length is.
    const applications: number = renderedApplications.length;
    const languages: number = ESTATE_LANGUAGES.length;

    const { container } = render(<SiteFooter />);
    const [applicationPart, languagePart] = line(container).split(' · ');
    expect(applicationPart.endsWith('s'), `"${applicationPart}" does not agree with its own count`).toBe(
      applications !== 1
    );
    expect(languagePart.endsWith('s'), `"${languagePart}" does not agree with its own count`).toBe(languages !== 1);
  });

  it('separates its parts with the separator the Directory already uses, not a second one', () => {
    // **Each file declares its own and each comment cites the other as evidence that one separator
    // serves the whole product.** Nothing held them equal, so a character changed in one place
    // would leave both files still agreeing with themselves. Compared through what each one
    // renders rather than by importing one into the other, because the claim is about the page.
    const probe: RegistryEntry = {
      id: 'probe',
      name: 'Probe',
      description: 'One sentence about the thing itself.',
      status: 'Complete',
      tech: ['Alpha', 'Bravo'],
      source: 'https://github.com/LuigiEspinosa/probe',
      demo: 'none',
      identity: 'none',
    };
    const { container: directory } = render(
      <ul>
        <SuiteDirectoryRow entry={probe} />
      </ul>
    );
    const tech = directory.querySelector('.suite-directory__tech')?.textContent ?? '';
    expect(tech, 'the Directory tech line renders nothing, so there is no separator to compare').not.toBe('');

    const separator = tech.slice('Alpha'.length, tech.length - 'Bravo'.length);
    expect(separator, 'the Directory no longer puts anything between two tech values').not.toBe('');

    const { container } = render(<SiteFooter />);
    expect(
      line(container).split(separator),
      `the footer separates its parts with something other than "${separator}", which is what the ` +
        `Directory renders between two tech values`
    ).toHaveLength(3);
  });

  it('counts what a Visitor is shown, not everything the Registry holds', () => {
    // The two counts on the page are two different rules. The premise opens with the whole Registry
    // and this line reads the FR-35 subset, so a single count wired into both would agree with
    // itself and be wrong on one of them.
    const { container } = render(<SiteFooter />);
    expect(line(container).startsWith(capitalise(spellOut(renderedApplications.length)))).toBe(true);
  });

  it('states no digit, both figures being spelled', () => {
    // `DESIGN.md:490` still binds `tabular-nums` to the element, which is asserted in the browser
    // suite: the rule is set so a future digit does not shift the characters beside it, not because
    // one is there today.
    const { container } = render(<SiteFooter />);
    expect(line(container)).not.toMatch(/\d/);
  });

  it('states a real number of applications rather than an empty one', () => {
    // A Registry that rendered nothing would put `Zero applications` on the page, which is a defect
    // upstream and not an empty state to design for.
    expect(renderedApplications.length, 'the Registry renders nothing at all').toBeGreaterThan(0);
    expect(ESTATE_LANGUAGES.length, 'no language is declared, so the line counts nothing').toBeGreaterThan(0);
  });
});
