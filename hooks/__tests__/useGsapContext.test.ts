import { renderHook } from '@testing-library/react';
import { gsap } from 'gsap';
import { useGsapContext } from '../useGsapContext';

// Each gsap.context call gets its own revert so StrictMode's extra mount/cleanup
// cycle doesnt not bleed into the assertion on the final unmount.
vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { revert: vi.fn() };
    }),
  };
  return {
    gsap: gsapMock,
    default: gsapMock,
  };
});

describe('useGsapContext', () => {
  it('calls gsap.context with the provided fn on mount', () => {
    const fn = vi.fn();
    renderHook(() => useGsapContext(fn));
    expect(gsap.context).toHaveBeenCalledWith(fn, expect.objectContaining({ current: null }));
  });

  it('calls ctx.revert on unmount', () => {
    const { unmount } = renderHook(() => useGsapContext(vi.fn()));
    // Grab the revert from the sat gsap.context call.
    const calls = (gsap.context as ReturnType<typeof vi.fn>).mock.results;
    const revert = calls[calls.length - 1].value.revert;
    unmount();
    expect(revert).toHaveBeenCalledTimes(1);
  });

  it('returns a ref object', () => {
    const { result } = renderHook(() => useGsapContext(vi.fn()));
    expect(result.current).toHaveProperty('current');
  });
});
