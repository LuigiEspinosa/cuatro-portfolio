import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { TorusCanvas } from '../TorusCanvas';
import { Torus } from '@/components/atoms/Torus/Torus';

/**
 * The WebGL side of `/work`'s one dynamic boundary: the scene, and the binding that turns the torus
 * with the scroll (Story 2-33, DW-36, DW-119).
 *
 * **The binding moved here from `WorkHero` on 2026-09-24 (DW-36, Operator ruling 2026-09-24).** It is
 * the one use `ScrollTrigger` has in the Hub, so registering and binding it here puts the library in
 * the torus's on-demand chunk: a visitor who never gets the torus never fetches it, which is what
 * `EXPERIENCE.md` Rule 1 asks of anything narrative. The browser half, what each motion preference
 * requests, is `tests/e2e/work-hero.pw.ts`.
 *
 * **What the mocks honour.** GSAP records the tween it is asked for and hands back a context whose
 * revert is counted, so the binding's vars are read as written. `Scene` records the children it is
 * handed and draws nothing, so what the scene holds is read as elements rather than through a WebGL
 * renderer jsdom does not have. `Torus` is a named stand-in, so its props are the ones the scene got.
 */

const mocks = vi.hoisted(() => ({
  to: vi.fn(),
  registerPlugin: vi.fn(),
  revert: vi.fn(),
  scene: null as ReactNode,
  scrollTrigger: { plugin: 'ScrollTrigger' },
}));

vi.mock('gsap', () => {
  const gsapMock = {
    registerPlugin: mocks.registerPlugin,
    to: mocks.to,
    context: vi.fn((fn: () => void) => {
      fn();
      return { revert: mocks.revert };
    }),
  };
  return { gsap: gsapMock, default: gsapMock };
});

vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: mocks.scrollTrigger }));

vi.mock('@/components/atoms/Scene/Scene', () => ({
  Scene: ({ children }: { children: ReactNode }) => {
    mocks.scene = children;
    return null;
  },
}));

vi.mock('@/components/atoms/Torus/Torus', () => ({
  Torus: function Torus() {
    return null;
  },
}));

/** The elements the scene was handed, in order. */
const sceneElements = (): ReactElement<Record<string, unknown>>[] =>
  Children.toArray(mocks.scene).filter(isValidElement) as ReactElement<Record<string, unknown>>[];

/** A hero section, as `WorkHero` hands it over. */
const heroRef = () => ({ current: document.createElement('section') });

beforeEach(() => {
  mocks.to.mockClear();
  mocks.revert.mockClear();
  mocks.scene = null;
});

describe('the torus is bound to the scroll here, and only here', () => {
  it('registers ScrollTrigger in this module, so the plugin arrives with the torus', () => {
    // Registered at module scope, on import, which is why this is read before any render clears it.
    expect(mocks.registerPlugin, 'the torus module does not register ScrollTrigger').toHaveBeenCalledWith(mocks.scrollTrigger);
  });

  it('binds the torus to the hero it is handed, 1:1 with the scroll, and hands the torus that bridge', () => {
    const trigger = heroRef();
    render(<TorusCanvas triggerRef={trigger} />);

    expect(mocks.to, 'the scroll binding was not created exactly once').toHaveBeenCalledTimes(1);
    const [target, vars] = mocks.to.mock.calls[0] as [{ value: number }, Record<string, unknown>];
    expect(target, 'the binding does not drive a scroll bridge starting at zero').toEqual({ value: 0 });
    expect(vars.value).toBe(1);
    expect(vars.ease, 'the binding eases, so the rotation would not track the scroll').toBe('none');
    expect(vars.scrollTrigger, 'the binding is not the hero scrolled through the viewport, 1:1').toEqual({
      trigger: trigger.current,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
    });

    const torus = sceneElements().find((element) => element.type === Torus);
    expect(torus, 'the scene holds no torus').toBeDefined();
    const scrollRef = torus?.props.scrollRef as { current: unknown } | undefined;
    expect(scrollRef?.current, 'the torus reads a different object from the one the scroll drives').toBe(target);
  });

  it('reverts the binding when the torus goes', () => {
    const { unmount } = render(<TorusCanvas triggerRef={heroRef()} />);
    expect(mocks.revert).not.toHaveBeenCalled();
    unmount();
    expect(mocks.revert, 'the binding outlived the torus').toHaveBeenCalledTimes(1);
  });
});

describe('the scene is decoration, with nothing in it to operate', () => {
  it('holds a light and the torus, and nothing that takes a pointer (DW-119)', () => {
    // Drei's orbit controls sat third in this list until 2026-09-24, turning the torus under a drag
    // that `EXPERIENCE.md` § Pointer and touch rules out; `tests/e2e/work-hero.pw.ts` drags the canvas
    // and reads the pixels.
    render(<TorusCanvas triggerRef={heroRef()} />);
    const names = sceneElements().map((element) =>
      typeof element.type === 'string' ? element.type : (element.type as { name?: string }).name
    );
    expect(names, 'the scene holds something other than a light and the torus').toEqual(['ambientLight', 'Torus']);
  });
});
