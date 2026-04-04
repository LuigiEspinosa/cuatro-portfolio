'use client';

import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useGsapContext } from '@/hooks/useGsapContext';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import './glitch-text.scss';

gsap.registerPlugin(SplitText);

const GLYPH_POOL = ['!', '@', '#', '$', '%', 'ア', 'イ', 'ウ', 'エ', 'オ', '"'];

// Restricting the tag union avoids dealing with the full JSX.IntrinsicElements
// type intersection
type TextTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';

interface GlitchTextProps {
  text: string;
  tag?: TextTag;
  delay?: number;
}

const GlitchText = ({ text, tag: Tag = 'h1', delay = 0 }: GlitchTextProps) => {
  const reduceMotion = useReduceMotion();

  const wrapperRef = useGsapContext<HTMLDivElement>(() => {
    const inner = wrapperRef.current?.querySelector<HTMLElement>('.glitch-text__inner');
    if (!inner) return;

    if (reduceMotion) {
      gsap.set(inner, { opacity: 1 });
      return;
    }

    gsap.set(inner, { opacity: 0 });

    // Wait for fonts to finish loading before SplitText
    // measures character widths.
    document.fonts.ready.then(() => {
      if (!inner.isConnected) return;

      const split = new SplitText(inner, { type: 'chars' });
      const chars = split.chars;
      const originals = chars.map((c) => c.textContent ?? '');

      gsap.to(inner, { opacity: 1, duration: 0, delay });

      chars.forEach((char, i) => {
        const obj = { progress: 0 };
        gsap.to(obj, {
          progress: 1,
          duration: 0.3,
          delay: delay + i * 0.04,
          ease: 'none',
          onUpdate() {
            if (obj.progress < 0.05) {
              char.textContent = GLYPH_POOL[Math.floor(Math.random() * GLYPH_POOL.length)];
            }
          },
          onComplete() {
            char.textContent = originals[i];
            if (i === chars.length - 1) {
              wrapperRef.current?.classList.add('glitch');
            }
          },
        });
      });
    });
  }, [reduceMotion, delay]);

  return (
    <div ref={wrapperRef} className='glitch-text' aria-label={text}>
      <Tag className='glitch-text__inner' aria-hidden='true'>
        {text}
      </Tag>
    </div>
  );
};

export default GlitchText;
