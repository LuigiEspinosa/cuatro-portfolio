import { renderHook } from '@testing-library/react';
import { useReduceMotion } from '../useReduceMotion';

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};

describe('useReduceMotion', () => {
  it('returns false when prefers-reduce-motion does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(true);
  });

  it('Subscribes to matchMedia changes on mount', () => {
    const addEventListener = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '',
        addEventListener,
        removeEventListener: vi.fn,
      }),
    });
    renderHook(() => useReduceMotion());
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('removes the change listener on unmount', () => {
    const removeEventListener = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '',
        addEventListener: vi.fn,
        removeEventListener,
      }),
    });
    const { unmount } = renderHook(() => useReduceMotion());
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
