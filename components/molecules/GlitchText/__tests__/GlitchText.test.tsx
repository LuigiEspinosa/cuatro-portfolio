import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import GlitchText from '../GlitchText';

const HERE = resolve(__dirname, '..');

/** The `--i`, `--count` or `--delay` a node carries inline, read through the style declaration. */
const custom = (node: Element | null, name: string): string => (node as HTMLElement | null)?.style.getPropertyValue(name) ?? '';

const chars = (container: HTMLElement): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('.glitch-text__char')];

/** Every attribute named `role` or starting with `aria-`, on any element under `container`, as `tag@name`. */
const ariaAttributes = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('*')].flatMap((node) =>
    [...node.attributes].filter((attribute) => attribute.name === 'role' || attribute.name.startsWith('aria-')).map((attribute) => `${node.tagName.toLowerCase()}@${attribute.name}`)
  );

describe('GlitchText', () => {
  // Story 2-27. The words are in the markup, on a real heading element, split into inline spans
  // that the stylesheet fades in by DOM index. No wrapper, no `aria-*`, no `role`: the accessible
  // name is the heading's own text content, which is what `EXPERIENCE.md:452-453` asks for and
  // what the interim `role='heading'` wrapper of Story 2-26 stood in for.
  it('is a real h1 with the text as its content, the level-1 heading, and nothing ARIA anywhere in it', () => {
    const { container } = render(<GlitchText text='Luigi Espinosa' />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.tagName).toBe('H1');
    expect(heading).toHaveClass('glitch-text');
    expect(heading.textContent).toBe('Luigi Espinosa');
    expect(container.children, 'the heading is wrapped in something').toHaveLength(1);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(ariaAttributes(container)).toEqual([]);
  });

  it('takes its accessible name from the spans, which is the only place the words are', () => {
    // On a one-word text, because `dom-accessibility-api` 0.5.16, which `getByRole` computes
    // names with, drops a whitespace-only inline span and reads the two-word heading as
    // `LuigiEspinosa` (observed 2026-09-14 on the rendered tree). Chromium and Playwright keep the
    // space, and `tests/e2e/display-entrance.pw.ts` reads the real name off the running page.
    render(<GlitchText text='Hello' />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toHaveClass('glitch-text');
  });

  it('splits the text into one inline span per character, indexed in DOM order, and counts them on the heading', () => {
    const { container } = render(<GlitchText text='Luigi Espinosa' delay={1.0} />);
    const heading = container.querySelector('.glitch-text');
    const spans = chars(container);
    expect(spans).toHaveLength(14);
    expect(spans.map((span) => span.textContent).join('')).toBe('Luigi Espinosa');
    expect(spans.map((span) => custom(span, '--i'))).toEqual(spans.map((_, index) => String(index)));
    expect(custom(heading, '--count')).toBe('14');
    expect(custom(heading, '--delay')).toBe('1s');
    for (const span of spans) {
      expect(span.tagName).toBe('SPAN');
      expect(span.attributes, `a span carries more than its class and its index: ${span.outerHTML}`).toHaveLength(2);
    }
  });

  it('carries --delay: 0s when no delay prop is passed', () => {
    const { container } = render(<GlitchText text='Hello' />);
    expect(custom(container.querySelector('.glitch-text'), '--delay')).toBe('0s');
  });

  it('splits on grapheme clusters, never on code units', () => {
    // The decomposed and the flag fixtures are written as escapes rather than as the characters
    // themselves, so an editor that normalises the file to NFC cannot silently turn `e` plus
    // U+0301 into the one code point U+00E9 and leave this case measuring a precomposed letter.
    const cases: [string, number][] = [
      ['Ñandú', 5],
      ['é', 1],
      ['\u{1F1EA}\u{1F1F8}', 1],
    ];
    for (const [text, expected] of cases) {
      const { container, unmount } = render(<GlitchText text={text} />);
      expect(chars(container), `${JSON.stringify(text)} did not split to ${expected}`).toHaveLength(expected);
      expect(container.querySelector('.glitch-text')?.textContent).toBe(text);
      expect(custom(container.querySelector('.glitch-text'), '--count')).toBe(String(expected));
      unmount();
    }
  });

  it('falls back to code points where Intl.Segmenter is absent, and renders the same fourteen spans', () => {
    // Firefox before 125 and Safari before 14.1 have no `Intl.Segmenter`; the component runs during
    // hydration there, so a throw would take the whole route to the error boundary.
    const segmenter = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true });
    try {
      const { container } = render(<GlitchText text='Luigi Espinosa' />);
      expect(chars(container)).toHaveLength(14);
      expect(container.querySelector('.glitch-text')?.textContent).toBe('Luigi Espinosa');
    } finally {
      if (segmenter) Object.defineProperty(Intl, 'Segmenter', segmenter);
    }
    expect(typeof Intl.Segmenter, 'the fallback case did not restore Intl.Segmenter').toBe('function');
  });

  it('renders a one-character heading as one span at index zero with a count of one', () => {
    const { container } = render(<GlitchText text='A' />);
    const spans = chars(container);
    expect(spans).toHaveLength(1);
    expect(custom(spans[0], '--i')).toBe('0');
    expect(custom(container.querySelector('.glitch-text'), '--count')).toBe('1');
  });

  it('renders the tag specified by the tag prop, as that heading level', () => {
    const { container } = render(<GlitchText text='Hello' tag='h2' />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Hello' });
    expect(container.querySelector('h2.glitch-text')).toBe(heading);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('gives a tag with no heading level the same classes and spans, and no heading role anywhere', () => {
    for (const tag of ['p', 'span'] as const) {
      const { container, unmount } = render(<GlitchText text='Hello' tag={tag} />);
      const element = container.querySelector(`${tag}.glitch-text`);
      expect(element, `no ${tag}.glitch-text rendered`).not.toBeNull();
      expect(element?.textContent).toBe('Hello');
      expect(chars(container)).toHaveLength(5);
      expect(screen.queryAllByRole('heading')).toHaveLength(0);
      expect(ariaAttributes(container)).toEqual([]);
      unmount();
    }
  });

  it('runs no script of its own: no client boundary and no GSAP', () => {
    // Comments are inside the scan on purpose: a comment that names GSAP or the client directive
    // fails this case, so the file cannot drift back towards either through its prose.
    const source = readFileSync(resolve(HERE, 'GlitchText.tsx'), 'utf8');
    expect(source).not.toMatch(/use client/);
    expect(source).not.toMatch(/gsap/i);
    expect(source).not.toMatch(/fonts\.ready/);
  });

  it('ships a stylesheet with one opacity keyframe, no loop, no shadow, no clip, no transform and no second hue', () => {
    // Comments are inside the scan on purpose: a comment naming any of these fails this case, so
    // the stylesheet cannot drift back towards the loop through its prose either.
    const source = readFileSync(resolve(HERE, 'GlitchText.scss'), 'utf8');
    for (const forbidden of ['glitch-loop', 'text-shadow', 'clip-path', 'infinite', 'rgba(']) {
      expect(source, `GlitchText.scss names ${forbidden}`).not.toContain(forbidden);
    }
    // The property, not the word: `text-transform: uppercase` is the display role's case.
    expect(source, 'GlitchText.scss declares a transform').not.toMatch(/(^|[^-\w])transform\s*:/m);
    expect(source.match(/@keyframes\b/g), 'the stylesheet declares more or fewer than one keyframe').toHaveLength(1);
    expect(source.match(/@keyframes[^{]*\{([\s\S]*?)\n\}/)?.[1].match(/^\s*[\w-]+\s*:/gm)?.every((line) => /opacity\s*:/.test(line)), 'the keyframe sets something other than opacity').toBe(true);
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none;/);
    for (const role of ['--f-display', '--w-black', '--t-display', '--lh-display', '--tr-display', '--token-text', '--dur-minor', '--dur-major', '--ease-entrance']) {
      expect(source, `GlitchText.scss no longer reads ${role}`).toContain(`var(${role})`);
    }
  });
});
