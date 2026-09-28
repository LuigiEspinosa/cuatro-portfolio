import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function useGsapContext<T extends Element>(
  fn: (context: gsap.Context) => void,
  deps: unknown[] = []
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const ctx = gsap.context(fn, ref);
    return () => ctx.revert();
  }, deps);

  return ref;
}
