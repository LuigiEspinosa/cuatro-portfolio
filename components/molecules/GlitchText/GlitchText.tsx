import type { CSSProperties } from 'react';
import './GlitchText.scss';

// Restricting the tag union avoids dealing with the full JSX.IntrinsicElements
// type intersection
type TextTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';

interface GlitchTextProps {
  text: string;
  tag?: TextTag;
  delay?: number;
}

/**
 * The display entrance (Story 2-27): a real heading element carries the words, split at render
 * time into inline per-character spans that `GlitchText.scss` fades in by DOM index. Nothing
 * client-side happens here, so there is no hook and no client directive: `HomeLayout` is the
 * client boundary, the words are in the served markup, and the entrance is one CSS keyframe. The
 * accessible name is the element's own text content, so no ARIA attribute and no role on any node.
 *
 * One span per grapheme cluster rather than per code unit, so a combining mark, a precomposed
 * accent and a regional-indicator flag each stay one character. `tsconfig.json`'s `lib: esnext`
 * types `Intl.Segmenter`; the inline custom properties need the `CSSProperties` cast because
 * `@types/react` declares no `--*` index signature.
 */
const GlitchText = ({ text, tag: Tag = 'h1', delay = 0 }: GlitchTextProps) => {
  const graphemes = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
    (segment) => segment.segment
  );

  return (
    <Tag className='glitch-text' style={{ '--count': graphemes.length, '--delay': `${delay}s` } as CSSProperties}>
      {graphemes.map((grapheme, index) => (
        <span className='glitch-text__char' style={{ '--i': index } as CSSProperties} key={index}>
          {grapheme}
        </span>
      ))}
    </Tag>
  );
};

export default GlitchText;
